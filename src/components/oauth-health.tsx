import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getAuthAnalytics } from "@/lib/auth-analytics.functions";

const RANGES = [7, 14, 30] as const;
type Range = (typeof RANGES)[number];

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad" | "good" | undefined;
}) {
  return (
    <Card className="gap-1 border-border bg-surface p-4">
      <p className="label-mono text-muted-foreground">{label}</p>
      <p
        className={`font-mono text-2xl font-semibold ${
          tone === "bad" ? "text-destructive" : tone === "good" ? "text-primary" : ""
        }`}
      >
        {value}
      </p>
    </Card>
  );
}

function Bar({ pct, tone = "primary" }: { pct: number; tone?: "primary" | "destructive" }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={tone === "destructive" ? "h-full bg-destructive" : "h-full bg-primary"}
        style={{ width: `${Math.min(100, Math.max(pct, pct > 0 ? 2 : 0))}%` }}
      />
    </div>
  );
}

function BucketList({
  rows,
  empty,
}: {
  rows: Array<{ key: string; total: number; failures: number; failureRate: number }>;
  empty: string;
}) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ul className="space-y-3 text-sm">
      {rows.map((row) => (
        <li key={row.key} className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate">{row.key}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {row.failures}/{row.total} · {row.failureRate}%
            </span>
          </div>
          <Bar pct={row.failureRate} tone="destructive" />
        </li>
      ))}
    </ul>
  );
}

export function OAuthHealthSection() {
  const [days, setDays] = useState<Range>(14);
  const [page, setPage] = useState(0);
  const pageSize = 25;
  const fetchAnalytics = useServerFn(getAuthAnalytics);

  const { data, isLoading, error } = useQuery({
    queryKey: ["auth-analytics", days, page],
    queryFn: () => fetchAnalytics({ data: { days, page, pageSize } }),
    retry: false,
  });


  const maxDaily = Math.max(1, ...(data?.daily.map((d) => d.starts) ?? [1]));

  return (
    <section id="oauth-health" className="mt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Google OAuth health</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Sign-in reliability from the auth telemetry stream.
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <Button
              key={r}
              size="sm"
              variant={r === days ? "default" : "outline"}
              onClick={() => {
                setDays(r);
                setPage(0);
              }}
            >
              {r}d
            </Button>
          ))}

        </div>
      </div>

      {isLoading ? (
        <div className="mt-6 flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading telemetry…
        </div>
      ) : error ? (
        <Card className="mt-6 flex-row items-start gap-3 border-destructive/40 bg-surface p-6">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" />
          <div>
            <p className="font-medium">{(error as Error).message}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              This section requires an admin role on your account.
            </p>
          </div>
        </Card>
      ) : data ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Stat label="Attempts" value={String(data.totals.starts)} />
            <Stat label="Signed in" value={String(data.totals.success)} tone="good" />
            <Stat
              label="Errors"
              value={String(data.totals.error)}
              tone={data.totals.error ? "bad" : undefined}
            />
            <Stat
              label="Timeouts"
              value={String(data.totals.timeout)}
              tone={data.totals.timeout ? "bad" : undefined}
            />
            <Stat
              label="Failure rate"
              value={`${data.failureRate}%`}
              tone={data.failureRate > 10 ? "bad" : undefined}
            />
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="gap-4 border-border bg-surface p-6">
              <h3 className="text-lg font-semibold">Failure rate by day</h3>
              <div className="space-y-2">
                {data.daily.map((d) => (
                  <div key={d.day} className="grid grid-cols-[80px_1fr_auto] items-center gap-3">
                    <span className="font-mono text-xs text-muted-foreground">
                      {d.day.slice(5)}
                    </span>
                    <div className="flex items-center gap-2">
                      <Bar pct={(d.starts / maxDaily) * 100} />
                      {d.error + d.timeout > 0 ? (
                        <span className="font-mono text-xs text-destructive">{d.failureRate}%</span>
                      ) : null}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {d.success}/{d.starts}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="gap-4 border-border bg-surface p-6">
              <h3 className="text-lg font-semibold">Drop-off funnel</h3>
              <div className="space-y-4">
                {data.funnel.map((step) => (
                  <div key={step.step} className="space-y-1">
                    <div className="flex items-baseline justify-between text-sm">
                      <span>{step.step}</span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {step.count} · {step.pctOfStart}%
                      </span>
                    </div>
                    <Bar pct={step.pctOfStart} />
                    {step.dropOff > 0 ? (
                      <p className="flex items-center gap-1 font-mono text-xs text-destructive">
                        <AlertTriangle className="h-3 w-3" /> −{step.dropOff} dropped here
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <Card className="gap-4 border-border bg-surface p-6">
              <h3 className="text-lg font-semibold">Top error reasons</h3>
              {data.reasons.length === 0 ? (
                <p className="text-sm text-muted-foreground">No failures in this window.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {data.reasons.map((r) => (
                    <li key={r.reason} className="flex items-start justify-between gap-3">
                      <span className="text-muted-foreground">{r.reason}</span>
                      <span className="font-mono text-xs">{r.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-4 border-border bg-surface p-6">
              <h3 className="text-lg font-semibold">By browser / platform</h3>
              <BucketList rows={data.userAgents} empty="No traffic yet." />
            </Card>

            <Card className="gap-4 border-border bg-surface p-6">
              <h3 className="text-lg font-semibold">By network range</h3>
              <BucketList rows={data.ipRanges} empty="No network data yet." />
            </Card>
          </div>

          <Card className="mt-6 gap-4 border-border bg-surface p-6">
            <h3 className="text-lg font-semibold">Recent events</h3>
            {data.recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing logged in this window.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="label-mono text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 font-normal">Time (UTC)</th>
                      <th className="py-2 pr-4 font-normal">Event</th>
                      <th className="py-2 pr-4 font-normal">Reason</th>
                      <th className="py-2 pr-4 font-normal">Client</th>
                      <th className="py-2 font-normal">Range</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((r, i) => (
                      <tr key={`${r.created_at}-${i}`} className="border-t border-border/60">
                        <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                          {r.created_at.slice(0, 16).replace("T", " ")}
                        </td>
                        <td
                          className={`py-2 pr-4 font-mono text-xs ${
                            r.event === "error" || r.event === "timeout" ? "text-destructive" : ""
                          }`}
                        >
                          {r.event}
                        </td>
                        <td className="py-2 pr-4 text-muted-foreground">{r.reason ?? "—"}</td>
                        <td className="py-2 pr-4 text-muted-foreground">{r.browser}</td>
                        <td className="py-2 font-mono text-xs text-muted-foreground">
                          {r.ip_prefix ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : null}
    </section>
  );
}
