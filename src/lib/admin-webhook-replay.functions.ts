import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type WebhookReplayRow = {
  id: string;
  eventId: string;
  environment: string;
  eventType: string | null;
  outcome: string;
  detail: Record<string, string | number | boolean | null>;
  createdAt: string;
};

export type ReplayResult = {
  ok: boolean;
  eventId: string;
  environment: string;
  eventType: string | null;
  applied: boolean;
  reason: string;
};

const replayInput = z.object({
  eventId: z
    .string()
    .trim()
    .min(6)
    .max(120)
    .regex(/^[A-Za-z0-9_-]+$/, "Event id may only contain letters, numbers, dashes and underscores"),
  environment: z.enum(["sandbox", "live"]),
});

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: isAdmin, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify access.");
  if (!isAdmin) throw new Error("Admins only.");
}

/** Recent manual reprocess attempts, newest first. */
export const listWebhookReplays = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WebhookReplayRow[]> => {
    await assertAdmin(context.userId);
    const { data, error } = await context.supabase
      .from("webhook_replays")
      .select("id, event_id, environment, event_type, outcome, detail, created_at")
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((data ?? []) as any[]).map((row) => ({
      id: String(row.id),
      eventId: String(row.event_id),
      environment: String(row.environment),
      eventType: row.event_type ?? null,
      outcome: String(row.outcome),
      detail: (row.detail ?? {}) as Record<string, string | number | boolean | null>,
      createdAt: String(row.created_at),
    }));
  });

/**
 * Admin-only recovery for a single dropped webhook delivery.
 *
 * Replay-loop guard: a unique claim row in `webhook_replays` is inserted first,
 * so the same event id can only ever be reprocessed once per environment — a
 * second attempt (or two admins clicking at the same time) is rejected before
 * any write happens. Out-of-order guard: the event is applied through the exact
 * same `applyPaddleEvent` path as live deliveries, which compares the event's
 * `occurred_at` against the stored `updated_at` and refuses to roll state back.
 */
export const reprocessWebhookEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => replayInput.parse(raw))
  .handler(async ({ data, context }): Promise<ReplayResult> => {
    await assertAdmin(context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const env = data.environment;

    // 1. Claim the event id. The unique (event_id, environment) index makes this
    //    the single source of truth for "already replayed".
    const { error: claimError } = await supabaseAdmin.from("webhook_replays").insert({
      event_id: data.eventId,
      environment: env,
      actor_id: context.userId,
      outcome: "pending",
    });
    if (claimError) {
      if (claimError.code === "23505") {
        throw new Error("This event id has already been reprocessed in this environment.");
      }
      throw new Error(claimError.message);
    }

    const finish = async (outcome: string, detail: Record<string, string | number | boolean | null>) => {
      await supabaseAdmin
        .from("webhook_replays")
        .update({ outcome, detail, updated_at: new Date().toISOString() })
        .eq("event_id", data.eventId)
        .eq("environment", env);
    };

    try {
      // 2. Fetch the canonical event from Paddle — never from client input.
      const { gatewayFetch } = await import("@/lib/paddle.server");
      const res = await gatewayFetch(env, `/events?per_page=1&id=${encodeURIComponent(data.eventId)}`);
      let payload: Record<string, unknown> | null = null;
      if (res.ok) {
        const json = (await res.json()) as { data?: Array<Record<string, unknown>> };
        payload = json.data?.[0] ?? null;
      }
      if (!payload) {
        const single = await gatewayFetch(env, `/events/${encodeURIComponent(data.eventId)}`);
        if (single.ok) {
          const json = (await single.json()) as { data?: Record<string, unknown> };
          payload = json.data ?? null;
        }
      }
      if (!payload) {
        await finish("not_found", { message: "Paddle has no event with that id." });
        throw new Error("No Paddle event found with that id in this environment.");
      }

      const { applyPaddleEvent, toCamelCase, normalisedOccurredAt } = await import(
        "@/lib/webhook-apply.server"
      );
      const eventType = String(payload["event_type"] ?? payload["eventType"] ?? "");
      const occurredAt = normalisedOccurredAt(payload["occurred_at"] ?? payload["occurredAt"]);
      const eventData = toCamelCase(payload["data"]);
      if (!eventData || typeof eventData !== "object") {
        await finish("invalid_payload", { eventType });
        throw new Error("The Paddle event has no usable data payload.");
      }

      const outcome = await applyPaddleEvent({
        eventType,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: eventData as any,
        env,
        occurredAt,
        // Replays must not re-send invoices or dunning mail to customers.
        sendEmails: false,
      });

      await finish(outcome.applied ? "applied" : "skipped", {
        eventType,
        occurredAt,
        reason: outcome.reason,
      });

      const { recordSystemEvent } = await import("@/lib/monitoring.server");
      await recordSystemEvent({
        source: "webhook",
        severity: "info",
        event: "paddle.event_reprocessed",
        message: `Admin reprocessed ${eventType} (${outcome.applied ? "applied" : "skipped"}: ${outcome.reason}).`,
        context: { env, eventId: data.eventId, eventType },
      });

      return {
        ok: true,
        eventId: data.eventId,
        environment: env,
        eventType,
        applied: outcome.applied,
        reason: outcome.reason,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : "Unknown error";
      await finish("failed", { message });
      throw e instanceof Error ? e : new Error(message);
    }
  });
