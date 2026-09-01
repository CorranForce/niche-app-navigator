import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminSectionError } from "@/components/admin-section-error";
import { getPaymentsFeed } from "@/lib/admin-payments.functions";

function money(cents: number, currency: string) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency }).format(cents / 100);
}

function fmtDate(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function tone(status: string | null) {
  if (!status) return "text-muted-foreground";
  if (["completed", "active", "trialing", "billed"].includes(status)) return "text-primary";
  if (["past_due", "canceled", "payment_failed"].includes(status)) return "text-destructive";
  return "text-muted-foreground";
}

/** Live payments feed: each customer's Paddle transaction and subscription state. */
export function LivePaymentsSection({ environment }: { environment: "sandbox" | "live" }) {
  const fetchFeed = useServerFn(getPaymentsFeed);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-payments-feed", environment],
    queryFn: () => fetchFeed({ data: { environment, limit: 30 } }),
    retry: false,
  });

  return (
    <Card id="payments" className="mt-6 scroll-mt-24 gap-4 border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">
            {environment === "live" ? "Live payments" : "Test payments"}
          </h2>
          <p className="text-sm text-muted-foreground">
            Read straight from Paddle: each customer's most recent transaction and the current
            subscription status behind it.
          </p>
        </div>
        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error ? (
        <AdminSectionError
          title="Payments unavailable"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading payments…</p>
      ) : !data || data.rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No transactions in this environment yet. Live transactions appear here after the first
          real checkout completes.
        </p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md border border-border p-3">
              <p className="label-mono text-muted-foreground">Collected</p>
              <p className="font-mono text-xl font-semibold">
                {money(data.totals.collectedCents, data.totals.currency)}
              </p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="label-mono text-muted-foreground">Active / trialing</p>
              <p className="font-mono text-xl font-semibold">{data.totals.activeSubscriptions}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <p className="label-mono text-muted-foreground">Problem transactions</p>
              <p className="font-mono text-xl font-semibold">{data.totals.failed}</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="label-mono text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4 font-normal">Customer</th>
                  <th className="py-2 pr-4 font-normal">Transaction</th>
                  <th className="py-2 pr-4 font-normal">Plan</th>
                  <th className="py-2 pr-4 font-normal">Subscription</th>
                  <th className="py-2 pr-4 font-normal">Renews</th>
                  <th className="py-2 pr-4 text-right font-normal">Amount</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.transactionId} className="border-t border-border/60">
                    <td className="py-2 pr-4">
                      <span className="font-mono text-xs">{r.customerLabel}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {fmtDate(r.billedAt)}
                      </span>
                    </td>
                    <td className={`py-2 pr-4 font-mono text-xs ${tone(r.status)}`}>
                      {r.status}
                      <span className="block text-[11px] text-muted-foreground">
                        {r.invoiceNumber ?? r.transactionId}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.planLabel ?? "—"}</td>
                    <td className={`py-2 pr-4 font-mono text-xs ${tone(r.subscriptionStatus)}`}>
                      {r.subscriptionStatus ?? "—"}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{fmtDate(r.nextBilledAt)}</td>
                    <td className="py-2 pr-4 text-right font-mono text-xs">
                      {money(r.amountCents, r.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}
