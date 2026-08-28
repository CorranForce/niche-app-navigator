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

export type MappingResult =
  | { ok: true; row: SubscriptionRowInput }
  | { ok: false; reason: "missing_user" | "missing_external_ids" | "missing_subscription_id" };

/**
 * Builds the DB row for a subscription.created event, or explains why it can't.
 *
 * `options.userId` must be the owner the *server* resolved (from the signed
 * checkout intent). Anything the browser put in `customData` is ignored here.
 */
export function subscriptionRowFromEvent(
  data: SubscriptionEventData,
  environment: string,
  options: { userId?: string | null; now?: Date } = {},
): MappingResult {
  const now = options.now ?? new Date();
  const userId = options.userId;
  if (!userId) return { ok: false, reason: "missing_user" };
  if (!data.id || !data.customerId) return { ok: false, reason: "missing_subscription_id" };

  const item = data.items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;
  if (!priceId || !productId) return { ok: false, reason: "missing_external_ids" };

  return {
    ok: true,
    row: {
      user_id: userId,
      paddle_subscription_id: data.id,
      paddle_customer_id: data.customerId,
      product_id: productId,
      price_id: priceId,
      status: data.status ?? "active",
      current_period_start: data.currentBillingPeriod?.startsAt ?? null,
      current_period_end: data.currentBillingPeriod?.endsAt ?? null,
      environment,
      updated_at: now.toISOString(),
    },
  };
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
