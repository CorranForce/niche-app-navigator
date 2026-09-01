import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type CatalogRow = {
  planName: string;
  planExternalId: string;
  priceExternalId: string;
  paddleProductId: string;
  paddlePriceId: string;
  interval: "month" | "year";
  amountCents: number;
  currency: string;
  trialDays: number;
  syncedAt: string | null;
};

const inputSchema = z.object({
  environment: z.enum(["sandbox", "live"]).default("sandbox"),
});

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error) throw new Error("Could not verify access.");
  if (!data) throw new Error("Admins only.");
  return supabaseAdmin;
}

/** Admin-only read of the stored Paddle product/price catalog for an environment. */
export const getBillingCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => inputSchema.parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<CatalogRow[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { data: rows, error } = await supabaseAdmin
      .from("billing_catalog")
      .select(
        "plan_name, plan_external_id, price_external_id, paddle_product_id, paddle_price_id, billing_interval, unit_amount_cents, currency_code, trial_days, synced_at",
      )
      .eq("environment", data.environment)
      .order("unit_amount_cents", { ascending: true });
    if (error) throw new Error(error.message);

    return (rows ?? []).map((r) => ({
      planName: r.plan_name,
      planExternalId: r.plan_external_id,
      priceExternalId: r.price_external_id,
      paddleProductId: r.paddle_product_id,
      paddlePriceId: r.paddle_price_id,
      interval: r.billing_interval as "month" | "year",
      amountCents: r.unit_amount_cents,
      currency: r.currency_code,
      trialDays: r.trial_days,
      syncedAt: r.synced_at ?? null,
    }));
  });

/**
 * Admin-only sync: pulls live/test prices from Paddle and upserts them into
 * public.billing_catalog so the stored values always match the gateway.
 */
export const syncBillingCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => inputSchema.parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<{ synced: number; rows: CatalogRow[] }> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { gatewayFetch } = await import("@/lib/paddle.server");

    const res = await gatewayFetch(data.environment, "/prices?per_page=100&include=product");
    if (!res.ok) throw new Error(`Paddle returned ${res.status}`);
    const body = (await res.json()) as { data?: unknown[] };

    type PriceLike = {
      id?: string;
      product_id?: string;
      status?: string;
      billing_cycle?: { interval?: string } | null;
      trial_period?: { interval?: string; frequency?: number } | null;
      unit_price?: { amount?: string; currency_code?: string };
      import_meta?: { external_id?: string } | null;
      product?: {
        name?: string;
        status?: string;
        import_meta?: { external_id?: string } | null;
      } | null;
    };

    const records = (body.data ?? []) as PriceLike[];
    const upserts = records
      .filter(
        (p) =>
          p.status === "active" &&
          p.import_meta?.external_id &&
          p.product?.import_meta?.external_id &&
          (p.billing_cycle?.interval === "month" || p.billing_cycle?.interval === "year"),
      )
      .map((p) => {
        const trial = p.trial_period;
        const trialDays =
          trial?.interval === "day"
            ? (trial.frequency ?? 0)
            : trial?.interval === "month"
              ? (trial.frequency ?? 0) * 30
              : 0;
        return {
          environment: data.environment,
          plan_external_id: p.product!.import_meta!.external_id!,
          price_external_id: p.import_meta!.external_id!,
          plan_name: p.product?.name ?? p.product!.import_meta!.external_id!,
          paddle_product_id: p.product_id ?? "",
          paddle_price_id: p.id ?? "",
          billing_interval: p.billing_cycle!.interval as "month" | "year",
          unit_amount_cents: Number(p.unit_price?.amount ?? "0"),
          currency_code: p.unit_price?.currency_code ?? "USD",
          trial_days: trialDays,
          status: "active",
          synced_at: new Date().toISOString(),
        };
      });

    if (upserts.length > 0) {
      const { error } = await supabaseAdmin
        .from("billing_catalog")
        .upsert(upserts, { onConflict: "environment,price_external_id" });
      if (error) throw new Error(error.message);
    }

    const rows = await getBillingCatalog({ data: { environment: data.environment } });
    return { synced: upserts.length, rows };
  });

export type CatalogCheck = {
  priceExternalId: string;
  planExternalId: string;
  storedPriceId: string;
  gatewayPriceId: string | null;
  storedAmountCents: number;
  gatewayAmountCents: number | null;
  ok: boolean;
  problem: string | null;
};

/**
 * Confirms every stored catalog row still resolves to the same Paddle product
 * and price in the target environment — the check to run after "Sync from
 * Paddle" before pointing real checkout at it.
 */
export const verifyBillingCatalog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => inputSchema.parse(raw ?? {}))
  .handler(
    async ({
      data,
      context,
    }): Promise<{ allMatch: boolean; checks: CatalogCheck[]; checkedAt: string }> => {
      await assertAdmin(context.userId);
      const { gatewayFetch } = await import("@/lib/paddle.server");
      const stored = await getBillingCatalog({ data: { environment: data.environment } });

      const res = await gatewayFetch(data.environment, "/prices?per_page=100&include=product");
      if (!res.ok) throw new Error(`Paddle returned ${res.status}`);
      const body = (await res.json()) as {
        data?: Array<{
          id?: string;
          product_id?: string;
          status?: string;
          unit_price?: { amount?: string };
          import_meta?: { external_id?: string } | null;
          product?: { import_meta?: { external_id?: string } | null } | null;
        }>;
      };

      const gatewayByExternal = new Map(
        (body.data ?? [])
          .filter((p) => p.import_meta?.external_id)
          .map((p) => [p.import_meta!.external_id!, p]),
      );

      const checks: CatalogCheck[] = stored.map((row) => {
        const remote = gatewayByExternal.get(row.priceExternalId) ?? null;
        const gatewayAmount = remote?.unit_price?.amount
          ? Number(remote.unit_price.amount)
          : null;
        let problem: string | null = null;
        if (!remote) problem = "Not found in Paddle for this environment.";
        else if (remote.id !== row.paddlePriceId) problem = `Paddle price ID is now ${remote.id}.`;
        else if (remote.product_id !== row.paddleProductId)
          problem = `Paddle product ID is now ${remote.product_id}.`;
        else if (gatewayAmount !== row.amountCents)
          problem = `Paddle charges ${gatewayAmount} cents, catalog says ${row.amountCents}.`;
        else if (remote.status !== "active") problem = `Price is ${remote.status} in Paddle.`;

        return {
          priceExternalId: row.priceExternalId,
          planExternalId: row.planExternalId,
          storedPriceId: row.paddlePriceId,
          gatewayPriceId: remote?.id ?? null,
          storedAmountCents: row.amountCents,
          gatewayAmountCents: gatewayAmount,
          ok: problem === null,
          problem,
        };
      });

      return {
        allMatch: checks.length > 0 && checks.every((c) => c.ok),
        checks,
        checkedAt: new Date().toISOString(),
      };
    },
  );
