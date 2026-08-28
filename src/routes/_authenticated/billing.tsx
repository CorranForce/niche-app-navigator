import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { BillingManager } from "@/components/billing-manager";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({
    meta: [
      { title: "Billing & plan settings — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "View your current plan and upgrade or downgrade between Solo, Pro and Studio, manage payment details, invoices and cancellations.",
      },
      { property: "og:title", content: "Billing & plan settings" },
      {
        property: "og:description",
        content: "Switch between Solo, Pro and Studio, and manage payment details and invoices.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BillingPage,
});

function BillingPage() {
  return (
    <div className="min-h-screen">
      <PaymentTestModeBanner />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <p className="label-mono text-primary">Billing</p>
        <h1 className="mt-3 text-3xl font-semibold">Plan &amp; billing settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          See what you're on today and move between Solo, Pro and Studio at any time. Plan changes
          take effect at your next renewal — cancellations keep access until the period ends.
        </p>

        <div className="mt-8">
          <BillingManager />
        </div>

        <p className="mt-10 text-sm text-muted-foreground">
          Looking for sign-in methods or your team seats?{" "}
          <Link to="/account" className="text-primary underline underline-offset-4">
            Go to account settings
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
