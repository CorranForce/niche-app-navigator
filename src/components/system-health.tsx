import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Activity, Loader2, ShieldAlert } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSystemHealth } from "@/lib/admin-monitoring.functions";

function when(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SEVERITY_VARIANT: Record<string, "destructive" | "secondary" | "outline"> = {
  critical: "destructive",
  warning: "secondary",
  info: "outline",
};

export function SystemHealthSection() {
  const fetchHealth = useServerFn(getSystemHealth);
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-system-health"],
    queryFn: () => fetchHealth({ data: { days: 14 } }),
    retry: false,
    refetchInterval: 60_000,
  });

  return (
    <section id="monitoring" className="mt-10 scroll-mt-20">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Monitoring & alerts</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Payment webhook failures, sign-in/consent errors and MCP tool errors from the last 14 days.
        Critical events email you automatically (throttled to one per hour per failure type).
      </p>

      {error ? (
        <Card className="mt-4 flex items-center gap-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          {(error as Error).message}
        </Card>
      ) : null}

      {isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking system health…
        </p>
      ) : data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="gap-1 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Critical (14d)</p>
              <p className="font-mono text-2xl font-semibold">{data.totals.critical}</p>
            </Card>
            <Card className="gap-1 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Warnings (14d)</p>
              <p className="font-mono text-2xl font-semibold">{data.totals.warning}</p>
            </Card>
            <Card className="gap-1 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Noisiest source</p>
              <p className="font-mono text-2xl font-semibold">
                {data.bySource[0]?.source ?? "none"}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.bySource[0] ? `${data.bySource[0].total} events` : "All clear"}
              </p>
            </Card>
            <Card className="gap-1 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Busiest day</p>
              <p className="font-mono text-2xl font-semibold">
                {data.daily.length
                  ? [...data.daily].sort((a, b) => b.total - a.total)[0]!.total
                  : 0}
              </p>
              <p className="text-xs text-muted-foreground">events in a single day</p>
            </Card>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card className="gap-0 overflow-hidden border-border bg-surface p-0">
              <p className="label-mono border-b border-border px-4 py-3 text-muted-foreground">
                Most frequent failures
              </p>
              {data.topEvents.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Nothing has failed in the last 14 days.
                </p>
              ) : (
                <ul className="divide-y divide-border/60 font-mono text-xs">
                  {data.topEvents.map((row) => (
                    <li
                      key={`${row.source}:${row.event}`}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="truncate">
                        <span className="text-muted-foreground">{row.source}</span> · {row.event}
                      </span>
                      <span className="whitespace-nowrap text-muted-foreground">
                        {row.total} · {when(row.lastSeen)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-0 overflow-hidden border-border bg-surface p-0">
              <p className="label-mono border-b border-border px-4 py-3 text-muted-foreground">
                Recent events
              </p>
              {data.recent.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No events recorded.</p>
              ) : (
                <ul className="max-h-96 divide-y divide-border/60 overflow-y-auto font-mono text-xs">
                  {data.recent.map((row) => (
                    <li key={row.id} className="px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="truncate">{row.event}</span>
                        <Badge variant={SEVERITY_VARIANT[row.severity] ?? "outline"}>
                          {row.severity}
                        </Badge>
                      </div>
                      <p className="mt-1 truncate text-muted-foreground">
                        {when(row.createdAt)} · {row.message ?? "no detail"}
                        {row.alertedAt ? " · alerted" : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}
