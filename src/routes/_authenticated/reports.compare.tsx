import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listReports, compareReports } from "@/lib/reports.functions";
import { useSubscription } from "@/hooks/use-subscription";
import { planFeatures } from "@/lib/plan-limits";
import type { SolutionReport } from "@/lib/report-schema";

export const Route = createFileRoute("/_authenticated/reports/compare")({
  head: () => ({
    meta: [
      { title: "Compare niches — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Put two or three niche reports side by side and compare pain severity, concepts and pricing.",
      },
      { property: "og:title", content: "Compare niches — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content: "Side-by-side niche comparison for Studio subscribers.",
      },
    ],
  }),
  component: ComparePage,
});

function ComparePage() {
  const { plan, loading } = useSubscription();
  const canCompare = planFeatures(plan).compare;
  const fetchReports = useServerFn(listReports);
  const runCompare = useServerFn(compareReports);
  const [selected, setSelected] = useState<string[]>([]);

  const { data: reports } = useQuery({ queryKey: ["reports"], queryFn: () => fetchReports() });

  const { data: comparison, isFetching } = useQuery({
    queryKey: ["compare", selected],
    enabled: canCompare && selected.length >= 2,
    queryFn: () => runCompare({ data: { ids: selected } }),
  });

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id],
    );
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <Link
          to="/reports"
          className="label-mono inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All reports
        </Link>
        <h1 className="mt-6 text-3xl font-semibold">Compare niches</h1>
        <p className="mt-2 text-muted-foreground">
          Pick two or three reports to line up their pain severity, concepts and pricing.
        </p>

        {loading ? null : !canCompare ? (
          <Card className="mt-8 items-start gap-3 border-border bg-surface p-8">
            <Lock className="h-5 w-5 text-primary" />
            <p className="text-sm text-muted-foreground">
              Side-by-side comparison is part of the Studio plan.
            </p>
            <Button asChild>
              <Link to="/account" hash="billing">
                Upgrade to Studio
              </Link>
            </Button>
          </Card>
        ) : (
          <>
            <div className="mt-8 flex flex-wrap gap-2">
              {(reports ?? []).map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id)}
                  className={`label-mono rounded-sm border px-3 py-1.5 transition-colors ${
                    selected.includes(r.id)
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary"
                  }`}
                >
                  {r.niche}
                </button>
              ))}
            </div>

            {isFetching ? (
              <div className="mt-8 flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading comparison…
              </div>
            ) : comparison && comparison.length >= 2 ? (
              <div className="mt-8 grid gap-4 lg:grid-cols-3">
                {comparison.map((row) => {
                  const payload = row.payload as unknown as SolutionReport;
                  return (
                    <Card key={row.id} className="gap-4 border-border bg-surface p-5">
                      <div>
                        <p className="label-mono text-primary">Niche</p>
                        <h2 className="mt-1 text-lg font-semibold">{row.niche}</h2>
                        <p className="mt-2 text-sm text-muted-foreground">
                          {payload.niche_summary}
                        </p>
                      </div>
                      <div className="border-t border-border pt-3">
                        <p className="label-mono text-muted-foreground">Top pain points</p>
                        <ul className="mt-2 space-y-1 text-sm">
                          {payload.pain_points.slice(0, 3).map((p, i) => (
                            <li key={i}>
                              <span className="label-mono mr-2 text-primary">{p.severity}</span>
                              {p.title}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="border-t border-border pt-3">
                        <p className="label-mono text-muted-foreground">Recommended concept</p>
                        <p className="mt-1 text-sm">{payload.recommended_concept}</p>
                      </div>
                      <div className="border-t border-border pt-3">
                        <p className="label-mono text-muted-foreground">Pricing</p>
                        <ul className="mt-2 space-y-1 font-mono text-sm">
                          {payload.pricing_tiers.map((t) => (
                            <li key={t.name}>
                              {t.name} · ${t.monthly_price}/mo
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button asChild variant="outline" size="sm">
                        <Link to="/reports/$id" params={{ id: row.id }}>
                          Open report
                        </Link>
                      </Button>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <p className="mt-8 text-sm text-muted-foreground">
                Select at least two reports to compare.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
