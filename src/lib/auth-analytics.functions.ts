import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const rangeInput = z.object({ days: z.union([z.literal(7), z.literal(14), z.literal(30)]).default(14) });

/**
 * Admin-only OAuth telemetry. The caller is authenticated by middleware, the
 * admin role is verified through the security-definer has_role() function, and
 * only then is the service-role client used to read the deny-by-default table.
 */
export const getAuthAnalytics = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => rangeInput.parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { aggregate } = await import("@/lib/auth-analytics.server");
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

    const { data: rows, error } = await supabaseAdmin
      .from("auth_events")
      .select("event, reason, user_agent, ip_prefix, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) throw new Error(error.message);
    return aggregate((rows ?? []) as AuthEventRow[], data.days);
  });

/** Whether the signed-in user may open the internal dashboard. */
export const getIsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { isAdmin: Boolean(data) };
  });
