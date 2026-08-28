import { useState } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import { Copy, Download, AlertTriangle, Layers, Lock, Rocket, Timer } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { planFeatures } from "@/lib/plan-limits";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { conceptVibePrompt, reportToMarkdown, type SolutionReport } from "@/lib/report-schema";

function SectionTitle({ icon, children }: { icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
      {icon}
      {children}
    </h2>
  );
}

const severityVariant: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive border-destructive/30",
  high: "bg-warning/15 text-warning border-warning/30",
  medium: "bg-muted text-muted-foreground border-border",
};

function ConceptPrompt({
  niche,
  report,
  concept,
}: {
  niche: string;
  report: SolutionReport;
  concept: SolutionReport["concepts"][number];
}) {
  const [copied, setCopied] = useState(false);
  const prompt = conceptVibePrompt(niche, report, concept);

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      toast.success("Vibe-code prompt copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <div className="mt-auto rounded-md border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="label-mono text-muted-foreground">Vibe-code prompt</p>
        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={copy}>
          <Copy className="h-3.5 w-3.5" />
          <span className="ml-1.5 text-xs">{copied ? "Copied" : "Copy"}</span>
        </Button>
      </div>
      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-muted-foreground">
        {prompt}
      </pre>
    </div>
  );
}

export function ReportView({ niche, report }: { niche: string; report: SolutionReport }) {
  const [copied, setCopied] = useState(false);
  const { plan } = useSubscription();
  const canExport = planFeatures(plan).markdownExport;

  function downloadMarkdown() {
    const blob = new Blob([reportToMarkdown(niche, report)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${niche
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-report.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Markdown downloaded");
  }

  async function copyMarkdown() {
    try {
      await navigator.clipboard.writeText(reportToMarkdown(niche, report));
      setCopied(true);
      toast.success("Report copied as markdown");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy to clipboard");
    }
  }

  return (
    <div className="space-y-12">
      <section>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="label-mono text-primary">Niche read</p>
            <h1 className="mt-2 text-3xl font-semibold">{niche}</h1>
            <p className="mt-3 text-muted-foreground">{report.niche_summary}</p>
            <p className="mt-3 text-sm text-muted-foreground">
              <span className="label-mono mr-2 text-foreground">Buyer</span>
              {report.buyer_profile}
            </p>
          </div>
          {canExport ? (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={copyMarkdown}>
                <Copy className="mr-2 h-3.5 w-3.5" />
                {copied ? "Copied" : "Copy markdown"}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadMarkdown}>
                <Download className="mr-2 h-3.5 w-3.5" />
                Download .md
              </Button>
            </div>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/account" hash="billing">
                <Lock className="mr-2 h-3.5 w-3.5" />
                Markdown export is on Pro
              </Link>
            </Button>
          )}
        </div>
      </section>

      <section>
        <SectionTitle icon={<AlertTriangle className="h-4 w-4 text-primary" />}>
          Pain points
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2">
          {report.pain_points.map((p, i) => (
            <Card key={i} className="gap-3 border-border bg-surface p-5">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-medium leading-snug">{p.title}</h3>
                <span
                  className={`label-mono shrink-0 rounded-full border px-2 py-0.5 ${severityVariant[p.severity]}`}
                >
                  {p.severity}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{p.description}</p>
              <p className="border-t border-border pt-3 font-mono text-xs text-muted-foreground">
                {p.evidence}
              </p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={<Rocket className="h-4 w-4 text-primary" />}>App concepts</SectionTitle>
        <div className="grid gap-3 lg:grid-cols-3">
          {report.concepts.map((c) => {
            const recommended = c.name === report.recommended_concept;
            return (
              <Card
                key={c.name}
                className={`gap-3 p-5 ${
                  recommended ? "border-primary/60 bg-primary/5" : "border-border bg-surface"
                }`}
              >
                {recommended ? <span className="label-mono text-primary">Recommended</span> : null}
                <h3 className="text-base font-semibold">{c.name}</h3>
                <p className="text-sm text-muted-foreground">{c.tagline}</p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {c.complexity} build
                  </Badge>
                  <Badge
                    variant="secondary"
                    className={`font-mono text-[10px] ${c.buildable_in_72h ? "bg-success/15 text-success" : ""}`}
                  >
                    {c.buildable_in_72h ? "72h feasible" : "needs > 72h"}
                  </Badge>
                </div>
                <p className="text-sm">
                  <span className="label-mono mr-2 text-muted-foreground">For</span>
                  {c.who_its_for}
                </p>
                <ul className="space-y-1 text-sm text-muted-foreground">
                  {c.solves.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-primary">→</span>
                      {s}
                    </li>
                  ))}
                </ul>
                <p className="border-t border-border pt-3 text-xs text-muted-foreground">{c.why}</p>
                <ConceptPrompt niche={niche} report={report} concept={c} />
              </Card>
            );
          })}
        </div>
      </section>

      <section>
        <SectionTitle icon={<Layers className="h-4 w-4 text-primary" />}>
          Pricing tiers for {report.recommended_concept}
        </SectionTitle>
        <div className="grid gap-3 lg:grid-cols-3">
          {report.pricing_tiers.map((t) => (
            <Card key={t.name} className="gap-3 border-border bg-surface p-5">
              <p className="label-mono text-muted-foreground">{t.name}</p>
              <p className="font-mono text-3xl font-semibold">
                ${t.monthly_price_usd}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-sm text-muted-foreground">{t.positioning}</p>
              <ul className="space-y-1.5 border-t border-border pt-3 text-sm">
                {t.included_features.map((f, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <p className="font-mono text-xs text-muted-foreground">{t.limits}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Feature breakdown</SectionTitle>
        <div className="grid gap-6 lg:grid-cols-2">
          {(
            [
              ["Ship in the first release", report.feature_breakdown.mvp],
              ["Park for later", report.feature_breakdown.later],
            ] as const
          ).map(([label, rows]) => (
            <div key={label}>
              <p className="label-mono mb-3 text-muted-foreground">{label}</p>
              <div className="overflow-hidden rounded-md border border-border">
                {rows.map((f, i) => (
                  <div
                    key={i}
                    className="flex items-start justify-between gap-4 border-b border-border bg-surface p-4 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{f.feature}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{f.rationale}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="label-mono text-primary">{f.tier}</p>
                      <p className="font-mono text-xs text-muted-foreground">~{f.effort_hours}h</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle icon={<Timer className="h-4 w-4 text-primary" />}>
          72-hour build plan
        </SectionTitle>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {report.seventy_two_hour_plan.map((b, i) => (
            <Card key={i} className="gap-2 border-border bg-surface p-5">
              <p className="label-mono text-primary">{b.block}</p>
              <p className="text-sm font-medium">{b.focus}</p>
              <p className="text-xs text-muted-foreground">{b.deliverable}</p>
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle>Risks</SectionTitle>
        <ul className="space-y-2">
          {report.risks.map((r, i) => (
            <li key={i} className="flex gap-3 text-sm text-muted-foreground">
              <span className="font-mono text-primary">!</span>
              {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
