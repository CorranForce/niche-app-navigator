/**
 * Resolves the plan a signed-in user is actually entitled to.
 *
 * Entitlement can come from two places:
 *  - their own subscription row, or
 *  - a Studio workspace they were invited to (seats grant the owner's plan).
 *
 * The `my_effective_subscription` database function encapsulates both, so the
 * teammate's own (non-existent) subscription never hides the inherited one.
 */
import { entitledPlan, limitForPlan, planFeatures, type PlanFeatures, type PlanId } from "@/lib/plan-limits";
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

export function entitlementFromRow(row: Row | null, environment: PaymentsEnv): EffectiveEntitlement {
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

/** Reads the caller's effective entitlement through the security-definer RPC. */
export async function effectiveEntitlement(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  environment: PaymentsEnv = paymentsEnv(),
): Promise<EffectiveEntitlement> {
  const { data, error } = await supabase.rpc("my_effective_subscription", { _env: environment });
  if (error) return entitlementFromRow(null, environment);
  const row = (Array.isArray(data) ? data[0] : data) as Row | null;
  return entitlementFromRow(row ?? null, environment);
}
