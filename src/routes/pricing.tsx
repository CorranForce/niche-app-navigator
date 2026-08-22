import { createFileRoute, Link } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Free, Pro and Team plans for the MicroSaaS Solution Finder. Start with five niche reports a month, upgrade for unlimited research.",
      },
      { property: "og:title", content: "Pricing — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content:
          "Start free with five niche reports a month. Upgrade for unlimited research and exports.",
      },
    ],
  }),
  component: PricingPage,
});

const TIERS = [
  {
    name: "Free",
    price: "$0",
    tagline: "Test the tool on a niche you already know.",
    features: [
      "5 reports per month",
      "Full pain-point analysis",
      "3 app concepts per report",
      "Pricing tiers + feature breakdown",
      "Saved report history",
    ],
    cta: "Start free",
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$19",
    tagline: "For builders shipping something new every month.",
    features: [
      "Unlimited reports",
      "Everything in Free",
      "Markdown export",
      "Deeper 72-hour build plans",
      "Priority generation queue",
    ],
    cta: "Get Pro",
    highlighted: true,
  },
  {
    name: "Team",
    price: "$49",
    tagline: "For studios and agencies scouting niches together.",
    features: [
      "Everything in Pro",
      "5 seats included",
      "Shared report library",
      "Side-by-side niche comparison",
      "Priority support",
    ],
    cta: "Talk to us",
    highlighted: false,
  },
];

function PricingPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <p className="label-mono text-primary">Plans</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          Priced like the tools you're planning
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Every plan returns the same depth of report. Paid plans lift the monthly limit and add
          export and collaboration.
        </p>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {TIERS.map((t) => (
            <Card
              key={t.name}
              className={`gap-4 p-6 ${
                t.highlighted ? "border-primary/60 bg-primary/5" : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="label-mono text-muted-foreground">{t.name}</p>
                {t.highlighted ? (
                  <span className="label-mono text-primary">Most picked</span>
                ) : null}
              </div>
              <p className="font-mono text-4xl font-semibold">
                {t.price}
                <span className="text-sm font-normal text-muted-foreground">/mo</span>
              </p>
              <p className="text-sm text-muted-foreground">{t.tagline}</p>
              <ul className="space-y-2 border-t border-border pt-4 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant={t.highlighted ? "default" : "outline"} className="mt-2">
                <Link to="/auth">{t.cta}</Link>
              </Button>
            </Card>
          ))}
        </div>

        <p className="mt-10 font-mono text-xs text-muted-foreground">
          Checkout isn't wired up yet — every account currently runs on the Free limit.
        </p>
      </main>
    </div>
  );
}
