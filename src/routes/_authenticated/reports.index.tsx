import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { listReports, deleteReport } from "@/lib/reports.functions";

export const Route = createFileRoute("/_authenticated/reports/")({
  head: () => ({
    meta: [
      { title: "My reports — MicroSaaS Solution Finder" },
      { name: "description", content: "Your saved micro-SaaS niche pain-point reports and build plans." },
      { property: "og:title", content: "My reports — MicroSaaS Solution Finder" },
      { property: "og:description", content: "Your saved micro-SaaS niche research." },
    ],
  }),
  component: ReportsPage,
});

function ReportsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchReports = useServerFn(listReports);
  const remove = useServerFn(deleteReport);

  const { data, isLoading } = useQuery({
    queryKey: ["reports"],
    queryFn: () => fetchReports(),
  });

  const del = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("Report deleted");
      queryClient.invalidateQueries({ queryKey: ["reports"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-12">
        <p className="label-mono text-primary">Library</p>
        <h1 className="mt-3 text-3xl font-semibold">My reports</h1>

        {isLoading ? (
          <div className="mt-10 flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !data || data.length === 0 ? (
          <Card className="mt-8 items-start gap-3 border-border bg-surface p-8">
            <p className="text-sm text-muted-foreground">No reports yet.</p>
            <Button onClick={() => navigate({ to: "/" })}>Find your first niche</Button>
          </Card>
        ) : (
          <div className="mt-8 overflow-hidden rounded-md border border-border">
            {data.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 border-b border-border bg-surface p-4 last:border-b-0"
              >
                <div className="min-w-0">
                  <Link
                    to="/reports/$id"
                    params={{ id: r.id }}
                    className="block truncate font-medium hover:text-primary"
                  >
                    {r.niche}
                  </Link>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()} · {r.recommended_concept}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Delete report"
                  disabled={del.isPending}
                  onClick={() => del.mutate(r.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
