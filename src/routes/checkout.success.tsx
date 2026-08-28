import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import { PLAN_LABELS, limitForPlan } from "@/lib/plan-limits";
import { syncSubscription } from "@/lib/payments.functions";

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
  const { plan, loading, refetch } = useSubscription();
  const doSync = useServerFn(syncSubscription);
  const [stillWaiting, setStillWaiting] = useState(false);
  const attempts = useRef(0);
  const limit = limitForPlan(plan);

  // The webhook usually lands within a second or two. If it doesn't, pull the
  // subscription straight from the payment provider instead of asking the
  // customer to refresh.
  useEffect(() => {
    if (loading || plan !== "none") return;
    let cancelled = false;
    const timer = setInterval(() => {
      void (async () => {
        attempts.current += 1;
        if (cancelled) return;
        if (attempts.current === 3) {
          try {
            await doSync({});
          } catch {
            /* fall through to the next poll */
          }
        }
        await refetch();
        if (attempts.current >= 8 && !cancelled) {
          setStillWaiting(true);
          clearInterval(timer);
        }
      })();
    }, 2500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loading, plan, doSync, refetch]);

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
              : plan === "none"
                ? stillWaiting
                  ? "We haven't heard back from the payment provider yet. Your payment is safe — open billing in a minute and it will be there, or contact support if it isn't."
                  : "Confirming your subscription — this usually takes a few seconds…"
                : `Your ${PLAN_LABELS[plan]} plan is active — ${
                    limit === null ? "unlimited reports" : `${limit} reports per month`
                  }. A receipt is on its way to your inbox.`}
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Button asChild>
              <Link to="/">Generate a report</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/account" hash="billing">
                Manage billing
              </Link>
            </Button>
          </div>
        </Card>
      </main>
    </div>
  );
}
