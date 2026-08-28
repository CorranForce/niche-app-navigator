/**
 * Resolves the plan a signed-in user is actually entitled to.
 *
 * Entitlement can come from two places:
 *  - their own subscription row, or
 *  - a Studio workspace they were invited to (seats grant the owner's plan).
 *
 * The `effective_subscription_for(_user_id, _env)` database function encapsulates
 * both, so the teammate's own (non-existent) subscription never hides the
 * inherited one. It is service-role only and reached through a server function.

 */
import {
  entitledPlan,
  limitForPlan,
  planFeatures,
  type PlanFeatures,
  type PlanId,
} from "@/lib/plan-limits";
import { paymentsEnv, type PaymentsEnv } from "@/lib/payments-env";

export type EffectiveEntitlement = {
  plan: PlanId;
  features: PlanFeatures;
  limit: number | null;
  status: string | null;
  /** "own" when the user pays, "team" when a Studio owner covers them. */
  source: "own" | "team" | null;
  ownerId: string | null;
  currentPeriodEnd: string | null;
  environment: PaymentsEnv;
};

type Row = {
  status?: string | null;
  product_id?: string | null;
  current_period_end?: string | null;
  source?: string | null;
  owner_id?: string | null;
};

export function entitlementFromRow(
  row: Row | null,
  environment: PaymentsEnv,
): EffectiveEntitlement {
  const plan = entitledPlan(row ?? null);
  return {
    plan,
    features: planFeatures(plan),
    limit: limitForPlan(plan),
    status: row?.status ?? null,
    source: (row?.source as "own" | "team" | null) ?? null,
    ownerId: row?.owner_id ?? null,
    currentPeriodEnd: row?.current_period_end ?? null,
    environment,
  };
}

/**
 * Reads a user's effective entitlement.
 *
 * The underlying SECURITY DEFINER function is not executable by signed-in
 * users; it is invoked here with the service-role client only after the caller
 * has been authenticated by `requireSupabaseAuth`, so the user id is trusted.
 * Server-only: call this from inside a server function handler.
 */
export async function effectiveEntitlement(
  userId: string,
  environment: PaymentsEnv = paymentsEnv(),
): Promise<EffectiveEntitlement> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("effective_subscription_for", {
    _user_id: userId,
    _env: environment,
  });
  if (error) return entitlementFromRow(null, environment);
  const row = (Array.isArray(data) ? data[0] : data) as Row | null;
  return entitlementFromRow(row ?? null, environment);
}
