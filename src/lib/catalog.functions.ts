import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type PublicCatalogRow = {
  planExternalId: string;
  planName: string;
  priceExternalId: string;
  paddlePriceId: string;
  interval: "month" | "year";
  amountCents: number;
  currency: string;
  trialDays: number;
};

/**
 * Public read of the stored Paddle catalog for the environment the app is
 * running against. Pricing and checkout read amounts from here so the page can
 * never advertise a price the gateway would not actually charge.
 */
export const getPublicCatalog = createServerFn({ method: "GET" })
  .inputValidator((raw: unknown) =>
    z
      .object({ environment: z.enum(["sandbox", "live"]).optional() })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }): Promise<PublicCatalogRow[]> => {
    const { paymentsEnv } = await import("@/lib/payments-env");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const environment = data.environment ?? paymentsEnv();

    const { data: rows, error } = await supabaseAdmin
      .from("billing_catalog")
      .select(
        "plan_name, plan_external_id, price_external_id, paddle_price_id, billing_interval, unit_amount_cents, currency_code, trial_days, status",
      )
      .eq("environment", environment)
      .order("unit_amount_cents", { ascending: true });
    if (error) throw new Error(error.message);

    return (rows ?? [])
      .filter((r) => (r.status ?? "active") === "active")
      .map((r) => ({
        planExternalId: r.plan_external_id,
        planName: r.plan_name,
        priceExternalId: r.price_external_id,
        paddlePriceId: r.paddle_price_id,
        interval: r.billing_interval as "month" | "year",
        amountCents: r.unit_amount_cents,
        currency: r.currency_code,
        trialDays: r.trial_days,
      }));
  });
