import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { paymentsEnv } from "@/lib/payments-env";
import { useServerFn } from "@tanstack/react-start";
import { entitlementFromRow, type EffectiveEntitlement } from "@/lib/entitlement";
import { getMyEntitlement } from "@/lib/entitlement.functions";
import { isPastDue } from "@/lib/plan-limits";

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
  const environment = paymentsEnv();
  const queryKey = ["subscription", user?.id, environment];
  const fetchEntitlement = useServerFn(getMyEntitlement);

  const query = useQuery({
    queryKey,
    enabled: Boolean(user),
    refetchOnWindowFocus: true,
    queryFn: async (): Promise<{
      row: SubscriptionRow | null;
      entitlement: EffectiveEntitlement;
    }> => {
      const [own, entitlement] = await Promise.all([
        supabase
          .from("subscriptions")
          .select("*")
          .eq("user_id", user!.id)
          .eq("environment", environment)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        fetchEntitlement(),
      ]);
      if (own.error) throw own.error;
      return {
        row: (own.data as SubscriptionRow | null) ?? null,
        entitlement,
      };
    },
  });

  // Webhook-driven plan changes land in the database out-of-band; listen for them
  // so entitlements update live without a page reload or a fresh sign-in.
  useEffect(() => {
    const userId = user?.id;
    if (!userId) return;
    const topic = `subscriptions:${userId}:${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(topic)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ["subscription", userId, environment] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, environment, queryClient]);

  const sub = query.data?.row ?? null;
  const entitlement = query.data?.entitlement ?? entitlementFromRow(null, environment);

  return {
    subscription: sub,
    plan: entitlement.plan,
    features: entitlement.features,
    /** "team" when access is inherited from a Studio workspace owner. */
    entitlementSource: entitlement.source,
    /** True when the account currently has paid entitlements (past_due is restricted to no access). */
    isActive: entitlement.plan !== "none",
    /** True when the subscription exists but is not currently granting access. */
    isPastDue: isPastDue(sub?.status ?? entitlement.status),
    monthlyLimit: entitlement.limit,
    loading: loading || query.isLoading,
    refetch: query.refetch,
  };
}
