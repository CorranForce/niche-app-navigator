import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type SystemEventRow = {
  id: string;
  createdAt: string;
  source: string;
  severity: string;
  event: string;
  message: string | null;
  context: Record<string, string | number | boolean | null>;
  alertedAt: string | null;
};

export type SystemHealth = {
  days: number;
  totals: { critical: number; warning: number; info: number };
  bySource: Array<{ source: string; total: number; critical: number }>;
  daily: Array<{ day: string; total: number; critical: number }>;
  topEvents: Array<{ event: string; source: string; total: number; lastSeen: string }>;
  recent: SystemEventRow[];
};

const input = z
  .object({
    days: z.number().int().min(1).max(90).default(14),
    source: z.enum(["webhook", "oauth", "consent", "mcp", "email", "other"]).optional(),
  })
  .default({ days: 14 });

/** Owner-only production monitoring feed built from public.system_events. */
export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => input.parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<SystemHealth> => {
    const { supabaseAdmin: adminForRole } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin, error: roleError } = await adminForRole.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify access.");
    if (!isAdmin) throw new Error("Admins only.");

    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();
    let query = context.supabase
      .from("system_events")
      .select("id, created_at, source, severity, event, message, context, alerted_at")
      .gt("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1000);
    if (data.source) query = query.eq("source", data.source);

    const { data: rows, error } = await query;
    if (error) throw new Error(error.message);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const events = (rows ?? []) as any[];

    const totals = { critical: 0, warning: 0, info: 0 };
    const sources = new Map<string, { total: number; critical: number }>();
    const daily = new Map<string, { total: number; critical: number }>();
    const byEvent = new Map<string, { source: string; total: number; lastSeen: string }>();

    for (const row of events) {
      const severity = String(row.severity) as keyof typeof totals;
      if (severity in totals) totals[severity] += 1;
      const critical = severity === "critical" ? 1 : 0;

      const source = String(row.source);
      const s = sources.get(source) ?? { total: 0, critical: 0 };
      sources.set(source, { total: s.total + 1, critical: s.critical + critical });

      const day = String(row.created_at).slice(0, 10);
      const d = daily.get(day) ?? { total: 0, critical: 0 };
      daily.set(day, { total: d.total + 1, critical: d.critical + critical });

      const key = `${source}:${row.event}`;
      const e = byEvent.get(key);
      if (e) e.total += 1;
      else byEvent.set(key, { source, total: 1, lastSeen: String(row.created_at) });
    }

    return {
      days: data.days,
      totals,
      bySource: [...sources.entries()]
        .map(([source, v]) => ({ source, ...v }))
        .sort((a, b) => b.total - a.total),
      daily: [...daily.entries()]
        .map(([day, v]) => ({ day, ...v }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      topEvents: [...byEvent.entries()]
        .map(([key, v]) => ({ event: key.split(":").slice(1).join(":"), ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 8),
      recent: events.slice(0, 40).map((row) => ({
        id: String(row.id),
        createdAt: String(row.created_at),
        source: String(row.source),
        severity: String(row.severity),
        event: String(row.event),
        message: row.message ?? null,
        context: (row.context ?? {}) as Record<string, string | number | boolean | null>,
        alertedAt: row.alerted_at ?? null,
      })),
    };
  });
