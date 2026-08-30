import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { friendlyErrorMessage } from "@/lib/friendly-errors";

/** Route-level fallback so admin runtime errors never render a blank screen. */
export function AdminErrorFallback({ error, reset }: ErrorComponentProps) {
  const router = useRouter();

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <Card className="gap-3 border-destructive/40 bg-destructive/5 p-6">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <h1 className="text-lg font-semibold tracking-tight">This admin view didn't load</h1>
        </div>
        <p className="text-sm text-muted-foreground">{friendlyErrorMessage(error)}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            onClick={() => {
              reset();
              void router.invalidate();
            }}
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin">Back to dashboard</Link>
          </Button>
        </div>
      </Card>
    </div>
  );
}
