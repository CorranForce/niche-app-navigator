import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Full export of everything the account owns, as a JSON payload. */
export const exportMyData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [profile, reports, subscriptions] = await Promise.all([
      context.supabase.from("profiles").select("*").eq("id", context.userId).maybeSingle(),
      context.supabase
        .from("reports")
        .select("id, niche, audience, budget, payload, created_at, team_id")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: false }),
      context.supabase
        .from("subscriptions")
        .select(
          "paddle_subscription_id, product_id, price_id, status, current_period_start, current_period_end, cancel_at_period_end, environment, created_at",
        )
        .eq("user_id", context.userId),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      account: {
        id: context.userId,
        email: (context.claims as { email?: string } | undefined)?.email ?? null,
      },
      profile: profile.data ?? null,
      reports: reports.data ?? [],
      subscriptions: subscriptions.data ?? [],
    };
  });

/**
 * Permanently deletes the account. Cancels any live subscription with the
 * payment provider first so the customer is never billed after deletion.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(input))
  .handler(async ({ context }) => {
    const { data: subs } = await context.supabase
      .from("subscriptions")
      .select("paddle_subscription_id, environment, status")
      .eq("user_id", context.userId);

    const cancellable = (subs ?? []).filter(
      (s) => s.status !== "canceled" && s.paddle_subscription_id,
    );

    if (cancellable.length) {
      const { getPaddleClient } = await import("@/lib/paddle.server");
      for (const sub of cancellable) {
        try {
          const paddle = getPaddleClient(sub.environment as "sandbox" | "live");
          await paddle.subscriptions.cancel(sub.paddle_subscription_id as string, {
            effectiveFrom: "immediately",
          });
        } catch (error) {
          // Never block deletion on a provider hiccup — record it for the owner.
          const { recordSystemEvent, describeError } = await import("@/lib/monitoring.server");
          await recordSystemEvent({
            source: "webhook",
            severity: "critical",
            event: "account.delete_cancel_failed",
            message: describeError(error),
            context: { subscriptionId: sub.paddle_subscription_id, env: sub.environment },
          });
        }
      }
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);

    return { deleted: true };
  });
