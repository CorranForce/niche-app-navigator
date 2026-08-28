import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AGGREGATE_ROW_CAP,
  authAnalyticsInput,
  hasMorePages,
  pageRange,
  truncateReason,
} from "@/lib/auth-analytics-guards";

/**
 * Admin-only OAuth telemetry. The caller is authenticated by middleware, the
 * admin role is verified through the security-definer has_role() function, and
 * only then is the service-role client used to read the deny-by-default table.
 *
 * Overexposure safeguards: unknown input keys are rejected, the event log is
 * paginated server-side with a hard page/page-size ceiling, only non-PII
 * columns are selected, and aggregation reads a bounded row window.
 */
export const getAuthAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => authAnalyticsInput.parse(input ?? {}))

  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { aggregate, browserLabel } = await import("@/lib/auth-analytics.server");
    type AuthEventRow = import("@/lib/auth-analytics.server").AuthEventRow;

    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify access.");
    if (!isAdmin) throw new Error("Admins only.");

    const since = new Date();
    since.setUTCHours(0, 0, 0, 0);
    since.setUTCDate(since.getUTCDate() - (data.days - 1));
    const sinceIso = since.toISOString();

    const { data: rows, error } = await supabaseAdmin
      .from("auth_events")
      .select("event, reason, user_agent, ip_prefix, created_at")
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(AGGREGATE_ROW_CAP);

    if (error) throw new Error(error.message);

    // Event log: fetched as its own bounded page rather than sliced client-side.
    const pageSize = Math.min(data.pageSize, MAX_PAGE_SIZE);
    const from = Math.min(data.page, MAX_PAGE) * pageSize;
    const {
      data: pageRows,
      count,
      error: pageError,
    } = await supabaseAdmin
      .from("auth_events")
      .select("event, reason, user_agent, ip_prefix, created_at", { count: "exact" })
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (pageError) throw new Error(pageError.message);

    const total = count ?? 0;
    const recent = ((pageRows ?? []) as AuthEventRow[]).map((r) => ({
      created_at: r.created_at,
      event: r.event,
      reason: r.reason ? r.reason.slice(0, 200) : null,
      browser: browserLabel(r.user_agent),
      ip_prefix: r.ip_prefix,
    }));

    return {
      ...aggregate((rows ?? []) as AuthEventRow[], data.days),
      recent,
      pagination: {
        page: Math.min(data.page, MAX_PAGE),
        pageSize,
        total,
        hasMore: from + recent.length < total && Math.min(data.page, MAX_PAGE) < MAX_PAGE,
      },
    };
  });


/** Whether the signed-in user may open the internal dashboard. */
export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    return { isAdmin: Boolean(data) };
  });
