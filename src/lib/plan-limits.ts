export type PlanId = "free" | "pro" | "studio";

/** Maps Paddle product IDs (human-readable external IDs) to app plans. */
export const PRODUCT_PLAN_MAP: Record<string, PlanId> = {
  pro_plan: "pro",
  studio_plan: "studio",
};

/** Monthly report allowance per plan. `null` = unlimited. */
export const PLAN_LIMITS: Record<PlanId, number | null> = {
  free: 5,
  pro: 50,
  studio: null,
};

export const FREE_MONTHLY_LIMIT = PLAN_LIMITS.free as number;

export function planForProductId(productId: string | null | undefined): PlanId {
  if (!productId) return "free";
  return PRODUCT_PLAN_MAP[productId] ?? "free";
}

export type EntitlementInput = {
  status?: string | null;
  product_id?: string | null;
  current_period_end?: string | Date | null;
};

/**
 * Resolves the plan a subscription row actually entitles the user to.
 * - active / trialing → the paid plan
 * - canceled but still inside the paid period → the paid plan (access until period end)
 * - past_due → "free" (restricted until the payment is fixed)
 */
export function entitledPlan(sub: EntitlementInput | null | undefined): PlanId {
  if (!sub?.status) return "free";
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const withinPeriod = !periodEnd || periodEnd > new Date();

  if ((sub.status === "active" || sub.status === "trialing") && withinPeriod) {
    return planForProductId(sub.product_id);
  }
  if (sub.status === "canceled" && periodEnd && periodEnd > new Date()) {
    return planForProductId(sub.product_id);
  }
  return "free";
}

export function isPastDue(status?: string | null): boolean {
  return status === "past_due";
}

export function limitForPlan(plan: PlanId): number | null {
  return PLAN_LIMITS[plan];
}

export const PLAN_LABELS: Record<PlanId, string> = {
  free: "Free",
  pro: "Pro",
  studio: "Studio",
};
