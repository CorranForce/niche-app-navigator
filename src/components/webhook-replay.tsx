import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listRecentPaddleEvents,
  listWebhookReplays,
  reprocessWebhookEvent,
  type ReplayResult,
} from "@/lib/admin-webhook-replay.functions";

function when(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const OUTCOME_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  applied: "default",
  skipped: "secondary",
  failed: "destructive",
  not_found: "destructive",
  invalid_payload: "destructive",
  pending: "outline",
};

export function WebhookReplaySection() {
  const [eventId, setEventId] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "live">("sandbox");
  const queryClient = useQueryClient();

  const fetchReplays = useServerFn(listWebhookReplays);
  const fetchEvents = useServerFn(listRecentPaddleEvents);
  const runReplay = useServerFn(reprocessWebhookEvent);

  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-webhook-replays"],
    queryFn: () => fetchReplays(),
    retry: false,
  });

  const {
    data: recentEvents,
    isLoading: eventsLoading,
    error: eventsError,
  } = useQuery({
    queryKey: ["admin-paddle-events", environment],
    queryFn: () => fetchEvents({ data: { environment } }),
    retry: false,
  });

  const mutation = useMutation({
    mutationFn: (input: { eventId: string; environment: "sandbox" | "live" }) =>
      runReplay({ data: input }) as Promise<ReplayResult>,
    onSuccess: (result) => {
      toast.success(
        result.applied
          ? `Applied ${result.eventType ?? "event"} to the database.`
          : `Event read but not applied (${result.reason}).`,
      );
      setEventId("");
      void queryClient.invalidateQueries({ queryKey: ["admin-webhook-replays"] });
      void queryClient.invalidateQueries({ queryKey: ["owner-overview"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section id="webhook-replay" className="mt-10 scroll-mt-20">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-muted-foreground" />
        <h2 className="text-lg font-semibold tracking-tight">Reprocess a webhook event</h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Recovery for a single dropped delivery. The event is fetched from the payment provider and
        run through the normal entitlement path: each event id can be reprocessed{" "}
        <strong>once per environment</strong>, and an event older than the stored state is skipped
        rather than rolling a subscription backwards. Customer emails are never re-sent.
      </p>

      <Card className="mt-4 gap-4 border-border bg-surface p-4">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            const trimmed = eventId.trim();
            if (!trimmed) {
              toast.error("Pick an event from the list.");
              return;
            }
            mutation.mutate({ eventId: trimmed, environment });
          }}
        >
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="replay-event-id">Event id</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger id="replay-event-id">
                <SelectValue
                  placeholder={
                    eventsLoading ? "Loading recent events…" : "Pick a recent event"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {recentEvents?.map((e) => (
                  <SelectItem key={e.eventId} value={e.eventId}>
                    <span className="font-mono text-xs">{e.eventId}</span>
                    <span className="ml-2 text-muted-foreground">
                      {e.eventType ?? "unknown"}
                      {e.occurredAt ? ` · ${when(e.occurredAt)}` : ""}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {eventsError ? (
              <p className="text-xs text-destructive">
                {(eventsError as Error).message}
              </p>
            ) : null}
          </div>
          <div className="space-y-1.5 sm:w-40">
            <Label htmlFor="replay-env">Environment</Label>
            <Select
              value={environment}
              onValueChange={(v) => {
                setEnvironment(v as "sandbox" | "live");
                setEventId("");
              }}
            >
              <SelectTrigger id="replay-env">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sandbox">Test</SelectItem>
                <SelectItem value="live">Live</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Reprocess once
          </Button>
        </form>
      </Card>

      {error ? (
        <Card className="mt-4 flex items-center gap-2 border-destructive/40 bg-destructive/10 p-4 text-sm">
          <ShieldAlert className="h-4 w-4 text-destructive" />
          {(error as Error).message}
        </Card>
      ) : null}

      <Card className="mt-4 border-border bg-surface p-4">
        <p className="label-mono text-muted-foreground">Recent reprocess attempts</p>
        {isLoading ? (
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !data?.length ? (
          <p className="mt-3 text-sm text-muted-foreground">No events have been reprocessed yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {data.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
                <Badge variant={OUTCOME_VARIANT[row.outcome] ?? "outline"}>{row.outcome}</Badge>
                <span className="font-mono text-xs">{row.eventId}</span>
                <span className="text-muted-foreground">
                  {row.eventType ?? "unknown"} · {row.environment === "live" ? "live" : "test"}
                </span>
                <span className="ml-auto text-xs text-muted-foreground">{when(row.createdAt)}</span>
                {typeof row.detail?.["reason"] === "string" ? (
                  <span className="w-full text-xs text-muted-foreground">
                    {String(row.detail["reason"])}
                  </span>
                ) : typeof row.detail?.["message"] === "string" ? (
                  <span className="w-full text-xs text-muted-foreground">
                    {String(row.detail["message"])}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}
