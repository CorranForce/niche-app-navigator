export type PlanId = "none" | "solo" | "pro" | "studio";

/** Maps Paddle product IDs (human-readable external IDs) to app plans. */
export const PRODUCT_PLAN_MAP: Record<string, PlanId> = {
  solo_plan: "solo",
  pro_plan: "pro",
  studio_plan: "studio",
};

/** Monthly report allowance per plan. `null` = unlimited, 0 = no access. */
export const PLAN_LIMITS: Record<PlanId, number | null> = {
  none: 0,
  solo: 10,
  pro: 50,
  studio: null,
};

/** Every plan starts with the same free trial. */
export const TRIAL_DAYS = 7;

/** Seats included with the Studio plan (owner included). */
export const STUDIO_SEATS = 5;

/** Minimum seconds between generations on non-priority plans. */
export const STANDARD_QUEUE_COOLDOWN_SECONDS = 45;

export function planForProductId(productId: string | null | undefined): PlanId {
  if (!productId) return "none";
  return PRODUCT_PLAN_MAP[productId] ?? "none";
}

export type EntitlementInput = {
  status?: string | null;
  product_id?: string | null;
  current_period_end?: string | Date | null;
};

/**
 * Resolves the plan a subscription row actually entitles the user to.
 * - active / trialing → the paid plan (trials get full access)
 * - canceled but still inside the paid period → the paid plan (access until period end)
 * - past_due / no subscription → "none" (no report generation)
 */
export function entitledPlan(sub: EntitlementInput | null | undefined): PlanId {
  if (!sub?.status) return "none";
  const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
  const withinPeriod = !periodEnd || periodEnd > new Date();

  if ((sub.status === "active" || sub.status === "trialing") && withinPeriod) {
    return planForProductId(sub.product_id);
  }
  if (sub.status === "canceled" && periodEnd && periodEnd > new Date()) {
    return planForProductId(sub.product_id);
  }
  return "none";
}

export function isPastDue(status?: string | null): boolean {
  return status === "past_due";
}

export function limitForPlan(plan: PlanId): number | null {
  return PLAN_LIMITS[plan];
}

export const PLAN_LABELS: Record<PlanId, string> = {
  none: "No plan",
  solo: "Solo",
  pro: "Pro",
  studio: "Studio",
};

export const PLAN_RANK: Record<PlanId, number> = { none: 0, solo: 1, pro: 2, studio: 3 };

export type PlanFeatures = {
  /** Can generate reports at all. */
  generate: boolean;
  /** Markdown copy + file export. */
  markdownExport: boolean;
  /** Skips the standard generation cooldown and uses deeper reasoning. */
  priorityQueue: boolean;
  /** Shared team library and seat management. */
  team: boolean;
  /** Side-by-side niche comparison. */
  compare: boolean;
  /** Priority support surface. */
  prioritySupport: boolean;
};

export function planFeatures(plan: PlanId): PlanFeatures {
  const rank = PLAN_RANK[plan];
  return {
    generate: rank >= 1,
    markdownExport: rank >= 2,
    priorityQueue: rank >= 2,
    team: rank >= 3,
    compare: rank >= 3,
    prioritySupport: rank >= 3,
  };
}
