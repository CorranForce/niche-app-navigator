import { describe, expect, it } from "vitest";
import { aggregate, browserLabel, type AuthEventRow } from "../auth-analytics.server";

const row = (event: AuthEventRow["event"], extra: Partial<AuthEventRow> = {}): AuthEventRow => ({
  event,
  reason: null,
  user_agent: null,
  ip_prefix: null,
  created_at: "2026-08-20T10:00:00.000Z",
  ...extra,
});

describe("browserLabel", () => {
  it("returns Unknown for missing user agents", () => {
    expect(browserLabel(null)).toBe("Unknown");
  });

  it("detects Chrome on Windows", () => {
    const ua =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    expect(browserLabel(ua)).toContain("Chrome");
    expect(browserLabel(ua)).toContain("Windows");
  });

  it("detects Safari on iOS", () => {
    const ua =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1";
    expect(browserLabel(ua)).toContain("Safari");
    expect(browserLabel(ua)).toContain("iOS");
  });
});

describe("aggregate", () => {
  it("returns zeroed totals for no rows", () => {
    const out = aggregate([], 7);
    expect(out.totals.starts).toBe(0);
    expect(out.failureRate).toBe(0);
    expect(out.days).toBe(7);
  });

  it("counts events and computes a failure rate", () => {
    const out = aggregate(
      [
        row("start"),
        row("start"),
        row("redirected"),
        row("success"),
        row("timeout", { reason: "popup closed" }),
      ],
      7,
    );
    expect(out.totals.starts).toBe(2);
    expect(out.totals.success).toBe(1);
    expect(out.totals.timeout).toBe(1);
    expect(out.failureRate).toBeGreaterThan(0);
  });

  it("ranks failure reasons", () => {
    const out = aggregate(
      [row("error", { reason: "blocked" }), row("error", { reason: "blocked" }), row("timeout", { reason: "slow" })],
      7,
    );
    expect(out.reasons[0]?.reason).toBe("blocked");
    expect(out.reasons[0]?.count).toBe(2);
  });
});
