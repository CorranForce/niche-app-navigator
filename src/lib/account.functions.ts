import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type EnsureAccountResult = {
  created: boolean;
  plan: "free" | "pro" | "studio";
};

/**
 * Called right after a sign-in (Google or email). Looks the signed-in user's
 * account up in the database and provisions a free-tier account row if this is
 * the first time we've seen that email. Idempotent — safe to call on every
 * sign-in.
 */
export const ensureAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EnsureAccountResult> => {
    const { entitledPlan } = await import("@/lib/plan-limits");
    const { supabase, userId, claims } = context;

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", userId)
      .maybeSingle();

    let created = false;
    if (!existing) {
      const meta = (claims as { user_metadata?: Record<string, unknown> } | undefined)
        ?.user_metadata;
      const email = (claims as { email?: string } | undefined)?.email ?? "";
      const displayName =
        (typeof meta?.["full_name"] === "string" ? (meta["full_name"] as string) : undefined) ??
        (typeof meta?.["name"] === "string" ? (meta["name"] as string) : undefined) ??
        (email ? email.split("@")[0] : null);

      const { error } = await supabase
        .from("profiles")
        .insert({ id: userId, display_name: displayName ?? null });
      // A concurrent sign-in may have inserted the same row first.
      if (error && error.code !== "23505") throw error;
      created = true;
    }

    const paymentsEnv = import.meta.env.PROD ? "live" : "sandbox";
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, product_id, current_period_end")
      .eq("user_id", userId)
      .eq("environment", paymentsEnv)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return { created, plan: entitledPlan(sub) };
  });
