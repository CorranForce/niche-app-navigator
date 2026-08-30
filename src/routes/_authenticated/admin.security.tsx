import { createFileRoute } from "@tanstack/react-router";
import { AdminErrorFallback } from "@/components/admin-error-fallback";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Loader2, RefreshCw, ShieldAlert, ShieldCheck, XCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getGrantCheck } from "@/lib/admin-security.functions";

export const Route = createFileRoute("/_authenticated/admin/security")({
  head: () => ({
    meta: [
      { title: "Security status — internal" },
      {
        name: "description",
        content:
          "Internal security status: live pass/fail for database function EXECUTE grant requirements after each deploy.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Security status — internal" },
      { property: "og:description", content: "Function grant contract pass/fail." },
    ],
  }),
  component: SecurityStatusPage,
  errorComponent: AdminErrorFallback,
});

function SecurityStatusPage() {
  const run = useServerFn(getGrantCheck);
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-grant-check"],
    queryFn: () => run(),
    retry: false,
  });

  const required = data?.rows.filter((r) => r.kind === "required") ?? [];
  const locked = data?.rows.filter((r) => r.kind === "locked") ?? [];

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              <ShieldCheck className="h-5 w-5 text-muted-foreground" /> Security status
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Runs the same EXECUTE-grant contract as the CI grant-check script, live against the
              database — so you can confirm every deploy left policy helpers callable and sensitive
              functions locked down.
            </p>
          </div>
          <Button
            variant="ghost"
            className="ml-auto"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Re-run check
          </Button>
        </div>

        {error ? (
          <Card className="mt-6 flex items-center gap-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            {(error as Error).message}
          </Card>
        ) : null}

        {isLoading ? (
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Verifying function grants…
          </p>
        ) : data ? (
          <>
            <Card
              className={`mt-6 flex flex-wrap items-center gap-3 p-4 ${
                data.failed === 0
                  ? "border-border bg-surface"
                  : "border-destructive/40 bg-destructive/10"
              }`}
            >
              {data.failed === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" />
              ) : (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <p className="text-sm font-medium">
                {data.failed === 0
                  ? "All function grant requirements pass."
                  : `${data.failed} grant problem(s) found.`}
              </p>
              <span className="font-mono text-xs text-muted-foreground">
                {data.passed} pass · {data.failed} fail · checked{" "}
                {new Date(data.checkedAt).toLocaleString()}
              </span>
            </Card>

            <GrantTable
              title="Required EXECUTE grants (RLS policy helpers)"
              rows={required}
              showUsedBy
            />
            <GrantTable title="Must stay service-role only" rows={locked} />
          </>
        ) : null}
      </main>
    </div>
  );
}

function GrantTable({
  title,
  rows,
  showUsedBy = false,
}: {
  title: string;
  rows: Array<{ name: string; detail: string; ok: boolean; usedBy: string[] }>;
  showUsedBy?: boolean;
}) {
  return (
    <section className="mt-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      <Card className="mt-3 gap-0 overflow-hidden border-border bg-surface p-0">
        {rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nothing to check.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {rows.map((row) => (
              <li key={row.name} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Badge variant={row.ok ? "outline" : "destructive"}>
                  {row.ok ? "PASS" : "FAIL"}
                </Badge>
                <span className="font-mono text-xs break-all">{row.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{row.detail}</span>
                {showUsedBy && row.usedBy.length > 0 ? (
                  <p className="w-full text-xs text-muted-foreground">
                    Used by: {row.usedBy.join(" · ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
