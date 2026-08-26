import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, ShieldAlert } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getOwnerOverview } from "@/lib/admin-overview.functions";
import { OAuthHealthSection } from "@/components/oauth-health";
import { BillingAnomalies } from "@/components/billing-anomalies";
import { AdminCustomersSection } from "@/components/admin-customers";
import { AdminEmailLogSection } from "@/components/admin-email-log";
import { McpStatusSection } from "@/components/mcp-status";
import { SystemHealthSection } from "@/components/system-health";

export const Route = createFileRoute("/_authenticated/admin/")({
  head: () => ({
    meta: [
      { title: "Owner's dashboard — internal" },
      {
        name: "description",
        content:
          "Internal owner dashboard: accounts, plan mix, recurring revenue, billing anomalies, customers, auth health and email delivery in one place.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Owner's dashboard — internal" },
      { property: "og:description", content: "Internal business health snapshot." },
    ],
  }),
  component: OwnerDashboardPage,
});

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtWhen(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 border-border bg-surface p-4">
      <p className="label-mono text-muted-foreground">{label}</p>
      <p className="font-mono text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}

function OwnerDashboardPage() {
  const fetchOverview = useServerFn(getOwnerOverview);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["owner-overview"],
    queryFn: () => fetchOverview(),
    retry: false,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Owner's dashboard</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Business health across accounts, revenue, usage and sign-in reliability.
            </p>
          </div>
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {error ? (
          <Card className="mt-6 flex items-center gap-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            {(error as Error).message}
          </Card>
        ) : null}

        {isLoading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Crunching the numbers…
          </p>
        ) : data ? (
          <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Monthly recurring revenue"
                value={money(data.revenue.mrrCents)}
                hint={`${data.plans.pro} Pro · ${data.plans.studio} Studio`}
              />
              <Stat
                label="Total accounts"
                value={String(data.users.total)}
                hint={`${data.users.new7d} new in 7d · ${data.users.new30d} in 30d`}
              />
              <Stat
                label="Reports generated"
                value={String(data.reports.total)}
                hint={`${data.reports.last7d} in 7d · ${data.reports.last30d} in 30d`}
              />
              <Stat
                label="Sign-in failures (7d)"
                value={String(data.auth.failures7d)}
                hint={`of ${data.auth.events7d} tracked auth events`}
              />
            </section>

            <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Free accounts" value={String(data.plans.free)} />
              <Stat label="Paying customers" value={String(data.plans.pro + data.plans.studio)} />
              <Stat
                label="Past due"
                value={String(data.revenue.pastDue)}
                hint="Restricted to Free limits"
              />
              <Stat
                label="Cancels at period end"
                value={String(data.revenue.cancelScheduled)}
                hint="Access until renewal date"
              />
            </section>

            <section className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="Onboarding completed"
                value={`${data.users.onboarded}/${data.users.total}`}
              />
              <Card className="gap-2 border-border bg-surface p-4 sm:col-span-1 lg:col-span-3">
                <p className="label-mono text-muted-foreground">Jump to</p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline">
                    <a href="#billing-anomalies">Billing anomalies</a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="#customers">Customers</a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="#oauth-health">OAuth health</a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="#mcp">Agent integrations</a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="#monitoring">Monitoring</a>
                  </Button>
                  <Button asChild size="sm" variant="outline">
                    <a href="#emails">Emails</a>
                  </Button>
                </div>
              </Card>
            </section>

            <section className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card className="gap-0 overflow-hidden border-border bg-surface p-0">
                <p className="label-mono border-b border-border px-4 py-3 text-muted-foreground">
                  Newest accounts
                </p>
                {data.recentSignups.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No accounts yet.</p>
                ) : (
                  <ul className="divide-y divide-border/60 font-mono text-xs">
                    {data.recentSignups.map((u) => (
                      <li key={u.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="truncate">{u.email ?? u.id}</span>
                        <span className="whitespace-nowrap text-muted-foreground">
                          {fmtWhen(u.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="gap-0 overflow-hidden border-border bg-surface p-0">
                <p className="label-mono border-b border-border px-4 py-3 text-muted-foreground">
                  Latest reports
                </p>
                {data.recentReports.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No reports generated yet.</p>
                ) : (
                  <ul className="divide-y divide-border/60 font-mono text-xs">
                    {data.recentReports.map((r) => (
                      <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                        <span className="truncate">{r.niche}</span>
                        <span className="whitespace-nowrap text-muted-foreground">
                          {fmtWhen(r.createdAt)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </section>
          </>
        ) : null}

        <BillingAnomalies />

        <AdminCustomersSection />

        <OAuthHealthSection />

        <McpStatusSection />

        <SystemHealthSection />

        <AdminEmailLogSection />
      </main>
    </div>
  );
}
