import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, ExternalLink, Loader2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";
import { useSubscription } from "@/hooks/use-subscription";
import { usePaddleCheckout } from "@/hooks/use-paddle-checkout";
import { PLANS } from "@/lib/paddle";
import {
  cancelSubscription,
  changePlan,
  createCheckoutIntent,
  createPortalSession,
  resumeSubscription,
  switchBillingPeriod,
} from "@/lib/payments.functions";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PLAN_RANK, type PlanId } from "@/lib/plan-limits";

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Plan overview, plan switching, payment portal and cancellation. */
export function BillingManager() {
  const { user } = useSession();
  const { subscription, plan, isActive, loading, refetch, entitlementSource } = useSubscription();
  const { openCheckout } = usePaddleCheckout();
  const [intervalPref, setInterval] = useState<"monthly" | "yearly" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [pendingSwitch, setPendingSwitch] = useState<{
    planId: string;
    planName: string;
    priceId: string;
  } | null>(null);

  const doChangePlan = useServerFn(changePlan);
  const doCancel = useServerFn(cancelSubscription);
  const doResume = useServerFn(resumeSubscription);
  const doPortal = useServerFn(createPortalSession);
  const doSwitchPeriod = useServerFn(switchBillingPeriod);
  const doCheckoutIntent = useServerFn(createCheckoutIntent);

  const currentPlan = PLANS.find((p) => p.id === plan) ?? null;
  const activeInterval: "monthly" | "yearly" = subscription?.price_id?.endsWith("_yearly")
    ? "yearly"
    : "monthly";
  // The toggle stays usable on a live subscription: picking the other cycle
  // routes through the switch flow instead of an in-place plan change.
  const interval: "monthly" | "yearly" = intervalPref ?? (subscription ? activeInterval : "monthly");
  const endsSoon = Boolean(
    subscription?.cancel_at_period_end && subscription.status !== "canceled",
  );
  const canResume = endsSoon || subscription?.status === "paused";

  async function handleSelect(planId: string, priceId: string | null) {
    if (!priceId) return;
    const isDowngrade = (PLAN_RANK[planId as PlanId] ?? 0) < (PLAN_RANK[plan] ?? 0);
    if (isActive && subscription && isDowngrade) {
      const ok = window.confirm(
        `Downgrade to ${planId}? You keep your current plan and limits until ${formatDate(
          subscription.current_period_end,
        )}, then the new price applies. No partial refund is issued for the current period.`,
      );
      if (!ok) return;
    }
    if (isActive && subscription && interval !== activeInterval) {
      setPendingSwitch({ planId, planName: planId, priceId });
      return;
    }
    setBusy(planId);
    try {
      if (isActive && subscription) {
        await doChangePlan({ data: { priceId } });
        toast.success(
          isDowngrade
            ? "Downgrade scheduled — your current plan stays active until the period ends."
            : "Plan change scheduled — it takes effect at your next renewal.",
        );
        await refetch();
      } else {
        // The account a purchase belongs to is decided server-side: we send an
        // opaque signed token, never a client-chosen user id.
        const { checkoutToken } = await doCheckoutIntent({ data: { priceId } });
        await openCheckout({
          priceId,
          ...(user?.email ? { customerEmail: user.email } : {}),
          customData: { checkoutToken },
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCancel() {
    const ok = window.confirm(
      `Cancel your subscription? You keep full access until ${formatDate(
        subscription?.current_period_end,
      )}, and you can undo this any time before then.`,
    );
    if (!ok) return;
    setBusy("cancel");
    try {
      await doCancel({});
      toast.success("Subscription will end at the close of your current billing period.");
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not cancel the subscription.");
    } finally {
      setBusy(null);
    }
  }

  async function handleResume() {
    setBusy("resume");
    try {
      await doResume({});
      toast.success("Subscription resumed — your plan will keep renewing.");
      await refetch();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not resume the subscription.");
    } finally {
      setBusy(null);
    }
  }

  async function handlePortal() {
    setBusy("portal");
    try {
      const urls = await doPortal({});
      const target = urls.overviewUrl ?? urls.updatePaymentUrl;
      if (!target) throw new Error("Portal is unavailable right now.");
      window.open(target, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not open the billing portal.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section id="billing" className="scroll-mt-24">
      <h2 className="text-xl font-semibold">Billing</h2>

      <Card className="mt-4 gap-4 border-border bg-surface p-6">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading your plan…</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <div>
                <p className="font-mono text-2xl font-semibold">
                  {currentPlan?.name ?? "No active plan"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {currentPlan?.tagline ?? "Start a 7-day free trial on any plan to run reports."}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="label-mono text-muted-foreground">
                  {subscription?.status ?? "no subscription"}
                </p>
                {subscription?.current_period_end ? (
                  <p className="text-muted-foreground">
                    {subscription.cancel_at_period_end || subscription.status === "canceled"
                      ? `Access ends ${formatDate(subscription.current_period_end)}`
                      : `Renews ${formatDate(subscription.current_period_end)}`}
                  </p>
                ) : null}
              </div>
            </div>

            {entitlementSource === "team" ? (
              <p className="rounded-sm border border-primary/40 bg-primary/5 p-3 text-sm">
                Your Studio access comes from a workspace you were invited to — the workspace owner
                handles billing. Starting your own plan below gives you a separate subscription.
              </p>
            ) : null}

            {subscription?.status === "past_due" ? (
              <p className="rounded-sm border border-destructive/40 bg-destructive/10 p-3 text-sm">
                Your last payment failed, so report generation is paused until it's resolved. Update
                your payment method to restore your plan.
              </p>
            ) : null}

            {endsSoon ? (
              <p className="rounded-sm border border-border bg-muted/30 p-3 text-sm">
                Your plan is scheduled to end on {formatDate(subscription?.current_period_end)}. You
                keep full access until then — resume any time to keep it running.
              </p>
            ) : null}

            {isActive || canResume ? (
              <div className="flex flex-wrap gap-2 border-t border-border pt-4">
                <Button variant="outline" onClick={handlePortal} disabled={busy !== null}>
                  {busy === "portal" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ExternalLink className="h-4 w-4" />
                  )}
                  Payment details & invoices
                </Button>
                {canResume ? (
                  <Button onClick={handleResume} disabled={busy !== null}>
                    {busy === "resume" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4" />
                    )}
                    Resume subscription
                  </Button>
                ) : subscription?.status === "canceled" ? null : (
                  <Button variant="ghost" onClick={handleCancel} disabled={busy !== null}>
                    {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Cancel subscription
                  </Button>
                )}
              </div>
            ) : (
              <p className="border-t border-border pt-4 text-sm text-muted-foreground">
                You don't have an active plan yet. Every plan starts with a 7-day free trial — pick
                one below to start generating reports.
              </p>
            )}
          </>
        )}
      </Card>

      <div className="mt-10 flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Change plan</h3>
        <div className="flex rounded-sm border border-border p-1">
          {(["monthly", "yearly"] as const).map((i) => (
            <button
              key={i}
              type="button"
              onClick={() => setInterval(i)}
              className={`label-mono rounded-sm px-3 py-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                interval === i ? "bg-primary text-primary-foreground" : "text-muted-foreground"
              }`}
            >
              {i === "monthly" ? "Monthly" : "Yearly · 2 months free"}
            </button>
          ))}
        </div>
      </div>
      {isActive && subscription && interval !== activeInterval && (
        <p className="mt-2 text-sm text-muted-foreground">
          You&apos;re billed {activeInterval === "yearly" ? "yearly" : "monthly"} today. Choosing a
          plan here switches you to {interval} billing — we&apos;ll ask whether to switch now or when
          your current period ends.
        </p>
      )}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {PLANS.map((p) => {
          const price = p[interval];
          const isCurrent = p.id === plan && interval === activeInterval;
          return (
            <Card
              key={p.id}
              className={`gap-4 p-6 ${
                isCurrent ? "border-primary/60 bg-primary/5" : "border-border bg-surface"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="label-mono text-muted-foreground">{p.name}</p>
                {isCurrent ? <span className="label-mono text-primary">Current</span> : null}
              </div>
              <p className="font-mono text-4xl font-semibold">
                {price.amount}
                <span className="text-sm font-normal text-muted-foreground">
                  /{interval === "monthly" ? "mo" : "yr"}
                </span>
              </p>
              <p className="text-sm text-muted-foreground">{p.tagline}</p>
              <ul className="space-y-2 border-t border-border pt-4 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button
                className="mt-2"
                variant={isCurrent ? "outline" : "default"}
                disabled={isCurrent || busy !== null}
                onClick={() => handleSelect(p.id, price.priceId)}
              >
                {busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isCurrent
                  ? "Current plan"
                  : isActive
                    ? `Switch to ${p.name}`
                    : `Start ${p.name} — 7-day trial`}
              </Button>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
