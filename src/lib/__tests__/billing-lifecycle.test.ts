import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isManageable,
  isResumable,
  pickBillableSubscription,
  type SelectableSubscription,
} from "@/lib/subscription-select";
import { entitledPlan, planFeatures } from "@/lib/plan-limits";

const row = (over: Partial<SelectableSubscription>): SelectableSubscription => ({
  paddle_subscription_id: "sub_1",
  environment: "sandbox",
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("subscription selection", () => {
  it("prefers a live subscription over a newer canceled one", () => {
    const picked = pickBillableSubscription([
      row({ paddle_subscription_id: "new", status: "canceled", created_at: "2026-06-01T00:00:00Z" }),
      row({ paddle_subscription_id: "old", status: "active", created_at: "2026-01-01T00:00:00Z" }),
    ]);
    expect(picked?.paddle_subscription_id).toBe("old");
  });

  it("falls back to recency within the same status", () => {
    const picked = pickBillableSubscription([
      row({ paddle_subscription_id: "a", created_at: "2026-01-01T00:00:00Z" }),
      row({ paddle_subscription_id: "b", created_at: "2026-05-01T00:00:00Z" }),
    ]);
    expect(picked?.paddle_subscription_id).toBe("b");
  });

  it("returns null with no rows", () => {
    expect(pickBillableSubscription([])).toBeNull();
    expect(pickBillableSubscription(null)).toBeNull();
  });

  it("treats past_due as manageable but canceled/paused as not changeable", () => {
    expect(isManageable(row({ status: "past_due" }))).toBe(true);
    expect(isManageable(row({ status: "trialing" }))).toBe(true);
    expect(isManageable(row({ status: "canceled" }))).toBe(false);
    expect(isManageable(null)).toBe(false);
  });

  it("only offers resume for scheduled-to-end or paused subscriptions", () => {
    expect(isResumable(row({ cancel_at_period_end: true }))).toBe(true);
    expect(isResumable(row({ status: "paused" }))).toBe(true);
    expect(isResumable(row({ cancel_at_period_end: false }))).toBe(false);
    expect(isResumable(row({ status: "canceled", cancel_at_period_end: true }))).toBe(false);
  });
});

describe("entitlement lifecycle", () => {
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();

  it("cuts access as soon as a payment failure marks the row past_due", () => {
    const plan = entitledPlan({
      status: "past_due",
      product_id: "pro_plan",
      current_period_end: future,
    });
    expect(plan).toBe("none");
    expect(planFeatures(plan).generate).toBe(false);
  });

  it("keeps access for a scheduled cancellation until the period ends", () => {
    expect(
      entitledPlan({ status: "canceled", product_id: "studio_plan", current_period_end: future }),
    ).toBe("studio");
    expect(
      entitledPlan({ status: "canceled", product_id: "studio_plan", current_period_end: past }),
    ).toBe("none");
  });

  it("revokes inherited Studio seats once the owner's period ends", () => {
    // Teammates inherit the owner's row; when it lapses, the inherited plan lapses too.
    const ownerLapsed = {
      status: "canceled",
      product_id: "studio_plan",
      current_period_end: past,
    };
    expect(entitledPlan(ownerLapsed)).toBe("none");
    expect(planFeatures(entitledPlan(ownerLapsed)).team).toBe(false);
  });

  it("treats paused subscriptions as no access", () => {
    expect(
      entitledPlan({ status: "paused", product_id: "pro_plan", current_period_end: future }),
    ).toBe("none");
  });
});

describe("webhook payment-failure handling", () => {
  const source = readFileSync(
    resolve(process.cwd(), "src/lib/webhook-apply.server.ts"),
    "utf8",
  );

  it("restricts the subscription on transaction.payment_failed", () => {
    expect(source).toContain("markPastDueFromFailedPayment");
    expect(source).toMatch(/status:\s*"past_due"/);
  });

  it("only downgrades live subscriptions, never revives canceled ones", () => {
    expect(source).toContain('if (status !== "active" && status !== "trialing")');
  });
});

describe("plan-change timing", () => {
  const source = readFileSync(resolve(process.cwd(), "src/lib/payments.functions.ts"), "utf8");

  it("schedules plan changes for the next billing period", () => {
    expect(source).toContain('prorationBillingMode: "full_next_billing_period"');
  });

  it("cancels at period end and can clear the scheduled change", () => {
    expect(source).toContain('effectiveFrom: "next_billing_period"');
    expect(source).toContain("scheduledChange: null");
  });

  it("selects the subscription by liveness rather than raw recency", () => {
    expect(source).toContain("pickBillableSubscription");
    expect(source).not.toMatch(/order\("created_at", \{ ascending: false \}\)\s*\n\s*\.limit\(1\)/);
  });
});
