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
    if (!result.data?.length) {
      throw new Error(
        data.environment === "live"
          ? "Live checkout isn't available yet — this plan hasn't been activated for live payments. Please try again once the account is verified."
          : "Price not found",
      );
    }
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
      .select("paddle_subscription_id, environment, status, price_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(error.message);
    if (!sub || sub.status === "canceled") {
      throw new Error("No active subscription to change. Start a new plan instead.");
    }

    const env = sub.environment as "sandbox" | "live";
    if (sub.price_id === data.priceId) {
      throw new Error("You're already on that plan.");
    }
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

/**
 * Recovery path for a delayed or dropped webhook: pulls the caller's live
 * subscription state straight from the payment provider and writes it to the
 * database, so entitlements never depend on a single webhook delivery.
 */
export const syncSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { gatewayFetch } = await import("@/lib/paddle.server");
    const { paymentsEnv } = await import("@/lib/payments-env");
    const env = paymentsEnv();

    const claims = context.claims as { email?: string } | undefined;
    const email = typeof claims?.email === "string" ? claims.email.toLowerCase() : "";

    // Known customer id from a previous row, otherwise look the customer up by email.
    const { data: known } = await context.supabase
      .from("subscriptions")
      .select("paddle_customer_id")
      .eq("user_id", context.userId)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let customerId = (known?.paddle_customer_id as string | undefined) ?? undefined;
    if (!customerId && email) {
      const res = await gatewayFetch(env, `/customers?email=${encodeURIComponent(email)}`);
      const json = (await res.json()) as { data?: Array<{ id: string }> };
      customerId = json.data?.[0]?.id;
    }
    if (!customerId) return { synced: false, reason: "no_customer" as const };

    const subsRes = await gatewayFetch(
      env,
      `/subscriptions?customer_id=${encodeURIComponent(customerId)}&per_page=20`,
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subsJson = (await subsRes.json()) as { data?: any[] };
    const list = subsJson.data ?? [];
    if (!list.length) return { synced: false, reason: "no_subscription" as const };

    const rank: Record<string, number> = {
      active: 4,
      trialing: 4,
      past_due: 3,
      paused: 2,
      canceled: 1,
    };
    const best = [...list].sort(
      (a, b) =>
        (rank[b.status] ?? 0) - (rank[a.status] ?? 0) ||
        new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime(),
    )[0];

    const item = best.items?.[0];
    const priceExternal = item?.price?.import_meta?.external_id as string | undefined;
    const productExternal = item?.product?.import_meta?.external_id as string | undefined;
    if (!priceExternal || !productExternal) {
      return { synced: false, reason: "missing_external_ids" as const };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: upsertError } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: context.userId,
        paddle_subscription_id: best.id,
        paddle_customer_id: customerId,
        product_id: productExternal,
        price_id: priceExternal,
        status: best.status,
        current_period_start: best.current_billing_period?.starts_at ?? null,
        current_period_end: best.current_billing_period?.ends_at ?? null,
        cancel_at_period_end: best.scheduled_change?.action === "cancel",
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    );
    if (upsertError) throw new Error(upsertError.message);

    return { synced: true, status: best.status as string, productId: productExternal };
  });
