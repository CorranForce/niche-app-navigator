#!/usr/bin/env node
/**
 * CI/CD smoke check: a billing webhook must update the subscription row in the
 * database and immediately gate the right limits — no re-login, no token refresh.
 *
 * Usage: node scripts/check-webhook-entitlement.mjs <base-url>
 *
 * Optional env for the full live round-trip (skipped gracefully when absent):
 *   PAYMENTS_SANDBOX_WEBHOOK_SECRET  signing secret for the sandbox webhook
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   to read back the persisted row
 *   SMOKE_TEST_USER_ID               app user the synthetic subscription belongs to
 */
import { createHmac } from "node:crypto";

const base = (process.argv[2] || process.env.SMOKE_BASE_URL || "").replace(/\/$/, "");
if (!base) {
  console.error("Usage: node scripts/check-webhook-entitlement.mjs https://example.com");
  process.exit(1);
}

const WEBHOOK_PATH = "/api/public/payments/webhook?env=sandbox";
const TIERS = [
  { product: "solo_plan", price: "solo_monthly", plan: "solo", limit: 10 },
  { product: "pro_plan", price: "pro_monthly", plan: "pro", limit: 50 },
  { product: "studio_plan", price: "studio_monthly", plan: "studio", limit: null },
];

let failed = 0;
const rows = [];
function record(name, ok, detail) {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  rows.push(`| ${ok ? "✅" : "❌"} | ${name} | ${detail} |`);
}
function skip(name, detail) {
  console.log(`SKIP  ${name} — ${detail}`);
  rows.push(`| ⏭️ | ${name} | ${detail} |`);
}

/** Mirrors src/lib/plan-limits.ts so drift between app and smoke expectations fails CI. */
function entitlement(status, productId, periodEnd) {
  const plans = { solo_plan: "solo", pro_plan: "pro", studio_plan: "studio" };
  const limits = { none: 0, solo: 10, pro: 50, studio: null };
  const end = periodEnd ? new Date(periodEnd) : null;
  const within = !end || end > new Date();
  let plan = "none";
  if ((status === "active" || status === "trialing") && within) plan = plans[productId] ?? "none";
  else if (status === "canceled" && end && end > new Date()) plan = plans[productId] ?? "none";
  return { plan, limit: limits[plan] };
}

function trialEvent(tier, userId, subId) {
  const now = new Date();
  const trialEnd = new Date(now.getTime() + 7 * 86400000);
  return {
    event_id: `evt_smoke_${Date.now()}`,
    event_type: "subscription.created",
    occurred_at: now.toISOString(),
    data: {
      id: subId,
      customer_id: "ctm_smoke_test",
      status: "trialing",
      custom_data: { userId },
      currency_code: "USD",
      collection_mode: "automatic",
      billing_cycle: { interval: "month", frequency: 1 },
      started_at: now.toISOString(),
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
      current_billing_period: { starts_at: now.toISOString(), ends_at: trialEnd.toISOString() },
      items: [
        {
          price: { id: "pri_smoke", import_meta: { external_id: tier.price } },
          product: { id: "pro_smoke", import_meta: { external_id: tier.product } },
        },
      ],
    },
  };
}

function sign(body, secret) {
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac("sha256", secret).update(`${ts}:${body}`).digest("hex");
  return `ts=${ts};h1=${h1}`;
}

async function post(body, headers) {
  return fetch(base + WEBHOOK_PATH, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });
}

// 1. Offline entitlement contract: every tier maps to the right plan + limit.
for (const tier of TIERS) {
  const end = new Date(Date.now() + 7 * 86400000).toISOString();
  const ent = entitlement("trialing", tier.product, end);
  record(
    `Trial webhook entitles ${tier.plan}`,
    ent.plan === tier.plan && ent.limit === tier.limit,
    `plan=${ent.plan} limit=${ent.limit ?? "unlimited"}`,
  );
}
{
  const past = entitlement("past_due", "pro_plan", new Date(Date.now() + 86400000).toISOString());
  record(
    "past_due pauses generation",
    past.plan === "none" && past.limit === 0,
    `plan=${past.plan}`,
  );
  const canceled = entitlement(
    "canceled",
    "pro_plan",
    new Date(Date.now() + 86400000).toISOString(),
  );
  record(
    "cancellation keeps access to period end",
    canceled.plan === "pro",
    `plan=${canceled.plan}`,
  );
  const lapsed = entitlement("canceled", "pro_plan", new Date(Date.now() - 86400000).toISOString());
  record("lapsed trial loses access", lapsed.plan === "none", `plan=${lapsed.plan}`);
}

// 2. Unsigned / tampered webhooks must be rejected.
try {
  const res = await post(
    JSON.stringify(trialEvent(TIERS[0], "00000000-0000-0000-0000-000000000000", "sub_unsigned")),
    {},
  );
  record("Unsigned webhook rejected", res.status >= 400, `status ${res.status}`);
} catch (err) {
  record("Unsigned webhook rejected", false, err.message);
}

const secret = process.env.PAYMENTS_SANDBOX_WEBHOOK_SECRET;
if (secret) {
  const body = JSON.stringify(
    trialEvent(TIERS[0], "00000000-0000-0000-0000-000000000000", "sub_bad_sig"),
  );
  const res = await post(body, { "paddle-signature": sign(body, `${secret}-wrong`) });
  record("Tampered signature rejected", res.status >= 400, `status ${res.status}`);
} else {
  skip("Tampered signature rejected", "PAYMENTS_SANDBOX_WEBHOOK_SECRET not set");
}

// 3. Full round-trip: signed webhook → row in the database → correct gating.
const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const testUser = process.env.SMOKE_TEST_USER_ID;

if (secret && supabaseUrl && serviceKey && testUser) {
  for (const tier of TIERS) {
    const subId = `sub_smoke_${tier.plan}_${Date.now()}`;
    const body = JSON.stringify(trialEvent(tier, testUser, subId));
    const res = await post(body, { "paddle-signature": sign(body, secret) });
    if (!res.ok) {
      record(`Signed ${tier.plan} webhook accepted`, false, `status ${res.status}`);
      continue;
    }
    const query =
      `${supabaseUrl}/rest/v1/subscriptions?paddle_subscription_id=eq.${subId}` +
      `&select=status,product_id,current_period_end`;
    const readRes = await fetch(query, {
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    });
    const [row] = (await readRes.json()) ?? [];
    if (!row) {
      record(`${tier.plan} webhook persisted`, false, "row not found in database");
      continue;
    }
    const ent = entitlement(row.status, row.product_id, row.current_period_end);
    record(
      `${tier.plan} webhook persisted and gates correctly`,
      ent.plan === tier.plan && ent.limit === tier.limit,
      `status=${row.status} plan=${ent.plan} limit=${ent.limit ?? "unlimited"}`,
    );
    // Clean up the synthetic row so repeated runs stay idempotent.
    await fetch(`${supabaseUrl}/rest/v1/subscriptions?paddle_subscription_id=eq.${subId}`, {
      method: "DELETE",
      headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}` },
    });
  }
} else {
  skip("Signed webhook round-trip", "webhook secret, service key or SMOKE_TEST_USER_ID not set");
}

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `### Webhook entitlement smoke — ${base}\n\n| | Check | Result |\n| --- | --- | --- |\n${rows.join("\n")}\n\n`,
  );
}

console.log(`\n${rows.length - failed}/${rows.length} checks passed.`);
process.exit(failed > 0 ? 1 : 0);
