import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FlaskConical, Loader2, RefreshCw, Zap } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AdminErrorFallback } from "@/components/admin-error-fallback";
import { getOwnerOverview } from "@/lib/admin-overview.functions";
import { OAuthHealthSection } from "@/components/oauth-health";
import { BillingAnomalies } from "@/components/billing-anomalies";
import { AdminCustomersSection } from "@/components/admin-customers";
import { AdminEmailLogSection } from "@/components/admin-email-log";
import { McpStatusSection } from "@/components/mcp-status";
import { SystemHealthSection } from "@/components/system-health";
import { WebhookReplaySection } from "@/components/webhook-replay";

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
  errorComponent: AdminErrorFallback,
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

const ENVIRONMENT_QUERY_KEYS = [
  "owner-overview",
  "billing-anomalies",
  "admin-users",
  "admin-paddle-events",
  "admin-webhook-replays",
];

function OwnerDashboardPage() {
  const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
  const [pendingEnvironment, setPendingEnvironment] = useState<"sandbox" | "live" | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const fetchOverview = useServerFn(getOwnerOverview);
  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["owner-overview", environment],
    queryFn: () => fetchOverview({ data: { environment } }),
    retry: false,
  });

  const isLive = environment === "live";

  async function refreshEnvironmentData() {
    setIsRefreshing(true);
    try {
      await Promise.all(
        ENVIRONMENT_QUERY_KEYS.map((key) =>
          queryClient.refetchQueries({ queryKey: [key], type: "active" }),
        ),
      );
    } finally {
      setIsRefreshing(false);
    }
  }

  function applyEnvironment(next: "sandbox" | "live") {
    setEnvironment(next);
    setPendingEnvironment(null);
    // Re-fetch after React commits the new environment so keys are current.
    setTimeout(() => void refreshEnvironmentData(), 0);
  }

  const busy = isFetching || isRefreshing;

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
          <div className="ml-auto flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <Label
              htmlFor="data-environment"
              className={`label-mono cursor-pointer ${
                environment === "sandbox" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Test data
            </Label>
            <Switch
              id="data-environment"
              checked={environment === "live"}
              onCheckedChange={(checked) => setPendingEnvironment(checked ? "live" : "sandbox")}
              aria-label="Toggle between test and live data"
            />
            <Label
              htmlFor="data-environment"
              className={`label-mono cursor-pointer ${
                environment === "live" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Live data
            </Label>
          </div>
          <Button variant="ghost" onClick={() => void refreshEnvironmentData()} disabled={busy}>
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} /> Refresh data
          </Button>
        </div>

        <Card
          className={`mt-4 flex-row items-center gap-3 p-4 ${
            isLive
              ? "border-destructive/40 bg-destructive/10"
              : "border-primary/40 bg-primary/10"
          }`}
        >
          {isLive ? (
            <Zap className="h-4 w-4 shrink-0 text-destructive" />
          ) : (
            <FlaskConical className="h-4 w-4 shrink-0 text-primary" />
          )}
          <div className="text-sm">
            <p className="font-medium">
              {isLive ? "Live payment environment" : "Test payment environment"}
            </p>
            <p className="text-muted-foreground">
              {isLive
                ? "Showing real customers, real charges and live subscription data."
                : "Showing sandbox customers and test-mode payments only — no real money involved."}
            </p>
          </div>
        </Card>

        <AlertDialog
          open={pendingEnvironment !== null}
          onOpenChange={(open) => {
            if (!open) setPendingEnvironment(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {pendingEnvironment === "live" ? "Switch to live data?" : "Switch to test data?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingEnvironment === "live"
                  ? "You'll see real customers, real revenue and live subscriptions. Any action taken here affects paying customers."
                  : "You'll see sandbox customers and test-mode payments only. Live revenue and customers will be hidden."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay on {isLive ? "live" : "test"}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => applyEnvironment(pendingEnvironment ?? environment)}
              >
                Switch and refresh
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>


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
                hint={`${data.plans.solo} Solo · ${data.plans.pro} Pro · ${data.plans.studio} Studio`}
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
              <Stat label="No active plan" value={String(data.plans.none)} />
              <Stat
                label="Paying customers"
                value={String(data.plans.solo + data.plans.pro + data.plans.studio)}
              />
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
                  <Button asChild size="sm" variant="outline">
                    <Link to="/admin/security">Security status</Link>
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

        <BillingAnomalies environment={environment} />

        <AdminCustomersSection environment={environment} />

        <OAuthHealthSection />

        <McpStatusSection />

        <SystemHealthSection />

        <WebhookReplaySection />

        <AdminEmailLogSection />
      </main>
    </div>
  );
}
