/**
 * Picking "the subscription we should act on".
 *
 * A user can accumulate several rows over time (re-subscribes, environment
 * switches, imported records). Ordering by `created_at` alone is wrong: a
 * newer canceled row would shadow an older row that is still billing. Rank by
 * how live the subscription is first, then by recency.
 */

export type SelectableSubscription = {
  paddle_subscription_id: string;
  paddle_customer_id?: string;
  environment: string;
  status: string;
  price_id?: string;
  cancel_at_period_end?: boolean | null;
  current_period_end?: string | null;
  created_at?: string | null;
};

/** Higher wins. Anything unknown sorts below every known state. */
export const SUBSCRIPTION_STATUS_RANK: Record<string, number> = {
  active: 5,
  trialing: 5,
  past_due: 4,
  paused: 3,
  canceled: 1,
};

export function pickBillableSubscription<T extends SelectableSubscription>(
  rows: readonly T[] | null | undefined,
): T | null {
  if (!rows?.length) return null;
  return (
    [...rows].sort(
      (a, b) =>
        (SUBSCRIPTION_STATUS_RANK[b.status] ?? 0) - (SUBSCRIPTION_STATUS_RANK[a.status] ?? 0) ||
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
    )[0] ?? null
  );
}

/** A subscription Paddle will still accept plan changes / cancellation for. */
export function isManageable(sub: SelectableSubscription | null): boolean {
  if (!sub) return false;
  return sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
}

/** True when the subscription is scheduled to end but has not ended yet. */
export function isResumable(sub: SelectableSubscription | null): boolean {
  if (!sub) return false;
  if (sub.status === "paused") return true;
  if (sub.status === "canceled") return false;
  return Boolean(sub.cancel_at_period_end);
}
