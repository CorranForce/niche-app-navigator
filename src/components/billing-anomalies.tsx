import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminSectionError, LastRefreshed } from "@/components/admin-section-error";
import { getBillingAnomalies } from "@/lib/admin-anomalies.functions";

function fmtWhen(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function tone(severity: "critical" | "warning" | "info") {
  if (severity === "critical") return "border-destructive/40 bg-destructive/10";
  if (severity === "warning") return "border-primary/40 bg-primary/5";
  return "border-border bg-surface";
}

/** Highlights unusual MRR movement, failed payments and repeat charge failures. */
export function BillingAnomalies({
  environment = "sandbox",
}: {
  environment?: "sandbox" | "live";
}) {
  const fetchAnomalies = useServerFn(getBillingAnomalies);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["billing-anomalies", environment],
    queryFn: () => fetchAnomalies({ data: { environment } }),
    retry: false,
  });

  return (
    <section id="billing-anomalies" className="mt-10 scroll-mt-24">
      <div className="flex items-center gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Billing anomalies</h2>
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      {error ? (
        <Card className="mt-4 border-destructive/40 bg-destructive/10 p-4 text-sm">
          {(error as Error).message}
        </Card>
      ) : isLoading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Checking revenue and charge health…
        </p>
      ) : data ? (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="gap-1 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">MRR change (30d)</p>
              <p className="font-mono text-2xl font-semibold tracking-tight">
                {data.mrr.deltaPct === null
                  ? "—"
                  : `${data.mrr.deltaPct >= 0 ? "+" : ""}${data.mrr.deltaPct.toFixed(0)}%`}
              </p>
              <p className="text-xs text-muted-foreground">
                ${(data.mrr.previousCents / 100).toFixed(0)} → $
                {(data.mrr.currentCents / 100).toFixed(0)}
              </p>
            </Card>
            <Card className="gap-1 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Failed charges (30d)</p>
              <p className="font-mono text-2xl font-semibold tracking-tight">
                {data.failedTransactions30d}
              </p>
              <p className="text-xs text-muted-foreground">Past-due transactions at the provider</p>
            </Card>
            <Card className="gap-1 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Repeat failures</p>
              <p className="font-mono text-2xl font-semibold tracking-tight">
                {data.repeatFailures.length}
              </p>
              <p className="text-xs text-muted-foreground">Customers with 2+ failed attempts</p>
            </Card>
            <Card className="gap-1 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Churn (30d)</p>
              <p className="font-mono text-2xl font-semibold tracking-tight">
                {data.churn.canceled30d}
              </p>
              <p className="text-xs text-muted-foreground">
                {data.churn.newPaid30d} new paid · {data.churn.cancelScheduled} pending cancel
              </p>
            </Card>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            <Card className="gap-2 border-border bg-surface p-4">
              <p className="label-mono text-muted-foreground">Flags</p>
              {data.anomalies.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> Nothing unusual right now.
                </p>
              ) : (
                <ul className="space-y-2">
                  {data.anomalies.map((a) => (
                    <li key={a.id} className={`rounded-sm border p-3 text-sm ${tone(a.severity)}`}>
                      <p className="flex items-center gap-2 font-medium">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        {a.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">{a.detail}</p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="gap-0 overflow-hidden border-border bg-surface p-0">
              <p className="label-mono border-b border-border px-4 py-3 text-muted-foreground">
                Past-due accounts
              </p>
              {data.pastDue.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No past-due accounts.</p>
              ) : (
                <ul className="divide-y divide-border/60 font-mono text-xs">
                  {data.pastDue.map((p) => (
                    <li
                      key={p.userId}
                      className="flex items-center justify-between gap-3 px-4 py-3"
                    >
                      <span className="truncate">{p.email ?? p.userId}</span>
                      <span className="whitespace-nowrap text-muted-foreground">
                        since {fmtWhen(p.since)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {data.repeatFailures.length > 0 ? (
                <>
                  <p className="label-mono border-y border-border px-4 py-3 text-muted-foreground">
                    Recurring charge failures
                  </p>
                  <ul className="divide-y divide-border/60 font-mono text-xs">
                    {data.repeatFailures.map((r) => (
                      <li
                        key={r.customerId}
                        className="flex items-center justify-between gap-3 px-4 py-3"
                      >
                        <span className="truncate">{r.customerId}</span>
                        <span className="whitespace-nowrap text-destructive">
                          {r.failures} fails · {fmtWhen(r.lastFailedAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : null}
            </Card>
          </div>
        </>
      ) : null}
    </section>
  );
}
