import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type OwnerOverview = {
  users: { total: number; new7d: number; new30d: number; onboarded: number };
  plans: { none: number; solo: number; pro: number; studio: number };
  revenue: { mrrCents: number; pastDue: number; cancelScheduled: number };
  reports: { total: number; last7d: number; last30d: number };
  auth: { events7d: number; failures7d: number };
  recentSignups: Array<{ id: string; email: string | null; createdAt: string | null }>;
  recentReports: Array<{ id: string; niche: string; createdAt: string | null }>;
};

const PLAN_PRICE_CENTS: Record<string, number> = { solo: 900, pro: 1900, studio: 4900 };

/** Owner-only aggregate snapshot of accounts, revenue, usage and auth health. */
export const getOwnerOverview = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({ environment: z.enum(["sandbox", "live"]).default("sandbox") })
      .parse(raw ?? {}),
  )
  .handler(async ({ data, context }): Promise<OwnerOverview> => {
    const { supabaseAdmin: adminForRole } = await import("@/integrations/supabase/client.server");
    const { data: isAdmin, error: roleError } = await adminForRole.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify access.");
    if (!isAdmin) throw new Error("Admins only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { entitledPlan, isPastDue } = await import("@/lib/plan-limits");

    const now = Date.now();
    const iso = (daysAgo: number) => new Date(now - daysAgo * 86_400_000).toISOString();
    const since7 = iso(7);
    const since30 = iso(30);

    const [profilesRes, subsRes, reportsRes, authRes] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("id, email, created_at, onboarded_at")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, product_id, status, current_period_end, cancel_at_period_end, created_at, environment")
        .order("created_at", { ascending: false }),
      supabaseAdmin
        .from("reports")
        .select("id, niche, created_at")
        .order("created_at", { ascending: false })
        .limit(2000),
      supabaseAdmin.from("auth_events").select("event, created_at").gte("created_at", since7),
    ]);

    const profiles = profilesRes.data ?? [];
    const subs = (subsRes.data ?? []).filter((s) => (s.environment ?? "sandbox") === data.environment);
    const reports = reportsRes.data ?? [];
    const authEvents = authRes.data ?? [];

    type SubRow = (typeof subs)[number];
    const latest = new Map<string, SubRow>();
    for (const s of subs) if (!latest.has(s.user_id)) latest.set(s.user_id, s);

    const plans = { none: 0, solo: 0, pro: 0, studio: 0 };
    let mrrCents = 0;
    let pastDue = 0;
    let cancelScheduled = 0;

    for (const p of profiles) {
      const sub = latest.get(p.id) ?? null;
      const plan = entitledPlan(sub);
      plans[plan] += 1;
      if (plan !== "none") mrrCents += PLAN_PRICE_CENTS[plan] ?? 0;
      if (isPastDue(sub?.status)) pastDue += 1;
      if (sub?.cancel_at_period_end) cancelScheduled += 1;
    }

    const after = (value: string | null | undefined, cutoff: string) =>
      Boolean(value && value >= cutoff);

    const failureEvents = new Set(["oauth_error", "oauth_timeout", "callback_error", "error"]);

    return {
      users: {
        total: profiles.length,
        new7d: profiles.filter((p) => after(p.created_at, since7)).length,
        new30d: profiles.filter((p) => after(p.created_at, since30)).length,
        onboarded: profiles.filter((p) => Boolean(p.onboarded_at)).length,
      },
      plans,
      revenue: { mrrCents, pastDue, cancelScheduled },
      reports: {
        total: reports.length,
        last7d: reports.filter((r) => after(r.created_at, since7)).length,
        last30d: reports.filter((r) => after(r.created_at, since30)).length,
      },
      auth: {
        events7d: authEvents.length,
        failures7d: authEvents.filter((e) => failureEvents.has(String(e.event))).length,
      },
      recentSignups: profiles.slice(0, 8).map((p) => ({
        id: p.id,
        email: p.email ?? null,
        createdAt: p.created_at ?? null,
      })),
      recentReports: reports.slice(0, 8).map((r) => ({
        id: r.id,
        niche: r.niche,
        createdAt: r.created_at ?? null,
      })),
    };
  });
