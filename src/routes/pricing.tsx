import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/paddle";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Free, Pro and Studio plans for the MicroSaaS Solution Finder. Start with five niche reports a month, upgrade for 50 a month or unlimited.",
      },
      { property: "og:title", content: "Pricing — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content:
          "Start free with five niche reports a month. Upgrade for more capacity and exports.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PricingPage,
});

function PricingPage() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const { user } = useSession();
  const navigate = useNavigate();

  function handleCta(planId: string) {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/billing" } });
      return;
    }
    navigate({ to: "/billing" });
    void planId;
  }

  return (
    <div className="min-h-screen">
      <PaymentTestModeBanner />
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

        <div className="mt-8 inline-flex rounded-sm border border-border p-1">
          {(["monthly", "yearly"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={`label-mono rounded-sm px-3 py-1 transition-colors ${
                interval === i ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {i === "monthly" ? "Monthly" : "Yearly · 2 months free"}
            </button>
          ))}
        </div>

        <div className="mt-10 grid gap-4 lg:grid-cols-3">
          {PLANS.map((t) => {
            const price = t[interval];
            const highlighted = t.id === "pro";
            return (
              <Card
                key={t.id}
                className={`gap-4 p-6 ${
                  highlighted ? "border-primary/60 bg-primary/5" : "border-border bg-surface"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="label-mono text-muted-foreground">{t.name}</p>
                  {highlighted ? <span className="label-mono text-primary">Most picked</span> : null}
                </div>
                <p className="font-mono text-4xl font-semibold">
                  {price.amount}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{interval === "monthly" ? "mo" : "yr"}
                  </span>
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
                <Button
                  variant={highlighted ? "default" : "outline"}
                  className="mt-2"
                  onClick={() => handleCta(t.id)}
                >
                  {t.id === "free" ? "Start free" : `Get ${t.name}`}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="mt-10 font-mono text-xs text-muted-foreground">
          Payments are handled securely by our reseller. Manage or cancel any time from Billing.
        </p>
      </main>
    </div>
  );
}
