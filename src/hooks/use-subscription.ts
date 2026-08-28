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

  const query = useQuery({
    queryKey: ["subscription", user?.id, getPaddleEnvironment()],
    enabled: Boolean(user),
    queryFn: async (): Promise<SubscriptionRow | null> => {
      const { data, error } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", user!.id)
        .eq("environment", getPaddleEnvironment())
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as SubscriptionRow | null) ?? null;
    },
  });

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
