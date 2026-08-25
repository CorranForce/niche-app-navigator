import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { listRecentEmailLogs } from "@/lib/admin-emails.functions";

export const Route = createFileRoute("/_authenticated/admin/emails")({
  head: () => ({
    meta: [
      { title: "Email delivery log — internal dashboard" },
      {
        name: "description",
        content:
          "Internal admin tool: review recent app email sends, delivery status and failure reasons.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Email delivery log — internal dashboard" },
      { property: "og:description", content: "Internal email delivery monitoring." },
    ],
  }),
  component: AdminEmailsPage,
});

const FILTERS = [
  { value: "", label: "All" },
  { value: "sent", label: "Sent" },
  { value: "rejected", label: "Rejected" },
  { value: "bounced", label: "Bounced" },
  { value: "complained", label: "Complaints" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "suppressed", label: "Suppressed" },
  { value: "rate_limited", label: "Rate limited" },
] as const;

type FilterValue = (typeof FILTERS)[number]["value"];

function fmtWhen(value: string | null) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function eventTone(eventType: string) {
  if (eventType === "sent") return "text-primary";
  if (eventType === "bounced" || eventType === "complained" || eventType === "rejected")
    return "text-destructive";
  return "text-muted-foreground";
}

function AdminEmailsPage() {
  const [input, setInput] = useState("");
  const [recipient, setRecipient] = useState("");
  const [filter, setFilter] = useState<FilterValue>("");
  const fetchLogs = useServerFn(listRecentEmailLogs);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-email-logs", recipient, filter],
    queryFn: () =>
      fetchLogs({
        data: {
          limit: 100,
          ...(recipient ? { recipient } : {}),
          ...(filter ? { eventType: filter } : {}),
        },
      }),
    retry: false,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Email delivery log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Recent app email activity: what was sent, what was refused, and why. Delivered and opened
          tracking is not available.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setRecipient(input.trim());
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Filter by recipient email"
              className="w-72"
            />
            <Button type="submit" variant="secondary">
              <Search className="h-4 w-4" /> Filter
            </Button>
          </form>
          <Button variant="ghost" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Button
              key={f.value || "all"}
              size="sm"
              variant={filter === f.value ? "default" : "outline"}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>

        {error ? (
          <Card className="mt-6 flex items-center gap-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            {(error as Error).message}
          </Card>
        ) : null}

        <Card className="mt-6 gap-0 overflow-hidden border-border bg-surface p-0">
          {isLoading ? (
            <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading email activity…
            </p>
          ) : !data?.length ? (
            <p className="p-4 text-sm text-muted-foreground">
              No email events in the visible window yet.
            </p>
          ) : (
            <table className="w-full text-left text-sm">
              <thead className="label-mono border-b border-border text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-normal">When</th>
                  <th className="px-4 py-3 font-normal">Recipient</th>
                  <th className="px-4 py-3 font-normal">Email</th>
                  <th className="px-4 py-3 font-normal">Event</th>
                  <th className="px-4 py-3 font-normal">Reason / status</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs">
                {data.map((row) => (
                  <tr key={row.id} className="border-t border-border/60">
                    <td className="px-4 py-3 whitespace-nowrap">{fmtWhen(row.createdAt)}</td>
                    <td className="px-4 py-3">{row.recipient ?? "—"}</td>
                    <td className="px-4 py-3">{row.label ?? row.subject ?? "—"}</td>
                    <td className={`px-4 py-3 ${eventTone(row.eventType)}`}>{row.eventType}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </main>
    </div>
  );
}
