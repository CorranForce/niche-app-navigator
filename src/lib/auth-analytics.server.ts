/**
 * Server-only aggregation helpers for Google OAuth telemetry (public.auth_events).
 * Rows are fetched with the service-role client (the table is deny-by-default for
 * every Data API role) and aggregated in memory — telemetry volume is small.
 */

export type AuthEventName = "start" | "success" | "error" | "timeout" | "redirected";

export type AuthEventRow = {
  event: AuthEventName;
  reason: string | null;
  user_agent: string | null;
  ip_prefix: string | null;
  created_at: string;
};

export type Bucket = { key: string; total: number; failures: number; failureRate: number };

export type AuthAnalytics = {
  days: number;
  totals: { starts: number; redirected: number; success: number; error: number; timeout: number };
  failureRate: number;
  daily: Array<{
    day: string;
    starts: number;
    success: number;
    error: number;
    timeout: number;
    failureRate: number;
  }>;
  reasons: Array<{ reason: string; count: number }>;
  funnel: Array<{ step: string; count: number; pctOfStart: number; dropOff: number }>;
  userAgents: Bucket[];
  ipRanges: Bucket[];
  recent: Array<{
    created_at: string;
    event: AuthEventName;
    reason: string | null;
    browser: string;
    ip_prefix: string | null;
  }>;
};

const FAILURES: AuthEventName[] = ["error", "timeout"];

function rate(failures: number, total: number) {
  return total > 0 ? Math.round((failures / total) * 1000) / 10 : 0;
}

/** Collapse a raw user-agent into a coarse browser + platform label. */
export function browserLabel(ua: string | null): string {
  if (!ua) return "Unknown";
  const platform = /iPhone|iPad|iPod/i.test(ua)
    ? "iOS"
    : /Android/i.test(ua)
      ? "Android"
      : /Macintosh|Mac OS X/i.test(ua)
        ? "macOS"
        : /Windows/i.test(ua)
          ? "Windows"
          : /Linux|X11/i.test(ua)
            ? "Linux"
            : "Other";
  const browser = /Edg\//i.test(ua)
    ? "Edge"
    : /OPR\/|Opera/i.test(ua)
      ? "Opera"
      : /Firefox\//i.test(ua)
        ? "Firefox"
        : /Chrome\//i.test(ua)
          ? "Chrome"
          : /Safari\//i.test(ua)
            ? "Safari"
            : /HeadlessChrome|bot|crawl|spider/i.test(ua)
              ? "Bot/Headless"
              : "Other";
  return `${browser} · ${platform}`;
}

function bucketize(rows: AuthEventRow[], keyOf: (r: AuthEventRow) => string, limit = 10): Bucket[] {
  const map = new Map<string, { total: number; failures: number }>();
  for (const row of rows) {
    const key = keyOf(row);
    const entry = map.get(key) ?? { total: 0, failures: 0 };
    entry.total += 1;
    if (FAILURES.includes(row.event)) entry.failures += 1;
    map.set(key, entry);
  }
  return [...map.entries()]
    .map(([key, v]) => ({
      key,
      total: v.total,
      failures: v.failures,
      failureRate: rate(v.failures, v.total),
    }))
    .sort((a, b) => b.failures - a.failures || b.total - a.total)
    .slice(0, limit);
}

export function aggregate(rows: AuthEventRow[], days: number): AuthAnalytics {
  const count = (e: AuthEventName) => rows.filter((r) => r.event === e).length;
  const totals = {
    starts: count("start"),
    redirected: count("redirected"),
    success: count("success"),
    error: count("error"),
    timeout: count("timeout"),
  };
  const failures = totals.error + totals.timeout;
  const attempts = Math.max(totals.starts, totals.redirected, totals.success + failures);

  // Daily series, oldest first, including empty days.
  const byDay = new Map<string, AuthEventRow[]>();
  for (const row of rows) {
    const day = row.created_at.slice(0, 10);
    byDay.set(day, [...(byDay.get(day) ?? []), row]);
  }
  const daily: AuthAnalytics["daily"] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    const dayRows = byDay.get(day) ?? [];
    const c = (e: AuthEventName) => dayRows.filter((r) => r.event === e).length;
    const dErr = c("error");
    const dTimeout = c("timeout");
    const dStarts = Math.max(c("start"), c("success") + dErr + dTimeout);
    daily.push({
      day,
      starts: dStarts,
      success: c("success"),
      error: dErr,
      timeout: dTimeout,
      failureRate: rate(dErr + dTimeout, dStarts),
    });
  }

  const reasonMap = new Map<string, number>();
  for (const row of rows) {
    if (!FAILURES.includes(row.event)) continue;
    const key = (row.reason ?? "Unspecified").slice(0, 120);
    reasonMap.set(key, (reasonMap.get(key) ?? 0) + 1);
  }
  const reasons = [...reasonMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  // Funnel: click -> redirect to Google -> callback resolved -> signed in.
  const resolved = totals.success + failures;
  const steps: Array<{ step: string; count: number }> = [
    { step: "Clicked Google", count: totals.starts },
    { step: "Redirected to Google", count: totals.redirected },
    { step: "Callback resolved", count: resolved },
    { step: "Signed in", count: totals.success },
  ];
  const base = steps[0]!.count || 1;
  const funnel = steps.map((s, i) => ({
    step: s.step,
    count: s.count,
    pctOfStart: Math.round((s.count / base) * 1000) / 10,
    dropOff: i === 0 ? 0 : Math.max(0, steps[i - 1]!.count - s.count),
  }));

  return {
    days,
    totals,
    failureRate: rate(failures, attempts),
    daily,
    reasons,
    funnel,
    userAgents: bucketize(rows, (r) => browserLabel(r.user_agent)),
    ipRanges: bucketize(rows, (r) => r.ip_prefix ?? "Unknown"),
    recent: rows
      .slice()
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 25)
      .map((r) => ({
        created_at: r.created_at,
        event: r.event,
        reason: r.reason,
        browser: browserLabel(r.user_agent),
        ip_prefix: r.ip_prefix,
      })),
  };
}
