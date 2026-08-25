import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_LABELS, limitForPlan } from "@/lib/plan-limits";

export const Route = createFileRoute("/checkout/success")({
  head: () => ({
    meta: [
      { title: "You're subscribed — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Your subscription is active. Start generating niche pain-point reports and 72-hour build plans right away.",
      },
      { property: "og:title", content: "You're subscribed — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content: "Your MicroSaaS Solution Finder subscription is active.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: CheckoutSuccessPage,
});

function CheckoutSuccessPage() {
  const { plan, loading } = useSubscription();
  const limit = limitForPlan(plan);

  return (
    <div className="min-h-screen">
      <PaymentTestModeBanner />
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-20">
        <Card className="gap-4 border-border bg-surface p-8 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h1 className="text-3xl font-semibold">Payment received</h1>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Confirming your subscription…"
              : plan === "free"
                ? "We're still confirming your subscription — this usually takes a few seconds. Refresh the billing page if it doesn't appear."
                : `Your ${PLAN_LABELS[plan]} plan is active — ${
                    limit === null ? "unlimited reports" : `${limit} reports per month`
                  }. A receipt is on its way to your inbox.`}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/">Generate a report</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/billing">Manage billing</Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
