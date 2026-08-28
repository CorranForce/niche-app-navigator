import { describe, expect, it } from "vitest";
import {
  AGGREGATE_ROW_CAP,
  MAX_PAGE,
  MAX_PAGE_SIZE,
  MAX_REASON_CHARS,
  authAnalyticsInput,
  hasMorePages,
  pageRange,
  truncateReason,
} from "@/lib/auth-analytics-guards";

describe("admin auth-event log input validation", () => {
  it("defaults to a bounded first page", () => {
    expect(authAnalyticsInput.parse({})).toEqual({ days: 14, page: 0, pageSize: 25 });
  });

  it("rejects unknown keys so extra filters/columns can't be smuggled in", () => {
    for (const payload of [
      { select: "*" },
      { limit: 100000 },
      { user_id: "00000000-0000-0000-0000-000000000000" },
      { days: 7, order: "created_at.asc" },
    ]) {
      expect(() => authAnalyticsInput.parse(payload)).toThrow();
    }
  });

  it("rejects an oversized page size", () => {
    expect(() => authAnalyticsInput.parse({ pageSize: MAX_PAGE_SIZE + 1 })).toThrow();
    expect(() => authAnalyticsInput.parse({ pageSize: 100000 })).toThrow();
    expect(() => authAnalyticsInput.parse({ pageSize: Number.MAX_SAFE_INTEGER })).toThrow();
  });

  it("rejects deep or negative paging and non-integers", () => {
    expect(() => authAnalyticsInput.parse({ page: MAX_PAGE + 1 })).toThrow();
    expect(() => authAnalyticsInput.parse({ page: -1 })).toThrow();
    expect(() => authAnalyticsInput.parse({ page: 1.5 })).toThrow();
    expect(() => authAnalyticsInput.parse({ pageSize: 25.5 })).toThrow();
  });

  it("only allows the three published day windows", () => {
    for (const days of [7, 14, 30]) {
      expect(authAnalyticsInput.parse({ days }).days).toBe(days);
    }
    for (const days of [0, 1, 31, 365, 99999, -7]) {
      expect(() => authAnalyticsInput.parse({ days })).toThrow();
    }
  });

  it("caps total reachable rows well below the aggregation window", () => {
    const maxRows = (MAX_PAGE + 1) * MAX_PAGE_SIZE;
    expect(maxRows).toBeLessThanOrEqual(AGGREGATE_ROW_CAP);
  });
});

describe("pageRange", () => {
  it("computes an inclusive window of exactly pageSize rows", () => {
    const r = pageRange({ page: 2, pageSize: 25 });
    expect(r).toEqual({ page: 2, pageSize: 25, from: 50, to: 74 });
    expect(r.to - r.from + 1).toBe(25);
  });

  it("clamps values that bypassed validation (defence in depth)", () => {
    expect(pageRange({ page: 9999, pageSize: 9999 })).toEqual({
      page: MAX_PAGE,
      pageSize: MAX_PAGE_SIZE,
      from: MAX_PAGE * MAX_PAGE_SIZE,
      to: MAX_PAGE * MAX_PAGE_SIZE + MAX_PAGE_SIZE - 1,
    });
    expect(pageRange({ page: -5, pageSize: 1 })).toMatchObject({ page: 0, pageSize: 5, from: 0 });
  });

  it("never returns overlapping or gapped windows across pages", () => {
    let prevTo = -1;
    for (let page = 0; page <= MAX_PAGE; page += 1) {
      const { from, to } = pageRange({ page, pageSize: 25 });
      expect(from).toBe(prevTo + 1);
      prevTo = to;
    }
  });
});

describe("overexposure safeguards on returned rows", () => {
  it("truncates long failure reasons", () => {
    const long = "x".repeat(5000);
    expect(truncateReason(long)).toHaveLength(MAX_REASON_CHARS);
    expect(truncateReason(null)).toBeNull();
    expect(truncateReason("short")).toBe("short");
  });

  it("stops paging at the depth ceiling even when more rows exist", () => {
    expect(hasMorePages({ page: 0, from: 0, returned: 25, total: 500 })).toBe(true);
    expect(hasMorePages({ page: MAX_PAGE, from: 475, returned: 25, total: 100000 })).toBe(false);
    expect(hasMorePages({ page: 1, from: 25, returned: 10, total: 35 })).toBe(false);
    expect(hasMorePages({ page: 0, from: 0, returned: 0, total: 0 })).toBe(false);
  });
});
