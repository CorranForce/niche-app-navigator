import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AdminSectionError, LastRefreshed } from "@/components/admin-section-error";
import {
  getBillingCatalog,
  syncBillingCatalog,
  verifyBillingCatalog,
} from "@/lib/admin-catalog.functions";

function money(cents: number, currency: string) {
  return `${currency === "USD" ? "$" : ""}${(cents / 100).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

export function BillingCatalogSection({ environment }: { environment: "sandbox" | "live" }) {
  const queryClient = useQueryClient();
  const fetchCatalog = useServerFn(getBillingCatalog);
  const runSync = useServerFn(syncBillingCatalog);
  const [syncedAt, setSyncedAt] = useState<number | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-billing-catalog", environment],
    queryFn: () => fetchCatalog({ data: { environment } }),
    retry: false,
  });

  const sync = useMutation({
    mutationFn: () => runSync({ data: { environment } }),
    onSuccess: (result) => {
      setSyncedAt(Date.now());
      queryClient.setQueryData(["admin-billing-catalog", environment], result.rows);
      toast.success(
        result.synced > 0
          ? `Synced ${result.synced} price${result.synced === 1 ? "" : "s"} from Paddle.`
          : "Paddle returned no active prices for this environment yet.",
      );
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Could not sync the catalog.");
    },
  });

  const rows = data ?? [];

  return (
    <Card className="mt-6 gap-4 border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Product catalog</h2>
          <p className="text-sm text-muted-foreground">
            Paddle products and prices stored in the database for the{" "}
            {environment === "live" ? "live" : "test"} environment.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <LastRefreshed at={syncedAt} />
          <Button
            variant="outline"
            size="sm"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            {sync.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            Sync from Paddle
          </Button>
        </div>
      </div>

      {error ? (
        <AdminSectionError
          title="Catalog unavailable"
          error={error}
          onRetry={() => void refetch()}
        />
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading catalog…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No products stored for this environment yet. Live products appear after the app is
          published and Paddle approves the account; then run “Sync from Paddle”.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Plan</th>
                <th className="py-2 pr-4 font-medium">Price key</th>
                <th className="py-2 pr-4 font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Trial</th>
                <th className="py-2 pr-4 font-medium">Paddle price ID</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.priceExternalId} className="border-t border-border">
                  <td className="py-2 pr-4">{row.planName}</td>
                  <td className="py-2 pr-4 font-mono text-xs">{row.priceExternalId}</td>
                  <td className="py-2 pr-4">
                    {money(row.amountCents, row.currency)}/{row.interval === "year" ? "yr" : "mo"}
                  </td>
                  <td className="py-2 pr-4">{row.trialDays} days</td>
                  <td className="py-2 pr-4 font-mono text-xs break-all">{row.paddlePriceId}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
