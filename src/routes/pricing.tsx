import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PLANS } from "@/lib/paddle";
import { USE_CASES } from "@/lib/use-cases";
import { useSession } from "@/hooks/use-session";
import { useSubscription } from "@/hooks/use-subscription";
import { usePaddleCheckout } from "@/hooks/use-paddle-checkout";
import { getPublicCatalog } from "@/lib/catalog.functions";
import { createCheckoutIntent } from "@/lib/payments.functions";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Solo, Pro and Studio plans for the MicroSaaS Solution Finder. Every plan starts with a 7-day free trial: 10, 50 or unlimited niche reports a month.",
      },
      { property: "og:title", content: "Pricing — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content:
          "Every plan starts with a 7-day free trial. Solo $9, Pro $19, Studio $49 per month.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://idea-spark-fast.lovable.app/pricing" },
      { property: "og:image", content: "https://idea-spark-fast.lovable.app/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://idea-spark-fast.lovable.app/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: "https://idea-spark-fast.lovable.app/pricing" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Product",
          name: "MicroSaaS Solution Finder",
          description:
            "AI niche research reports: pain points, app concepts, pricing tiers and a 72-hour build plan.",
          image: "https://idea-spark-fast.lovable.app/og-image.jpg",
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "USD",
            lowPrice: "9",
            highPrice: "49",
            offerCount: 3,
            url: "https://idea-spark-fast.lovable.app/pricing",
          },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://idea-spark-fast.lovable.app/",
            },
            {
              "@type": "ListItem",
              position: 2,
              name: "Pricing",
              item: "https://idea-spark-fast.lovable.app/pricing",
            },
          ],
        }),
      },
    ],
  }),
  component: PricingPage,
});

function formatAmount(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}

function PricingPage() {
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");
  const [busy, setBusy] = useState<string | null>(null);
  const { user } = useSession();
  const navigate = useNavigate();
  const { subscription, entitlement } = useSubscription();
  const { openCheckout } = usePaddleCheckout();
  const fetchCatalog = useServerFn(getPublicCatalog);
  const doCheckoutIntent = useServerFn(createCheckoutIntent);

  // Amounts come from the stored Paddle catalog so the page can never advertise
  // a price the gateway would not actually charge.
  const catalog = useQuery({
    queryKey: ["public-catalog"],
    queryFn: () => fetchCatalog({ data: {} }),
    staleTime: 5 * 60 * 1000,
  });

  function priceFor(priceExternalId: string | null) {
    if (!priceExternalId) return null;
    return catalog.data?.find((r) => r.priceExternalId === priceExternalId) ?? null;
  }

  const hasActivePlan = Boolean(entitlement?.active);

  async function handleCta(planId: string, priceId: string | null) {
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/pricing" } });
      return;
    }
    if (hasActivePlan || !priceId) {
      navigate({ to: "/account", hash: "billing" });
      return;
    }
    setBusy(planId);
    try {
      const { checkoutToken } = await doCheckoutIntent({ data: { priceId } });
      await openCheckout({
        priceId,
        ...(user.email ? { customerEmail: user.email } : {}),
        paddleCustomerId: subscription?.paddle_customer_id ?? null,
        customData: { checkoutToken },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Checkout could not be opened.");
    } finally {
      setBusy(null);
    }
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
                  {highlighted ? (
                    <span className="label-mono text-primary">Most picked</span>
                  ) : null}
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
                  {`Start ${t.name} — 7-day free trial`}
                </Button>
              </Card>
            );
          })}
        </div>

        <p className="mt-10 font-mono text-xs text-muted-foreground">
          Payments are handled securely by our reseller. Manage or cancel any time from Billing.
        </p>

        <section className="mt-12 border-t border-border pt-10">
          <p className="label-mono text-primary">Before you pick a plan</p>
          <h2 className="mt-3 text-2xl font-semibold">See what a report actually solves</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Each use case page shows the signals of a pain-point type, the app shapes that remove
            it, and an example workflow end to end.
          </p>
          <div className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map((u) => (
              <Link
                key={u.slug}
                to="/use-cases/$slug"
                params={{ slug: u.slug }}
                className="rounded-md border border-border bg-surface p-4 transition-colors hover:border-primary"
              >
                <p className="label-mono text-primary">{u.painType}</p>
                <p className="mt-2 text-sm text-muted-foreground">{u.tagline}</p>
              </Link>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link to="/use-cases" className="label-mono text-primary hover:underline">
              All use cases
            </Link>
            <Link to="/faq" className="label-mono text-primary hover:underline">
              Pricing, billing &amp; refund FAQ
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
