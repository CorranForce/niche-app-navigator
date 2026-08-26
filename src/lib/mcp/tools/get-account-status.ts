import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";
import { entitledPlan, limitForPlan, PLAN_LABELS } from "@/lib/plan-limits";

export default defineTool({
  name: "get_account_status",
  title: "Get account status",
  description:
    "Report the signed-in user's plan, monthly report allowance, reports used this month and subscription status.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [{ count, error: countError }, { data: sub, error: subError }] = await Promise.all([
      supabase
        .from("reports")
        .select("id", { count: "exact", head: true })
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("subscriptions")
        .select("status, product_id, current_period_end, cancel_at_period_end")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const error = countError ?? subError;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    const plan = entitledPlan(sub);
    const limit = limitForPlan(plan);
    const status = {
      email: ctx.getUserEmail() ?? null,
      plan,
      planLabel: PLAN_LABELS[plan],
      monthlyLimit: limit,
      reportsThisMonth: count ?? 0,
      remaining: limit === null ? "unlimited" : Math.max(0, limit - (count ?? 0)),
      subscriptionStatus: sub?.status ?? "none",
      currentPeriodEnd: sub?.current_period_end ?? null,
      cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
    };

    return {
      content: [{ type: "text", text: JSON.stringify(status, null, 2) }],
      structuredContent: status,
    };
  },
});
