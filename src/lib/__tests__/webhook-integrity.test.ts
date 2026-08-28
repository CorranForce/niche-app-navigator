import { beforeAll, describe, expect, it } from "vitest";
import {
  shouldApplyEvent,
  subscriptionRowFromEvent,
  type SubscriptionEventData,
} from "../webhook-entitlement";

beforeAll(() => {
  process.env["CHECKOUT_SIGNING_SECRET"] ||= "test-signing-secret-for-unit-tests";
});

// Imported lazily so the secret above is set before the module reads it.
const tokens = async () => await import("../checkout-token.server");

const iso = (msFromNow: number) => new Date(Date.now() + msFromNow).toISOString();

function event(overrides: Partial<SubscriptionEventData> = {}): SubscriptionEventData {
  return {
    id: "sub_1",
    customerId: "ctm_1",
    status: "trialing",
    currentBillingPeriod: { startsAt: iso(0), endsAt: iso(7 * 86_400_000) },
    items: [
      {
        price: { id: "pri_1", importMeta: { externalId: "pro_monthly" } },
        product: { id: "pro_1", importMeta: { externalId: "pro_plan" } },
      },
    ],
    ...overrides,
  };
}

describe("checkout intent token integrity", () => {
  it("accepts a freshly signed token", async () => {
    const { signCheckoutIntent, verifyCheckoutIntent } = await tokens();
    const token = signCheckoutIntent({ uid: "user-1", price: "pro_monthly", env: "sandbox" });
    const result = verifyCheckoutIntent(token);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.intent.uid).toBe("user-1");
  });

  it("rejects a token past its expiry", async () => {
    const { signCheckoutIntent, verifyCheckoutIntent, CHECKOUT_INTENT_TTL_SECONDS } =
      await tokens();
    const issuedAt = new Date();
    const token = signCheckoutIntent(
      { uid: "user-1", price: "pro_monthly", env: "sandbox" },
      issuedAt,
    );
    const afterExpiry = new Date(issuedAt.getTime() + (CHECKOUT_INTENT_TTL_SECONDS + 1) * 1000);
    expect(verifyCheckoutIntent(token, afterExpiry)).toEqual({ ok: false, reason: "expired" });
  });

  it("still accepts a token one second before expiry", async () => {
    const { signCheckoutIntent, verifyCheckoutIntent, CHECKOUT_INTENT_TTL_SECONDS } =
      await tokens();
    const issuedAt = new Date();
    const token = signCheckoutIntent({ uid: "u", price: "pro_monthly", env: "sandbox" }, issuedAt);
    const justBefore = new Date(issuedAt.getTime() + (CHECKOUT_INTENT_TTL_SECONDS - 1) * 1000);
    expect(verifyCheckoutIntent(token, justBefore).ok).toBe(true);
  });

  it("rejects a token whose payload was edited to extend the expiry", async () => {
    const { signCheckoutIntent, verifyCheckoutIntent } = await tokens();
    const token = signCheckoutIntent({ uid: "user-1", price: "pro_monthly", env: "sandbox" });
    const [body, sig] = token.split(".");
    const payload = JSON.parse(Buffer.from(body!, "base64url").toString("utf8"));
    payload.exp += 10 * 365 * 86_400;
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
    expect(verifyCheckoutIntent(forged)).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects a token re-pointed at another user", async () => {
    const { signCheckoutIntent, verifyCheckoutIntent } = await tokens();
    const token = signCheckoutIntent({ uid: "attacker", price: "pro_monthly", env: "sandbox" });
    const [body, sig] = token.split(".");
    const payload = JSON.parse(Buffer.from(body!, "base64url").toString("utf8"));
    payload.uid = "victim";
    const forged = `${Buffer.from(JSON.stringify(payload)).toString("base64url")}.${sig}`;
    expect(verifyCheckoutIntent(forged).ok).toBe(false);
  });

  it("rejects malformed and empty tokens", async () => {
    const { verifyCheckoutIntent } = await tokens();
    for (const bad of [undefined, null, "", "nodot", "a.b.c.d"]) {
      expect(verifyCheckoutIntent(bad as never).ok).toBe(false);
    }
  });
});

describe("webhook payload validation", () => {
  const ok = (data: SubscriptionEventData, intent?: { env?: string; price?: string }) =>
    subscriptionRowFromEvent(data, "sandbox", { userId: "user-1", intent: intent ?? null });


  it("maps a well-formed payload", () => {
    const result = ok(event());
    expect(result.ok).toBe(true);
  });

  it.each([
    ["missing subscription id", event({ id: "" }), "missing_subscription_id"],
    ["missing customer id", event({ customerId: "" }), "missing_subscription_id"],
    ["unknown status", event({ status: "wizard" }), "invalid_status"],
    ["non-array items", event({ items: {} as never }), "malformed_payload"],
    [
      "unmapped product",
      event({
        items: [
          {
            price: { importMeta: { externalId: "x_monthly" } },
            product: { importMeta: { externalId: "enterprise_plan" } },
          },
        ],
      }),
      "unknown_product",
    ],
    [
      "unparseable period",
      event({ currentBillingPeriod: { startsAt: "not-a-date", endsAt: iso(1000) } }),
      "invalid_period",
    ],
    [
      "period ending before it starts",
      event({ currentBillingPeriod: { startsAt: iso(10_000), endsAt: iso(0) } }),
      "invalid_period",
    ],
  ])("rejects %s", (_label, data, reason) => {
    expect(ok(data)).toEqual({ ok: false, reason });
  });

  it("rejects an intent minted for a different environment", () => {
    expect(ok(event(), { env: "live" })).toEqual({ ok: false, reason: "intent_env_mismatch" });
  });

  it("rejects an intent minted for a different price", () => {
    expect(ok(event(), { env: "sandbox", price: "solo_monthly" })).toEqual({
      ok: false,
      reason: "intent_price_mismatch",
    });
  });

  it("never attributes a purchase from customData.userId", () => {
    const spoofed = event({ customData: { userId: "victim" } });
    expect(subscriptionRowFromEvent(spoofed, "sandbox")).toEqual({
      ok: false,
      reason: "missing_user",
    });
  });
});

describe("idempotency and out-of-order delivery", () => {
  const t0 = "2026-01-01T00:00:00.000Z";
  const t1 = "2026-01-01T00:05:00.000Z";

  it("applies the first delivery", () => {
    expect(shouldApplyEvent(null, t0)).toBe(true);
  });

  it("skips an exact replay of the same event", () => {
    expect(shouldApplyEvent(t0, t0)).toBe(false);
  });

  it("applies a strictly newer event", () => {
    expect(shouldApplyEvent(t0, t1)).toBe(true);
  });

  it("skips an older event delivered after a newer one", () => {
    expect(shouldApplyEvent(t1, t0)).toBe(false);
  });

  it("skips events without a usable timestamp", () => {
    expect(shouldApplyEvent(t0, null)).toBe(false);
    expect(shouldApplyEvent(t0, "not-a-date")).toBe(false);
  });

  it("produces an identical row when the same event is mapped twice", () => {
    const now = new Date(t0);
    const a = subscriptionRowFromEvent(event(), "sandbox", { userId: "user-1", now });
    const b = subscriptionRowFromEvent(event(), "sandbox", { userId: "user-1", now });
    expect(a).toEqual(b);
  });
});
