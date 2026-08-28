/**
 * Pure mapping between a payment-provider subscription event and the row we
 * persist in `subscriptions`, plus the entitlement that row grants.
 *
 * Kept free of I/O so both the webhook route and the CI smoke suite can use it.
 */
import {
  entitledPlan,
  limitForPlan,
  planFeatures,
  PRODUCT_PLAN_MAP,
  type PlanFeatures,
  type PlanId,
} from "@/lib/plan-limits";

export type SubscriptionEventItem = {
  price?: { id?: string; importMeta?: { externalId?: string | null } | null } | null;
  product?: { id?: string; importMeta?: { externalId?: string | null } | null } | null;
};

export type SubscriptionEventData = {
  id?: string;
  customerId?: string;
  status?: string;
  items?: SubscriptionEventItem[];
  currentBillingPeriod?: { startsAt?: string | null; endsAt?: string | null } | null;
  scheduledChange?: { action?: string } | null;
  /**
   * Browser-supplied data. `checkoutToken` is a server-signed intent; the raw
   * `userId` is NEVER trusted for attribution — callers must pass the verified
   * owner explicitly via `options.userId`.
   */
  customData?: { checkoutToken?: string; userId?: string } | null;
};

export type SubscriptionRowInput = {
  user_id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  environment: string;
  updated_at: string;
};

export type MappingFailureReason =
  | "missing_user"
  | "missing_external_ids"
  | "missing_subscription_id"
  | "malformed_payload"
  | "invalid_status"
  | "invalid_period"
  | "intent_env_mismatch"
  | "intent_price_mismatch"
  | "unknown_product";

export type MappingResult =
  { ok: true; row: SubscriptionRowInput } | { ok: false; reason: MappingFailureReason };

/** Statuses Paddle can send for a subscription. Anything else is not mapped. */
export const KNOWN_SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "paused",
  "canceled",
] as const;

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

function parseTimestamp(value: unknown): { ok: true; value: string | null } | { ok: false } {
  if (value === null || value === undefined || value === "") return { ok: true, value: null };
  if (typeof value !== "string") return { ok: false };
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return { ok: false };
  return { ok: true, value: new Date(parsed).toISOString() };
}

/**
 * Builds the DB row for a subscription.created event, or explains why it can't.
 *
 * `options.userId` must be the owner the *server* resolved (from the signed
 * checkout intent). Anything the browser put in `customData` is ignored here.
 * `options.intent` (also server-verified) is cross-checked against the payload
 * so a token minted for one environment/price cannot be replayed onto another.
 */
export function subscriptionRowFromEvent(
  data: SubscriptionEventData,
  environment: string,
  options: {
    userId?: string | null;
    now?: Date;
    intent?: { env?: string; price?: string } | null;
  } = {},
): MappingResult {
  const now = options.now ?? new Date();
  const userId = options.userId;
  if (!isNonEmptyString(userId)) return { ok: false, reason: "missing_user" };
  if (!data || typeof data !== "object") return { ok: false, reason: "malformed_payload" };
  if (!isNonEmptyString(data.id) || !isNonEmptyString(data.customerId))
    return { ok: false, reason: "missing_subscription_id" };

  const status = data.status ?? "active";
  if (!isNonEmptyString(status) || !KNOWN_SUBSCRIPTION_STATUSES.includes(status as never))
    return { ok: false, reason: "invalid_status" };

  if (data.items !== undefined && !Array.isArray(data.items))
    return { ok: false, reason: "malformed_payload" };
  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!isNonEmptyString(priceId) || !isNonEmptyString(productId))
    return { ok: false, reason: "missing_external_ids" };
  if (!(productId in PRODUCT_PLAN_MAP)) return { ok: false, reason: "unknown_product" };

  const startsAt = parseTimestamp(data.currentBillingPeriod?.startsAt);
  const endsAt = parseTimestamp(data.currentBillingPeriod?.endsAt);
  if (!startsAt.ok || !endsAt.ok) return { ok: false, reason: "invalid_period" };
  if (startsAt.value && endsAt.value && Date.parse(endsAt.value) < Date.parse(startsAt.value))
    return { ok: false, reason: "invalid_period" };

  // The signed intent is bound to the environment and price it was minted for.
  if (options.intent) {
    if (options.intent.env && options.intent.env !== environment)
      return { ok: false, reason: "intent_env_mismatch" };
    if (options.intent.price && options.intent.price !== priceId)
      return { ok: false, reason: "intent_price_mismatch" };
  }

  return {
    ok: true,
    row: {
      user_id: userId,
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customerId,
      product_id: productId,
      price_id: priceId,
      status,
      current_period_start: startsAt.value,
      current_period_end: endsAt.value,
      environment,
      updated_at: now.toISOString(),
    },
  };
}

/**
 * Duplicate and out-of-order delivery guard.
 *
 * Paddle retries for up to 3 days and does not guarantee ordering, so an older
 * event can arrive after a newer one. An event is only applied when it is
 * strictly newer than the state already persisted; equal timestamps are treated
 * as a replay of the same delivery and skipped (the write would be a no-op).
 */
export function shouldApplyEvent(
  existingUpdatedAt: string | Date | null | undefined,
  occurredAt: string | Date | null | undefined,
): boolean {
  if (!occurredAt) return false;
  const incoming = new Date(occurredAt).getTime();
  if (Number.isNaN(incoming)) return false;
  if (!existingUpdatedAt) return true;
  const existing = new Date(existingUpdatedAt).getTime();
  if (Number.isNaN(existing)) return true;
  return incoming > existing;
}

export type Entitlement = {
  plan: PlanId;
  monthlyLimit: number | null;
  features: PlanFeatures;
};

/** Entitlement granted by a persisted subscription row. */
export function entitlementForRow(
  row: Pick<SubscriptionRowInput, "status" | "product_id" | "current_period_end"> | null,
): Entitlement {
  const plan = entitledPlan(row);
  return { plan, monthlyLimit: limitForPlan(plan), features: planFeatures(plan) };
}

/** End-to-end: webhook event → entitlement, used by tests and smoke checks. */
export function entitlementFromEvent(
  data: SubscriptionEventData,
  environment: string,
  userId: string = "verified-user",
): Entitlement | null {
  const mapped = subscriptionRowFromEvent(data, environment, { userId });
  if (!mapped.ok) return null;
  return entitlementForRow(mapped.row);
}
