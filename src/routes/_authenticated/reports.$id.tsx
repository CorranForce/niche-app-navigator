import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2 } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { ReportView } from "@/components/report-view";
import { getReport } from "@/lib/reports.functions";
import type { SolutionReport } from "@/lib/report-schema";


export const Route = createFileRoute("/_authenticated/reports/$id")({
  head: () => ({
    meta: [
      { title: "Niche report — MicroSaaS Solution Finder" },
      {
        name: "description",
        content: "Pain points, app concepts, pricing tiers and a 72-hour build plan for your niche.",
      },
      { property: "og:title", content: "Niche report — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content: "Pain points, app concepts, pricing tiers and a 72-hour build plan.",
      },
    ],
  }),
  component: ReportPage,
});

function ReportPage() {
  const { id } = Route.useParams();
  const fetchReport = useServerFn(getReport);

  const { data, isLoading, error } = useQuery({
    queryKey: ["report", id],
    queryFn: () => fetchReport({ data: { id } }),
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 py-12">
        <Link
          to="/reports"
          className="label-mono inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All reports
        </Link>

        <div className="mt-8">
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading report…
            </div>
          ) : error || !data ? (
            <p className="text-sm text-destructive">This report couldn't be loaded.</p>
          ) : (
            <ReportView niche={data.niche} report={data.payload as unknown as SolutionReport} />
          )}
        </div>
      </main>
    </div>
  );
}
