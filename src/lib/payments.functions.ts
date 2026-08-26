import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const envSchema = z.enum(["sandbox", "live"]);

export const resolvePaddlePrice = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) =>
    z.object({ priceId: z.string().min(1).max(80), environment: envSchema }).parse(data),
  )
  .handler(async ({ data }) => {
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const response = await gatewayFetch(
      data.environment,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const result = (await response.json()) as { data?: Array<{ id: string }> };
    if (!result.data?.length) throw new Error("Price not found");
    return result.data[0]!.id;
  });

/** Opens Paddle's hosted portal so the customer can change payment method, view invoices or cancel. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_subscription_id, paddle_customer_id, environment")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub) throw new Error("No subscription found for this account.");

    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(sub.environment as "sandbox" | "live");
    const session = await paddle.customerPortalSessions.create(sub.paddle_customer_id, [
      sub.paddle_subscription_id,
    ]);

    const perSub = session.urls?.subscriptions?.find((s) => s.id === sub.paddle_subscription_id);

    return {
      overviewUrl: session.urls?.general?.overview ?? null,
      cancelUrl: perSub?.cancelSubscription ?? null,
      updatePaymentUrl: perSub?.updateSubscriptionPaymentMethod ?? null,
    };
  });

/** Switches the active subscription to a different price, effective at the next renewal. */
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ priceId: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_subscription_id, environment, status")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub || sub.status === "canceled") {
      throw new Error("No active subscription to change. Start a new plan instead.");
    }

    const env = sub.environment as "sandbox" | "live";
    const { getPaddleClient, gatewayFetch } = await import("@/lib/paddle.server");

    const priceRes = await gatewayFetch(
      env,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const priceJson = (await priceRes.json()) as { data?: Array<{ id: string }> };
    const paddlePriceId = priceJson.data?.[0]?.id;
    if (!paddlePriceId) throw new Error("That plan is not available right now.");

    const paddle = getPaddleClient(env);
    await paddle.subscriptions.update(sub.paddle_subscription_id, {
      items: [{ priceId: paddlePriceId, quantity: 1 }],
      prorationBillingMode: "full_next_billing_period",
    });

    return { ok: true };
  });

/** Cancels the active subscription at the end of the current billing period. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: sub, error } = await context.supabase
      .from("subscriptions")
      .select("paddle_subscription_id, environment, status")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub || sub.status === "canceled") throw new Error("No active subscription to cancel.");

    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(sub.environment as "sandbox" | "live");
    await paddle.subscriptions.cancel(sub.paddle_subscription_id, {
      effectiveFrom: "next_billing_period",
    });

    return { ok: true };
  });
