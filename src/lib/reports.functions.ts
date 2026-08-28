import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { reportSchema } from "@/lib/report-schema";
import { z } from "zod";

const generateInput = z.object({
  niche: z.string().min(2).max(120),
  audience: z.string().max(60).default("unspecified"),
  budget: z.string().max(60).default("unspecified"),
});

export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => generateInput.parse(input))
  .handler(async ({ data, context }) => {
    const { streamText, Output, NoObjectGeneratedError } = await import("ai");
    const { createLovableResponsesProvider } = await import("@/lib/ai-gateway.server");
    const { SYSTEM_PROMPT, buildUserPrompt } = await import("@/lib/report-prompt.server");
    const {
      entitledPlan,
      limitForPlan,
      planFeatures,
      PLAN_LABELS,
      STANDARD_QUEUE_COOLDOWN_SECONDS,
    } = await import("@/lib/plan-limits");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("AI is not configured for this project yet.");

    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count } = await context.supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", monthStart.toISOString());

    const paymentsEnv = import.meta.env.PROD ? "live" : "sandbox";
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("status, product_id, current_period_end")
      .eq("user_id", context.userId)
      .eq("environment", paymentsEnv)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const plan = entitledPlan(sub);
    const limit = limitForPlan(plan);
    const features = planFeatures(plan);

    if (!features.generate) {
      throw new Error(
        sub?.status === "past_due"
          ? "Your last payment failed, so report generation is paused. Update your payment method on the billing page to continue."
          : "Start a plan to generate reports — every plan includes a 7-day free trial. Pick one on the billing page.",
      );
    }

    if (limit !== null && (count ?? 0) >= limit) {
      throw new Error(
        `You've used all ${limit} reports on the ${PLAN_LABELS[plan]} plan this month. ${
          plan === "solo"
            ? "Upgrade to Pro for 50 reports a month, or Studio for unlimited."
            : "Upgrade to Studio for unlimited reports."
        }`,
      );
    }

    // Priority queue: Pro and Studio skip the standard cooldown between generations.
    let teamId: string | null = null;
    if (!features.priorityQueue) {
      const { data: last } = await context.supabase
        .from("reports")
        .select("created_at")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const lastAt = last?.created_at ? new Date(last.created_at as string).getTime() : 0;
      const waited = (Date.now() - lastAt) / 1000;
      if (lastAt && waited < STANDARD_QUEUE_COOLDOWN_SECONDS) {
        throw new Error(
          `You're in the standard generation queue — try again in ${Math.ceil(
            STANDARD_QUEUE_COOLDOWN_SECONDS - waited,
          )}s. Pro and Studio plans skip the queue.`,
        );
      }
    }

    if (features.team) {
      const { ensureTeamForOwner } = await import("@/lib/teams.server");
      teamId = await ensureTeamForOwner(context.supabase, context.userId);
    }

    const provider = createLovableResponsesProvider(apiKey);

    let payload;
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-5.6-sol"),
        system: SYSTEM_PROMPT,
        prompt: buildUserPrompt(data),
        output: Output.object({ schema: reportSchema }),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: features.priorityQueue ? "medium" : "low",
            reasoningSummary: "auto",
            store: false,
          },
        },
      });
      payload = await result.output;
    } catch (error) {
      if (NoObjectGeneratedError.isInstance(error)) {
        throw new Error("The model returned an unusable report. Please try again.");
      }
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("429"))
        throw new Error("Too many requests right now — try again in a moment.");
      if (message.includes("402"))
        throw new Error(
          "AI credits are exhausted. Add credits in your workspace settings to continue.",
        );
      throw new Error(`Report generation failed: ${message}`);
    }

    const { data: row, error: insertError } = await context.supabase
      .from("reports")
      .insert({
        user_id: context.userId,
        niche: data.niche,
        audience: data.audience,
        budget: data.budget,
        payload,
        team_id: teamId,
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);
    return { id: row.id as string };
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { teamIdsForUser } = await import("@/lib/teams.server");
    const teamIds = await teamIdsForUser(context.supabase, context.userId);

    let query = context.supabase
      .from("reports")
      .select("id, niche, audience, budget, created_at, user_id, team_id");
    query = teamIds.length
      ? query.or(`user_id.eq.${context.userId},team_id.in.(${teamIds.join(",")})`)
      : query.eq("user_id", context.userId);

    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({ ...r, shared: r.user_id !== context.userId }));
  });

/** Side-by-side comparison payloads (Studio only). */
export const compareReports = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(2).max(3) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { entitledPlan, planFeatures } = await import("@/lib/plan-limits");
    const paymentsEnv = import.meta.env.PROD ? "live" : "sandbox";
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("status, product_id, current_period_end")
      .eq("user_id", context.userId)
      .eq("environment", paymentsEnv)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!planFeatures(entitledPlan(sub)).compare) {
      throw new Error("Side-by-side comparison is part of the Studio plan.");
    }

    const { data: rows, error } = await context.supabase
      .from("reports")
      .select("id, niche, audience, created_at, payload")
      .in("id", data.ids);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("reports")
      .select("id, niche, audience, budget, created_at, payload")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("reports").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { entitledPlan, limitForPlan } = await import("@/lib/plan-limits");
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count } = await context.supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", monthStart.toISOString());
    const paymentsEnv = import.meta.env.PROD ? "live" : "sandbox";
    const { data: sub } = await context.supabase
      .from("subscriptions")
      .select("status, product_id, current_period_end")
      .eq("user_id", context.userId)
      .eq("environment", paymentsEnv)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const plan = entitledPlan(sub);
    return { used: count ?? 0, limit: limitForPlan(plan), plan };
  });
