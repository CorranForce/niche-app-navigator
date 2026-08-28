import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { getPaddleEnvironment } from "@/lib/paddle";
import { entitledPlan, isPastDue, limitForPlan, type PlanId } from "@/lib/plan-limits";

export type SubscriptionRow = {
  id: string;
  paddle_subscription_id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  environment: string;
  created_at: string | null;
};

export function useSubscription() {
  const { user, loading } = useSession();
  const queryClient = useQueryClient();
  const environment = getPaddleEnvironment();
  const queryKey = ["subscription", user?.id, environment];

  const query = useQuery({
    queryKey,
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<SubscriptionRow | null> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("environment", environment)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SubscriptionRow | null) ?? null;
    },
  });

  // Webhook-driven plan changes land in the database out-of-band; listen for them
  // so entitlements update live without a page reload or a fresh sign-in.
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`subscriptions:${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          void queryClient.invalidateQueries({ queryKey });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, environment]);

  const sub = query.data ?? null;

  const plan: PlanId = entitledPlan(sub);
  const pastDue = isPastDue(sub?.status);

  return {
    subscription: sub,
    plan,
    /** True when the account currently has paid entitlements (past_due is restricted to no access). */
    isActive: plan !== "none",
    /** True when the subscription exists in Paddle but is not currently granting access. */
    isPastDue: pastDue,
    monthlyLimit: limitForPlan(plan),
    loading: loading || query.isLoading,
    refetch: query.refetch,
  };
}
