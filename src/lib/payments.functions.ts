/* eslint-disable @typescript-eslint/no-explicit-any */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import {
  isManageable,
  isResumable,
  pickBillableSubscription,
  type SelectableSubscription,
} from "@/lib/subscription-select";

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

/**
 * Mints a signed checkout intent that binds this checkout to the signed-in
 * user. The browser passes it to Paddle as opaque custom data; the webhook
 * verifies the signature to decide which account the subscription belongs to,
 * so a client can never attribute a purchase to somebody else's account.
 */
export const createCheckoutIntent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ priceId: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    const { signCheckoutIntent } = await import("@/lib/checkout-token.server");
    const { paymentsEnv } = await import("@/lib/payments-env");
    return {
      checkoutToken: signCheckoutIntent({
        uid: context.userId,
        price: data.priceId,
        env: paymentsEnv(),
      }),
    };
  });

/**
 * Loads the subscription row a management action should target. Ranked by how
 * live the subscription is, so a newer canceled row can never shadow the one
 * that is still billing.
 */
async function loadTargetSubscription(
  supabase: { from: (t: string) => any },
  userId: string,
): Promise<SelectableSubscription | null> {
  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "paddle_subscription_id, paddle_customer_id, environment, status, price_id, cancel_at_period_end, current_period_end, created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return pickBillableSubscription((data ?? []) as SelectableSubscription[]);
}

/** Opens Paddle's hosted portal so the customer can change payment method, view invoices or cancel. */
export const createPortalSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sub = await loadTargetSubscription(context.supabase, context.userId);
    if (!sub?.paddle_customer_id) throw new Error("No subscription found for this account.");

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

/**
 * Switches the subscription to a different price.
 *
 * Both upgrades and downgrades take effect at the next renewal with no mid-cycle
 * proration, so the customer always keeps what the current period paid for.
 */
export const changePlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ priceId: z.string().min(1).max(80) }).parse(data))
  .handler(async ({ data, context }) => {
    const sub = await loadTargetSubscription(context.supabase, context.userId);
    if (!isManageable(sub)) {
      throw new Error("No active subscription to change. Start a new plan instead.");
    }
    const target = sub!;

    const env = target.environment as "sandbox" | "live";
    if (target.price_id === data.priceId) {
      throw new Error("You're already on that plan.");
    }
    const { getPaddleClient, gatewayFetch } = await import("@/lib/paddle.server");

    // The payment provider only accepts a replacement price that bills on the
    // same cycle and currency as the live subscription. Switching monthly <->
    // yearly has to go through cancel + re-subscribe, so reject it up front
    // with a message the customer can act on instead of a provider error.
    const currentIsYearly = (target.price_id ?? "").endsWith("_yearly");
    if (data.priceId.endsWith("_yearly") !== currentIsYearly) {
      throw new Error(
        `Your subscription bills ${currentIsYearly ? "yearly" : "monthly"}. Use "Switch billing period" to move to ${currentIsYearly ? "monthly" : "yearly"} billing.`,
      );
    }

    const priceRes = await gatewayFetch(
      env,
      `/prices?external_id=${encodeURIComponent(data.priceId)}`,
    );
    const priceJson = (await priceRes.json()) as {
      data?: Array<{
        id: string;
        billing_cycle?: { interval?: string; frequency?: number } | null;
        unit_price?: { currency_code?: string } | null;
      }>;
    };
    const price = priceJson.data?.[0];
    if (!price?.id) throw new Error("That plan is not available right now.");
    if (price.billing_cycle?.interval !== (currentIsYearly ? "year" : "month")) {
      throw new Error(
        "That plan bills on a different schedule than your current subscription. Cancel and re-subscribe to change billing periods.",
      );
    }

    const paddle = getPaddleClient(env);
    await paddle.subscriptions.update(target.paddle_subscription_id, {
      items: [{ priceId: price.id, quantity: 1 }],
      prorationBillingMode: "full_next_billing_period",
    });

    return { ok: true, effectiveAt: target.current_period_end ?? null };
  });

/** Cancels the active subscription at the end of the current billing period. */
export const cancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sub = await loadTargetSubscription(context.supabase, context.userId);
    if (!isManageable(sub)) throw new Error("No active subscription to cancel.");
    const target = sub!;
    if (target.cancel_at_period_end) {
      throw new Error("This subscription is already scheduled to end.");
    }

    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(target.environment as "sandbox" | "live");
    await paddle.subscriptions.cancel(target.paddle_subscription_id, {
      effectiveFrom: "next_billing_period",
    });

    return { ok: true, accessUntil: target.current_period_end ?? null };
  });

/**
 * Reverses a scheduled cancellation (or resumes a paused subscription) without
 * sending the customer out to the payment provider's portal. Paddle confirms the
 * change with a `subscription.updated` webhook, which is what actually rewrites
 * the local row.
 */
export const resumeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sub = await loadTargetSubscription(context.supabase, context.userId);
    if (!isResumable(sub)) {
      throw new Error("There's nothing to resume — this subscription isn't scheduled to end.");
    }
    const target = sub!;
    const { getPaddleClient } = await import("@/lib/paddle.server");
    const paddle = getPaddleClient(target.environment as "sandbox" | "live");

    if (target.status === "paused") {
      await paddle.subscriptions.resume(target.paddle_subscription_id, {
        effectiveFrom: "immediately",
      });
    } else {
      // Clearing the scheduled change is how Paddle un-cancels a subscription.
      await paddle.subscriptions.update(target.paddle_subscription_id, {
        scheduledChange: null,
      });
    }

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
