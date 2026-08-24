import { Link } from "@tanstack/react-router";
import { AlertTriangle } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";

/** Shown site-wide while a renewal payment has failed and paid features are restricted. */
export function PastDueBanner() {
  const { isPastDue } = useSubscription();
  if (!isPastDue) return null;

  return (
    <div className="flex w-full items-center justify-center gap-2 border-b border-destructive/40 bg-destructive/10 px-4 py-2 text-center text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <span>
        Your last payment failed — you're on Free limits until it's fixed.{" "}
        <Link to="/billing" className="font-medium underline">
          Update payment method
        </Link>
      </span>
    </div>
  );
}
