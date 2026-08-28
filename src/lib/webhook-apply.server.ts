/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { EventName, type PaddleEnv } from "@/lib/paddle.server";

let _supabase: ReturnType<typeof createClient<any, any, any>> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient<any, any, any>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _supabase;
}

/** Reads the timestamp of the state we already persisted for a subscription. */
async function existingUpdatedAt(subscriptionId: string, env: PaddleEnv): Promise<string | null> {
  if (!subscriptionId) return null;
  const { data } = await getSupabase()
    .from("subscriptions")
    .select("updated_at")
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();
  return (data as any)?.updated_at ?? null;
}

export type ApplyOutcome = { applied: boolean; reason: string };

async function handleSubscriptionCreated(
  data: any,
  env: PaddleEnv,
  occurredAt: string,
): Promise<ApplyOutcome> {
  const { subscriptionRowFromEvent } = await import("@/lib/webhook-entitlement");
  const { verifyCheckoutIntent } = await import("@/lib/checkout-token.server");

  // The account a subscription belongs to comes from the server-signed checkout
  // intent only. `customData.userId` is attacker-controllable and is ignored,
  // otherwise anyone could pay while tagging the purchase to another account.
  const verified = verifyCheckoutIntent(data?.customData?.checkoutToken);
  if (!verified.ok) {
    const { recordSystemEvent } = await import("@/lib/monitoring.server");
    await recordSystemEvent({
      source: "webhook",
      severity: "critical",
      event: "paddle.checkout_intent_rejected",
      message: `Subscription webhook without a valid checkout intent (${verified.reason}).`,
      context: { env, subscriptionId: data?.id ?? null, customerId: data?.customerId ?? null },
    });
    console.warn("Skipping subscription webhook: unverified checkout intent");
    return { applied: false, reason: `intent_${verified.reason}` };
  }

  const mapped = subscriptionRowFromEvent(data, env, {
    userId: verified.intent.uid,
    now: new Date(occurredAt),
    intent: { env: verified.intent.env, price: verified.intent.price },
  });
  if (!mapped.ok) {
    const { recordSystemEvent } = await import("@/lib/monitoring.server");
    await recordSystemEvent({
      source: "webhook",
      severity: mapped.reason.startsWith("intent_") ? "critical" : "warning",
      event: "paddle.payload_rejected",
      message: `Subscription payload rejected (${mapped.reason}).`,
      context: { env, subscriptionId: data?.id ?? null },
    });
    console.warn("Skipping subscription webhook:", mapped.reason);
    return { applied: false, reason: mapped.reason };
  }

  // Retries and out-of-order deliveries must not roll state backwards.
  const { shouldApplyEvent } = await import("@/lib/webhook-entitlement");
  const current = await existingUpdatedAt(mapped.row.paddle_subscription_id, env);
  if (!shouldApplyEvent(current, occurredAt)) {
    console.log("Skipping stale/duplicate subscription.created", mapped.row.paddle_subscription_id);
    return { applied: false, reason: "stale_event" };
  }

  await getSupabase()
    .from("subscriptions")
    .upsert(mapped.row, { onConflict: "paddle_subscription_id" });
  return { applied: true, reason: "subscription_created" };
}

async function handleSubscriptionUpdated(
  data: any,
  env: PaddleEnv,
  occurredAt: string,
  sendEmails = true,
): Promise<ApplyOutcome> {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data ?? {};
  if (typeof id !== "string" || !id) {
    console.warn("Skipping subscription update without an id");
    return { applied: false, reason: "missing_subscription_id" };
  }

  const { shouldApplyEvent, KNOWN_SUBSCRIPTION_STATUSES } =
    await import("@/lib/webhook-entitlement");
  if (typeof status !== "string" || !KNOWN_SUBSCRIPTION_STATUSES.includes(status as never)) {
    console.warn("Skipping subscription update with unknown status:", status);
    return { applied: false, reason: "unknown_status" };
  }
  if (!shouldApplyEvent(await existingUpdatedAt(id, env), occurredAt)) {
    console.log("Skipping stale/duplicate subscription update", id);
    return { applied: false, reason: "stale_event" };
  }

  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;

  // Snapshot the row first so the confirmation email only goes out when the
  // customer's plan, status or cancellation schedule actually moved.
  const { data: previous } = await getSupabase()
    .from("subscriptions")
    .select("status, price_id, cancel_at_period_end")
    .eq("paddle_subscription_id", id)
    .eq("environment", env)
    .maybeSingle();

  const cancelScheduled = scheduledChange?.action === "cancel";

  await getSupabase()
    .from("subscriptions")
    .update({
      status,
      ...(priceId ? { price_id: priceId } : {}),
      ...(productId ? { product_id: productId } : {}),
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: cancelScheduled,
      updated_at: occurredAt,
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);

  if (sendEmails && previous) {
    const before = previous as {
      status?: string;
      price_id?: string | null;
      cancel_at_period_end?: boolean | null;
    };
    const kind = classifyChange(before, { status, priceId, cancelScheduled });
    if (kind) {
      const { sendSubscriptionChangeEmail } = await import("@/lib/billing-emails.server");
      await sendSubscriptionChangeEmail(data, env, kind, occurredAt);
    }
  }

  return { applied: true, reason: "subscription_updated" };
}

/** Decides which confirmation (if any) a subscription update warrants. */
function classifyChange(
  before: { status?: string; price_id?: string | null; cancel_at_period_end?: boolean | null },
  after: { status: string; priceId?: string | null; cancelScheduled: boolean },
): "plan_changed" | "cancellation_scheduled" | "resumed" | "paused" | "past_due" | null {
  if (after.cancelScheduled && !before.cancel_at_period_end) return "cancellation_scheduled";
  if (!after.cancelScheduled && before.cancel_at_period_end) return "resumed";
  if (after.status !== before.status) {
    if (after.status === "paused") return "paused";
    if (after.status === "past_due") return "past_due";
    if (
      (after.status === "active" || after.status === "trialing") &&
      (before.status === "paused" || before.status === "past_due")
    ) {
      return "resumed";
    }
  }
  if (after.priceId && after.priceId !== before.price_id) return "plan_changed";
  return null;
}

async function handleSubscriptionCanceled(
  data: any,
  env: PaddleEnv,
  occurredAt: string,
  sendEmails = true,
): Promise<ApplyOutcome> {
  if (typeof data?.id !== "string" || !data.id) {
    return { applied: false, reason: "missing_subscription_id" };
  }
  const { shouldApplyEvent } = await import("@/lib/webhook-entitlement");
  if (!shouldApplyEvent(await existingUpdatedAt(data.id, env), occurredAt)) {
    console.log("Skipping stale/duplicate cancellation", data.id);
    return { applied: false, reason: "stale_event" };
  }
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: occurredAt })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);

  if (sendEmails) {
    const { sendSubscriptionChangeEmail } = await import("@/lib/billing-emails.server");
    await sendSubscriptionChangeEmail(data, env, "canceled", occurredAt);
  }
  return { applied: true, reason: "subscription_canceled" };
}

/**
 * A failed charge immediately restricts the subscription. This only ever moves a
 * live subscription into `past_due` — it never revives a canceled one — so it is
 * safe to apply without an ordering guard on replays and out-of-order deliveries.
 */
export async function markPastDueFromFailedPayment(
  data: any,
  env: PaddleEnv,
  occurredAt: string,
): Promise<ApplyOutcome> {
  const subscriptionId = data?.subscriptionId;
  if (typeof subscriptionId !== "string" || !subscriptionId) {
    return { applied: false, reason: "no_subscription_id" };
  }
  const { data: existing } = await getSupabase()
    .from("subscriptions")
    .select("status")
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env)
    .maybeSingle();

  const status = (existing as any)?.status as string | undefined;
  if (!status) return { applied: false, reason: "unknown_subscription" };
  if (status !== "active" && status !== "trialing") {
    return { applied: false, reason: "not_restrictable" };
  }

  await getSupabase()
    .from("subscriptions")
    .update({ status: "past_due", updated_at: occurredAt })
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env);
  return { applied: true, reason: "marked_past_due" };
}

async function refreshPeriodFromTransaction(data: any, env: PaddleEnv): Promise<ApplyOutcome> {
  const subscriptionId = data?.subscriptionId;
  const period = data?.billingPeriod;
  if (!subscriptionId || !period?.endsAt) return { applied: false, reason: "no_billing_period" };
  await getSupabase()
    .from("subscriptions")
    .update({
      current_period_start: period.startsAt ?? null,
      current_period_end: period.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env);
  return { applied: true, reason: "period_refreshed" };
}

const LIFECYCLE_EVENTS = new Set([
  "subscription.activated",
  "subscription.trialing",
  "subscription.past_due",
  "subscription.paused",
  "subscription.resumed",
  "subscription.imported",
]);

/**
 * Single place where a verified Paddle event mutates entitlement state. Both the
 * live webhook route and the admin reprocess control go through here, so the
 * out-of-order and duplicate guards apply identically to replays.
 */
export async function applyPaddleEvent(options: {
  eventType: string;
  data: any;
  env: PaddleEnv;
  occurredAt: string;
  sendEmails?: boolean;
}): Promise<ApplyOutcome> {
  const { eventType, data, env, occurredAt, sendEmails = true } = options;

  switch (eventType) {
    case EventName.SubscriptionCreated:
      return handleSubscriptionCreated(data, env, occurredAt);
    case EventName.SubscriptionUpdated:
      return handleSubscriptionUpdated(data, env, occurredAt, sendEmails);
    case EventName.SubscriptionCanceled:
      return handleSubscriptionCanceled(data, env, occurredAt, sendEmails);
    case EventName.TransactionCompleted: {
      // A renewal payment also refreshes the billing period, so keep the row in
      // step even if the matching subscription.updated event is delayed.
      const outcome = await refreshPeriodFromTransaction(data, env);
      if (sendEmails) {
        const { sendInvoiceEmail } = await import("@/lib/billing-emails.server");
        await sendInvoiceEmail(data, env);
      }
      return outcome;
    }
    case EventName.TransactionPaymentFailed: {
      // Access is cut on the first failed charge rather than waiting for Paddle's
      // dunning to escalate to `past_due`, so a lapsed card can't buy free usage.
      const restricted = await markPastDueFromFailedPayment(data, env, occurredAt);
      if (sendEmails) {
        const { sendPaymentFailedEmail } = await import("@/lib/billing-emails.server");
        await sendPaymentFailedEmail(data, env);
      }
      return {
        applied: restricted.applied || sendEmails,
        reason: restricted.applied ? "payment_failed_past_due" : "payment_failed_notified",
      };
    }

    default: {
      // Lifecycle events that only change status/period reuse the update path.
      if (LIFECYCLE_EVENTS.has(eventType)) {
        return handleSubscriptionUpdated(data, env, occurredAt, sendEmails);
      }
      console.log("Unhandled event:", eventType);
      return { applied: false, reason: "unhandled_event_type" };
    }
  }
}

/** Normalises Paddle's REST snake_case payloads to the SDK's camelCase shape. */
export function toCamelCase<T>(input: T): T {
  if (Array.isArray(input)) return input.map((v) => toCamelCase(v)) as unknown as T;
  if (input && typeof input === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      const camel = key.replace(/_([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
      out[camel] = toCamelCase(value);
    }
    return out as T;
  }
  return input;
}

export function normalisedOccurredAt(raw: unknown): string {
  const parsed = typeof raw === "string" ? Date.parse(raw) : Number.NaN;
  return Number.isNaN(parsed) ? new Date().toISOString() : new Date(parsed).toISOString();
}
