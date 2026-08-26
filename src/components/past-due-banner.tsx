import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSubscription } from "@/hooks/use-subscription";
import { createPortalSession } from "@/lib/payments.functions";

/** Shown site-wide while a renewal payment has failed and paid features are restricted. */
export function PastDueBanner() {
  const { isPastDue } = useSubscription();
  const openPortal = useServerFn(createPortalSession);
  const [busy, setBusy] = useState(false);

  if (!isPastDue) return null;

  async function handleUpdate() {
    setBusy(true);
    try {
      const urls = await openPortal();
      const target = urls.updatePaymentUrl ?? urls.overviewUrl;
      if (!target) throw new Error("Payment portal is unavailable right now.");
      window.open(target, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open the payment portal.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center">
        <span className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
          <strong className="font-medium">Your last payment failed.</strong>
        </span>
        <span className="text-muted-foreground">
          You're on Free limits until it's fixed. Update your card details and we'll retry the
          charge automatically.
        </span>
        <button
          type="button"
          onClick={handleUpdate}
          disabled={busy}
          className="inline-flex items-center gap-1 font-medium underline underline-offset-2 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Update payment details
        </button>
        <Link
          to="/account"
          hash="billing"
          className="text-muted-foreground underline underline-offset-2"
        >
          Account & billing
        </Link>
      </div>
    </div>
  );
}
