import type { PlanId } from "@/lib/paddle";

/** Monthly report allowance per plan. `null` = unlimited. */
export const PLAN_LIMITS: Record<PlanId, number | null> = {
  free: 5,
  pro: 50,
  studio: null,
};

export const FREE_MONTHLY_LIMIT = PLAN_LIMITS.free as number;

export type EntitlementInput = {
  status?: string | null;
  productId?: string | null;
  currentPeriodEnd?: string | Date | null;
};

/**
 * Resolves the plan a subscription row actually entitles the user to.
 * - active / trialing → the paid plan
 * - canceled but still inside the paid period → the paid plan (access until period end)
 * - past_due → "free" (access is restricted until payment is fixed)
 */
export function entitledPlan(
  sub: EntitlementInput | null | undefined,
  planForProductId: (productId: string | null | undefined) => PlanId,
): PlanId {
  if (!sub?.status) return "free";
  const periodEnd = sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd) : null;
  const withinPeriod = !periodEnd || periodEnd > new Date();

  if (sub.status === "active" || sub.status === "trialing") {
    return withinPeriod ? planForProductId(sub.productId) : "free";
  }
  if (sub.status === "canceled" && periodEnd && periodEnd > new Date()) {
    return planForProductId(sub.productId);
  }
  return "free";
}

export function isPastDue(status?: string | null): boolean {
  return status === "past_due";
}

export function limitForPlan(plan: PlanId): number | null {
  return PLAN_LIMITS[plan];
}
