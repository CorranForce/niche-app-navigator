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
    const { SYSTEM_PROMPT, buildUserPrompt, FREE_MONTHLY_LIMIT } = await import(
      "@/lib/report-prompt.server"
    );

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

    if ((count ?? 0) >= FREE_MONTHLY_LIMIT) {
      throw new Error(
        `You've used all ${FREE_MONTHLY_LIMIT} free reports this month. Upgrade to Pro for unlimited reports.`,
      );
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
            reasoningEffort: "low",
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
      if (message.includes("429")) throw new Error("Too many requests right now — try again in a moment.");
      if (message.includes("402"))
        throw new Error("AI credits are exhausted. Add credits in your workspace settings to continue.");
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
      })
      .select("id")
      .single();

    if (insertError) throw new Error(insertError.message);
    return { id: row.id as string };
  });

export const listReports = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("reports")
      .select("id, niche, audience, budget, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
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
    const { FREE_MONTHLY_LIMIT } = await import("@/lib/report-prompt.server");
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);
    const { count } = await context.supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("created_at", monthStart.toISOString());
    return { used: count ?? 0, limit: FREE_MONTHLY_LIMIT };
  });
