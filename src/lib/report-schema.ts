import { z } from "zod";

/**
 * Strict-compatible schema for the generated report.
 * Every property is required (no bounds/formats) so strict json_schema works.
 */
export const reportSchema = z.object({
  niche_summary: z.string(),
  buyer_profile: z.string(),
  pain_points: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      severity: z.enum(["critical", "high", "medium"]),
      evidence: z.string(),
    }),
  ),
  concepts: z.array(
    z.object({
      name: z.string(),
      tagline: z.string(),
      who_its_for: z.string(),
      solves: z.array(z.string()),
      complexity: z.enum(["low", "medium", "high"]),
      buildable_in_72h: z.boolean(),
      why: z.string(),
    }),
  ),
  recommended_concept: z.string(),
  pricing_tiers: z.array(
    z.object({
      name: z.string(),
      monthly_price_usd: z.number(),
      positioning: z.string(),
      included_features: z.array(z.string()),
      limits: z.string(),
    }),
  ),
  feature_breakdown: z.object({
    mvp: z.array(
      z.object({
        feature: z.string(),
        tier: z.string(),
        effort_hours: z.number(),
        rationale: z.string(),
      }),
    ),
    later: z.array(
      z.object({
        feature: z.string(),
        tier: z.string(),
        effort_hours: z.number(),
        rationale: z.string(),
      }),
    ),
  }),
  seventy_two_hour_plan: z.array(
    z.object({
      block: z.string(),
      focus: z.string(),
      deliverable: z.string(),
    }),
  ),
  risks: z.array(z.string()),
});

export type SolutionReport = z.infer<typeof reportSchema>;

export type ReportRow = {
  id: string;
  niche: string;
  audience: string | null;
  budget: string | null;
  created_at: string;
  payload: SolutionReport;
};

export function reportToMarkdown(niche: string, r: SolutionReport): string {
  const lines: string[] = [];
  lines.push(`# MicroSaaS solution report — ${niche}`, "", r.niche_summary, "");
  lines.push(`**Buyer:** ${r.buyer_profile}`, "");
  lines.push("## Pain points", "");
  r.pain_points.forEach((p, i) => {
    lines.push(`${i + 1}. **${p.title}** (${p.severity}) — ${p.description}`);
    lines.push(`   - Signal: ${p.evidence}`);
  });
  lines.push("", "## App concepts", "");
  r.concepts.forEach((c) => {
    lines.push(`### ${c.name} — ${c.tagline}`);
    lines.push(`- For: ${c.who_its_for}`);
    lines.push(`- Solves: ${c.solves.join(", ")}`);
    lines.push(`- Complexity: ${c.complexity} | 72h feasible: ${c.buildable_in_72h ? "yes" : "no"}`);
    lines.push(`- Why: ${c.why}`, "");
  });
  lines.push(`**Recommended:** ${r.recommended_concept}`, "", "## Pricing tiers", "");
  r.pricing_tiers.forEach((t) => {
    lines.push(`### ${t.name} — $${t.monthly_price_usd}/mo`);
    lines.push(`${t.positioning}`);
    t.included_features.forEach((f) => lines.push(`- ${f}`));
    lines.push(`- Limits: ${t.limits}`, "");
  });
  lines.push("## Feature breakdown", "", "### MVP");
  r.feature_breakdown.mvp.forEach((f) =>
    lines.push(`- ${f.feature} (${f.tier}, ~${f.effort_hours}h) — ${f.rationale}`),
  );
  lines.push("", "### Later");
  r.feature_breakdown.later.forEach((f) =>
    lines.push(`- ${f.feature} (${f.tier}, ~${f.effort_hours}h) — ${f.rationale}`),
  );
  lines.push("", "## 72-hour plan", "");
  r.seventy_two_hour_plan.forEach((b) => lines.push(`- **${b.block}** — ${b.focus} → ${b.deliverable}`));
  lines.push("", "## Risks", "");
  r.risks.forEach((x) => lines.push(`- ${x}`));
  return lines.join("\n");
}
