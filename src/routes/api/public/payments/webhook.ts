import { createFileRoute } from "@tanstack/react-router";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

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

async function handleSubscriptionCreated(data: any, env: PaddleEnv, occurredAt: string) {
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
    return;
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
    return;
  }

  // Retries and out-of-order deliveries must not roll state backwards.
  const { shouldApplyEvent } = await import("@/lib/webhook-entitlement");
  const current = await existingUpdatedAt(mapped.row.paddle_subscription_id, env);
  if (!shouldApplyEvent(current, occurredAt)) {
    console.log("Skipping stale/duplicate subscription.created", mapped.row.paddle_subscription_id);
    return;
  }

  await getSupabase()
    .from("subscriptions")
    .upsert(mapped.row, { onConflict: "paddle_subscription_id" });
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv, occurredAt: string) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data ?? {};
  if (typeof id !== "string" || !id) {
    console.warn("Skipping subscription update without an id");
    return;
  }

  const { shouldApplyEvent, KNOWN_SUBSCRIPTION_STATUSES } =
    await import("@/lib/webhook-entitlement");
  if (typeof status !== "string" || !KNOWN_SUBSCRIPTION_STATUSES.includes(status as never)) {
    console.warn("Skipping subscription update with unknown status:", status);
    return;
  }
  if (!shouldApplyEvent(await existingUpdatedAt(id, env), occurredAt)) {
    console.log("Skipping stale/duplicate subscription update", id);
    return;
  }

  const item = items?.[0];
  const priceId = item?.price?.importMeta?.externalId;
  const productId = item?.product?.importMeta?.externalId;

  await getSupabase()
    .from("subscriptions")
    .update({
      status,
      ...(priceId ? { price_id: priceId } : {}),
      ...(productId ? { product_id: productId } : {}),
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: occurredAt,
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv, occurredAt: string) {
  if (typeof data?.id !== "string" || !data.id) return;
  const { shouldApplyEvent } = await import("@/lib/webhook-entitlement");
  if (!shouldApplyEvent(await existingUpdatedAt(data.id, env), occurredAt)) {
    console.log("Skipping stale/duplicate cancellation", data.id);
    return;
  }
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: occurredAt })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

async function refreshPeriodFromTransaction(data: any, env: PaddleEnv) {
  const subscriptionId = data?.subscriptionId;
  const period = data?.billingPeriod;
  if (!subscriptionId || !period?.endsAt) return;
  await getSupabase()
    .from("subscriptions")
    .update({
      current_period_start: period.startsAt ?? null,
      current_period_end: period.endsAt,
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env);
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  // Paddle stamps every event; fall back to arrival time if it is ever absent.
  const rawOccurredAt = (event as any)?.occurredAt ?? (event as any)?.occurred_at;
  const parsed = rawOccurredAt ? Date.parse(rawOccurredAt) : Number.NaN;
  const occurredAt = Number.isNaN(parsed)
    ? new Date().toISOString()
    : new Date(parsed).toISOString();

  if (!event?.data || typeof event.data !== "object") {
    throw new Error("Webhook payload is missing an event data object");
  }

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env, occurredAt);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env, occurredAt);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env, occurredAt);
      break;
    case EventName.TransactionCompleted: {
      // A renewal payment also refreshes the billing period, so keep the row in
      // step even if the matching subscription.updated event is delayed.
      await refreshPeriodFromTransaction(event.data, env);
      const { sendInvoiceEmail } = await import("@/lib/billing-emails.server");
      await sendInvoiceEmail(event.data, env);
      break;
    }
    case EventName.TransactionPaymentFailed: {
      const { sendPaymentFailedEmail } = await import("@/lib/billing-emails.server");
      await sendPaymentFailedEmail(event.data, env);
      break;
    }
    default: {
      // Lifecycle events that only change status/period reuse the update path.
      const lifecycle = new Set([
        "subscription.activated",
        "subscription.trialing",
        "subscription.past_due",
        "subscription.paused",
        "subscription.resumed",
        "subscription.imported",
      ]);
      if (lifecycle.has(event.eventType as string)) {
        await handleSubscriptionUpdated(event.data, env, occurredAt);
        break;
      }
      console.log("Unhandled event:", event.eventType);
    }
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          const { recordSystemEvent, describeError } = await import("@/lib/monitoring.server");
          await recordSystemEvent({
            source: "webhook",
            severity: "critical",
            event: "paddle.webhook_failed",
            message: describeError(e),
            context: { env, path: url.pathname },
          });
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
