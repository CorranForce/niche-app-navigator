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
      billingUrl: `${APP_URL}/billing`,
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
      billingUrl: `${APP_URL}/billing`,
    },
  });
}
