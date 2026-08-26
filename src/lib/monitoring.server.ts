/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Server-only production monitoring sink.
 *
 * Every recoverable failure in the payment webhook, the OAuth/consent flow and
 * the MCP tool surface is written to `public.system_events` (service-role only)
 * and, when severity is `critical`, emailed to the platform owner with a
 * per-key throttle so a flapping integration cannot spam the inbox.
 *
 * Recording is best-effort: it never throws into the caller's happy path.
 */
import { createClient } from "@supabase/supabase-js";

export type SystemEventSource = "webhook" | "oauth" | "consent" | "mcp" | "email" | "other";
export type SystemEventSeverity = "info" | "warning" | "critical";

export interface SystemEventInput {
  source: SystemEventSource;
  severity: SystemEventSeverity;
  /** Stable machine key, e.g. `paddle.webhook_failed` or `mcp.tool_error`. */
  event: string;
  message?: string | null;
  context?: Record<string, unknown>;
}

/** Minutes between owner alert emails for the same source+event key. */
const ALERT_THROTTLE_MINUTES = 60;
const OWNER_EMAIL = process.env["OWNER_ALERT_EMAIL"] ?? "corranforce@gmail.com";
const APP_URL = process.env["APP_BASE_URL"] ?? "https://freedomopsai.dev";

let _admin: ReturnType<typeof createClient<any, any, any>> | null = null;
function admin() {
  if (!_admin) {
    _admin = createClient<any, any, any>(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return _admin;
}

/** Trim anything that could carry secrets or unbounded payloads. */
function safeContext(context: Record<string, unknown> | undefined) {
  if (!context) return {};
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context).slice(0, 20)) {
    if (/token|secret|key|password|authorization/i.test(key)) continue;
    out[key] = typeof value === "string" ? value.slice(0, 500) : value;
  }
  return out;
}

export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error).slice(0, 500);
  } catch {
    return "Unknown error";
  }
}

async function maybeAlert(row: { id: string } & SystemEventInput) {
  if (row.severity !== "critical") return;
  const since = new Date(Date.now() - ALERT_THROTTLE_MINUTES * 60_000).toISOString();

  const { data: recent } = await admin()
    .from("system_events")
    .select("id")
    .eq("source", row.source)
    .eq("event", row.event)
    .not("alerted_at", "is", null)
    .gt("alerted_at", since)
    .limit(1);
  if (recent && recent.length > 0) return;

  try {
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    await sendTemplateEmail("system-alert", OWNER_EMAIL, {
      templateData: {
        source: row.source,
        event: row.event,
        message: row.message ?? "No further detail.",
        context: JSON.stringify(safeContext(row.context), null, 2),
        occurredAt: new Date().toUTCString(),
        dashboardUrl: `${APP_URL}/admin#monitoring`,
      },
      idempotencyKey: `system-alert-${row.id}`,
    });
    await admin()
      .from("system_events")
      .update({ alerted_at: new Date().toISOString() })
      .eq("id", row.id);
  } catch (error) {
    console.error("system alert email failed", describeError(error));
  }
}

/** Best-effort write of one monitoring event. Never throws. */
export async function recordSystemEvent(input: SystemEventInput): Promise<void> {
  try {
    const { data, error } = await admin()
      .from("system_events")
      .insert({
        source: input.source,
        severity: input.severity,
        event: input.event,
        message: input.message?.slice(0, 1000) ?? null,
        context: safeContext(input.context),
      })
      .select("id")
      .single();

    if (error) {
      console.error("system_events insert failed", error.message);
      return;
    }
    await maybeAlert({ ...input, id: (data as { id: string }).id });
  } catch (error) {
    console.error("recordSystemEvent failed", describeError(error));
  }
}
