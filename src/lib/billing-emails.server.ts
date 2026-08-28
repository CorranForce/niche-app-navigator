/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from "@supabase/supabase-js";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";
import { PLAN_LABELS, planForProductId } from "@/lib/plan-limits";
import type { PaddleEnv } from "@/lib/paddle.server";

let _admin: ReturnType<typeof createClient<any, any, any>> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient<any, any, any>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
    );
  }
  return _admin;
}

const APP_URL = process.env["APP_BASE_URL"] ?? "https://freedomopsai.dev";

function money(total: string | null | undefined, currency: string | null | undefined) {
  if (!total) return undefined;
  const value = Number(total) / 100;
  if (Number.isNaN(value)) return undefined;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency ?? "USD",
  }).format(value);
}

function day(value: string | null | undefined) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

/** Resolves the customer's account email + current plan from the local subscriptions table. */
async function resolveCustomer(customerId: string | null | undefined, env: PaddleEnv) {
  if (!customerId) return null;
  const { data: sub } = await admin()
    .from("subscriptions")
    .select("user_id, product_id, current_period_end")
    .eq("paddle_customer_id", customerId)
    .eq("environment", env)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.user_id) return null;

  const { data: userRes } = await admin().auth.admin.getUserById(sub.user_id as string);
  const email = userRes?.user?.email ?? null;
  if (!email) return null;

  return {
    email,
    planName: PLAN_LABELS[planForProductId(sub.product_id as string | null)],
    nextRenewalAt: day(sub.current_period_end as string | null),
  };
}

/** Sends the receipt / renewal confirmation after a completed Paddle transaction. */
export async function sendInvoiceEmail(data: any, env: PaddleEnv) {
  const customer = await resolveCustomer(data?.customerId, env);
  if (!customer) return;

  await sendTemplateEmail("invoice-receipt", customer.email, {
    idempotencyKey: `invoice-receipt-${data.id}`,
    templateData: {
      planName: customer.planName,
      amount: money(data?.details?.totals?.grandTotal, data?.currencyCode),
      invoiceNumber: data?.invoiceNumber ?? undefined,
      billedAt: day(data?.billedAt ?? data?.createdAt),
      nextRenewalAt: customer.nextRenewalAt,
      billingUrl: `${APP_URL}/account#billing`,
    },
  });
}

/** Sends the payment-failure notice with recovery steps after a failed Paddle charge. */
export async function sendPaymentFailedEmail(data: any, env: PaddleEnv) {
  const customer = await resolveCustomer(data?.customerId, env);
  if (!customer) return;

  await sendTemplateEmail("payment-failed", customer.email, {
    idempotencyKey: `payment-failed-${data.id}`,
    templateData: {
      planName: customer.planName,
      amount: money(data?.details?.totals?.grandTotal, data?.currencyCode),
      attemptedAt: day(data?.updatedAt ?? data?.createdAt),
      nextRetryAt: day(data?.payments?.[0]?.errorCode ? null : data?.nextRetryAt),
      billingUrl: `${APP_URL}/account#billing`,
    },
  });
}

export type SubscriptionChangeKind =
  "plan_changed" | "cancellation_scheduled" | "canceled" | "resumed" | "paused" | "past_due";

const CHANGE_COPY: Record<SubscriptionChangeKind, { headline: string; summary: string }> = {
  plan_changed: {
    headline: "Your plan change is confirmed",
    summary:
      "We updated your subscription. Plan changes take effect at your next renewal, and you keep your current limits until then.",
  },
  cancellation_scheduled: {
    headline: "Your subscription is scheduled to end",
    summary:
      "You cancelled your plan. You keep full access until the end of the period you already paid for, and you can resume any time before then.",
  },
  canceled: {
    headline: "Your subscription has ended",
    summary: "Your plan is now cancelled and no further charges will be made.",
  },
  resumed: {
    headline: "Your subscription is active again",
    summary: "We resumed your plan — it will keep renewing on your normal billing date.",
  },
  paused: {
    headline: "Your subscription is paused",
    summary: "Billing is paused, so report generation is unavailable until you resume.",
  },
  past_due: {
    headline: "Your subscription is past due",
    summary:
      "We couldn't take your latest payment, so access is restricted until the payment succeeds.",
  },
};

/**
 * Confirmation email for any change to a subscription that isn't a charge —
 * plan switches, cancellations, pauses and resumes. Charges themselves are
 * covered by the invoice receipt.
 */
export async function sendSubscriptionChangeEmail(
  data: any,
  env: PaddleEnv,
  kind: SubscriptionChangeKind,
  occurredAt: string,
) {
  const customer = await resolveCustomer(data?.customerId, env);
  if (!customer) return;
  const copy = CHANGE_COPY[kind];

  await sendTemplateEmail("subscription-changed", customer.email, {
    idempotencyKey: `subscription-${kind}-${data?.id}-${occurredAt}`,
    templateData: {
      headline: copy.headline,
      summary: copy.summary,
      planName: customer.planName,
      status: data?.status ?? undefined,
      effectiveAt:
        day(data?.scheduledChange?.effectiveAt) ??
        day(data?.currentBillingPeriod?.endsAt) ??
        customer.nextRenewalAt,
      billingUrl: `${APP_URL}/account#billing`,
    },
  });
}
