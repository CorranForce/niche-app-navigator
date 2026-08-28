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

async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { subscriptionRowFromEvent } = await import("@/lib/webhook-entitlement");
  const mapped = subscriptionRowFromEvent(data, env);
  if (!mapped.ok) {
    console.warn("Skipping subscription webhook:", mapped.reason);
    return;
  }
  await getSupabase()
    .from("subscriptions")
    .upsert(mapped.row, { onConflict: "paddle_subscription_id" });
}

async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange, items } = data;

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
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
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

  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      await handleSubscriptionCreated(event.data, env);
      break;
    case EventName.SubscriptionUpdated:
      await handleSubscriptionUpdated(event.data, env);
      break;
    case EventName.SubscriptionCanceled:
      await handleSubscriptionCanceled(event.data, env);
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
        await handleSubscriptionUpdated(event.data, env);
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
