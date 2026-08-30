import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { friendlyErrorMessage } from "@/lib/friendly-errors";

/**
 * Section-scoped fallback: one failing panel (overview, anomalies, …) shows this
 * instead of taking down the whole dashboard, and can be retried on its own.
 */
export function AdminSectionError({
  title = "This section didn't load",
  error,
  onRetry,
  isRetrying = false,
}: {
  title?: string;
  error: unknown;
  onRetry: () => void;
  isRetrying?: boolean;
}) {
  return (
    <Card className="gap-3 border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
        {title}
      </div>
      <p className="text-sm text-muted-foreground">{friendlyErrorMessage(error)}</p>
      <div>
        <Button size="sm" variant="outline" onClick={onRetry} disabled={isRetrying}>
          <RefreshCw className={`h-4 w-4 ${isRetrying ? "animate-spin" : ""}`} /> Retry this section
        </Button>
      </div>
    </Card>
  );
}

/** Small shared "Last refreshed …" line used across dashboard sections. */
export function LastRefreshed({
  at,
  isLoading = false,
  className = "",
}: {
  at: number | null;
  isLoading?: boolean;
  className?: string;
}) {
  if (isLoading) {
    return (
      <p className={`label-mono text-muted-foreground ${className}`}>Refreshing…</p>
    );
  }
  if (!at) return null;
  return (
    <p className={`label-mono text-muted-foreground ${className}`}>
      Last refreshed {new Date(at).toLocaleTimeString()}
    </p>
  );
}
