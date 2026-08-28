import { describe, expect, it } from "vitest";
import {
  entitledPlan,
  limitForPlan,
  planFeatures,
  planForProductId,
  isPastDue,
  PLAN_RANK,
  TRIAL_DAYS,
  STUDIO_SEATS,
} from "../plan-limits";
import {
  entitlementFromEvent,
  entitlementForRow,
  subscriptionRowFromEvent,
  type SubscriptionEventData,
} from "../webhook-entitlement";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

function event(product: string, status = "trialing"): SubscriptionEventData {
  return {
    id: `sub_${product}`,
    customerId: "ctm_123",
    status,
    customData: { userId: "user-1" },
    currentBillingPeriod: { startsAt: inDays(0), endsAt: inDays(TRIAL_DAYS) },
    items: [
      {
        price: { id: "pri_x", importMeta: { externalId: `${product.split("_")[0]}_monthly` } },
        product: { id: "pro_x", importMeta: { externalId: product } },
      },
    ],
  };
}

describe("webhook → subscription row", () => {
  it("maps a trial subscription.created event to a row", () => {
    const result = subscriptionRowFromEvent(event("pro_plan"), "sandbox");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.row).toMatchObject({
      user_id: "user-1",
      product_id: "pro_plan",
      price_id: "pro_monthly",
      status: "trialing",
      environment: "sandbox",
    });
  });

  it("rejects events without a linked app user", () => {
    const bad = { ...event("pro_plan"), customData: null };
    expect(subscriptionRowFromEvent(bad, "sandbox")).toEqual({ ok: false, reason: "missing_user" });
  });

  it("rejects events missing catalog external ids", () => {
    const bad: SubscriptionEventData = {
      ...event("pro_plan"),
      items: [{ price: { id: "pri_x" }, product: { id: "pro_x" } }],
    };
    expect(subscriptionRowFromEvent(bad, "sandbox")).toEqual({
      ok: false,
      reason: "missing_external_ids",
    });
  });
});

describe("7-day trial entitlement per tier", () => {
  it.each([
    ["solo_plan", "solo", 10],
    ["pro_plan", "pro", 50],
    ["studio_plan", "studio", null],
  ] as const)("%s trialing grants %s access", (product, plan, limit) => {
    const ent = entitlementFromEvent(event(product), "sandbox");
    expect(ent?.plan).toBe(plan);
    expect(ent?.monthlyLimit).toBe(limit);
    expect(ent?.features.generate).toBe(true);
  });

  it("keeps full access for the whole trial window", () => {
    const ent = entitlementForRow({
      status: "trialing",
      product_id: "solo_plan",
      current_period_end: inDays(TRIAL_DAYS - 1),
    });
    expect(ent.plan).toBe("solo");
  });

  it("drops access when the trial lapses without conversion", () => {
    const ent = entitlementForRow({
      status: "canceled",
      product_id: "solo_plan",
      current_period_end: inDays(-1),
    });
    expect(ent.plan).toBe("none");
    expect(ent.features.generate).toBe(false);
  });
});

describe("tier-gated features", () => {
  it("Solo: generate only, no export / priority / team", () => {
    const f = planFeatures("solo");
    expect(f).toMatchObject({
      generate: true,
      markdownExport: false,
      priorityQueue: false,
      team: false,
      compare: false,
    });
  });

  it("Pro: adds markdown export and priority queue, still no team features", () => {
    const f = planFeatures("pro");
    expect(f).toMatchObject({
      generate: true,
      markdownExport: true,
      priorityQueue: true,
      team: false,
      compare: false,
    });
  });

  it("Studio: unlimited reports, shared library, compare and seats", () => {
    const f = planFeatures("studio");
    expect(f).toMatchObject({ team: true, compare: true, prioritySupport: true });
    expect(limitForPlan("studio")).toBeNull();
    expect(STUDIO_SEATS).toBe(5);
  });

  it("no plan gates everything off", () => {
    expect(planFeatures("none").generate).toBe(false);
    expect(limitForPlan("none")).toBe(0);
  });
});

describe("plan changes", () => {
  it("ranks tiers for upgrade / downgrade comparisons", () => {
    expect(PLAN_RANK.solo).toBeLessThan(PLAN_RANK.pro);
    expect(PLAN_RANK.pro).toBeLessThan(PLAN_RANK.studio);
  });

  it("applies the new product immediately once the webhook lands", () => {
    const upgraded = entitlementFromEvent(event("studio_plan", "active"), "sandbox");
    expect(upgraded?.plan).toBe("studio");
    const downgraded = entitlementFromEvent(event("solo_plan", "active"), "sandbox");
    expect(downgraded?.monthlyLimit).toBe(10);
  });

  it("cancellation keeps access until the period ends", () => {
    expect(
      entitledPlan({
        status: "canceled",
        product_id: "pro_plan",
        current_period_end: inDays(10),
      }),
    ).toBe("pro");
  });

  it("past_due pauses generation", () => {
    const ent = entitlementForRow({
      status: "past_due",
      product_id: "pro_plan",
      current_period_end: inDays(5),
    });
    expect(ent.plan).toBe("none");
    expect(isPastDue("past_due")).toBe(true);
  });

  it("unknown products never grant access", () => {
    expect(planForProductId("mystery_plan")).toBe("none");
    expect(planForProductId(null)).toBe("none");
  });
});
