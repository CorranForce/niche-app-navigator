import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type AdminUserRow = {
  userId: string;
  email: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  plan: string;
  status: string | null;
  priceId: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  environment: string | null;
};

export type AdminInvoiceRow = {
  id: string;
  invoiceNumber: string | null;
  status: string;
  billedAt: string | null;
  amount: string | null;
  currency: string | null;
};

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

/** Admin-only user search with the current subscription state for each match. */
export const searchBillingUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().max(120).default(""),
        environment: z.enum(["sandbox", "live"]).default("sandbox"),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdminUserRow[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { entitledPlan, PLAN_LABELS } = await import("@/lib/plan-limits");

    const term = data.query.trim().toLowerCase();
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) throw new Error(error.message);

    const users = (list?.users ?? []).filter((u) =>
      term ? (u.email ?? "").toLowerCase().includes(term) || u.id === term : true,
    );
    const matched = users.slice(0, 50);
    if (matched.length === 0) return [];

    const { data: subs } = await supabaseAdmin
      .from("subscriptions")
      .select(
        "user_id, product_id, price_id, status, current_period_end, cancel_at_period_end, environment, created_at",
      )
      .in(
        "user_id",
        matched.map((u) => u.id),
      )
      .order("created_at", { ascending: false });

    type SubRow = NonNullable<typeof subs>[number];
    const latest = new Map<string, SubRow>();
    for (const s of subs ?? []) {
      if ((s.environment ?? "sandbox") !== data.environment) continue;
      if (!latest.has(s.user_id)) latest.set(s.user_id, s);
    }

    return matched.map((u) => {
      const sub = latest.get(u.id) ?? null;
      const plan = entitledPlan(sub);
      return {
        userId: u.id,
        email: u.email ?? null,
        createdAt: u.created_at ?? null,
        lastSignInAt: u.last_sign_in_at ?? null,
        plan: PLAN_LABELS[plan],
        status: sub?.status ?? null,
        priceId: sub?.price_id ?? null,
        currentPeriodEnd: sub?.current_period_end ?? null,
        cancelAtPeriodEnd: Boolean(sub?.cancel_at_period_end),
        environment: sub?.environment ?? null,
      };
    });
  });

/** Admin-only billing history for one user, read live from Paddle. */
export const getUserBillingHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<AdminInvoiceRow[]> => {
    const supabaseAdmin = await assertAdmin(context.userId);

    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("paddle_customer_id, environment")
      .eq("user_id", data.userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!sub?.paddle_customer_id) return [];

    const { gatewayFetch } = await import("@/lib/paddle.server");
    const res = await gatewayFetch(
      (sub.environment as "sandbox" | "live") ?? "sandbox",
      `/transactions?customer_id=${encodeURIComponent(sub.paddle_customer_id)}&per_page=20&order_by=created_at[DESC]`,
    );
    if (!res.ok) throw new Error("Could not load billing history.");

    const json = (await res.json()) as {
      data?: Array<{
        id: string;
        invoice_number?: string | null;
        status: string;
        billed_at?: string | null;
        created_at?: string | null;
        currency_code?: string | null;
        details?: { totals?: { grand_total?: string | null } };
      }>;
    };

    return (json.data ?? []).map((t) => ({
      id: t.id,
      invoiceNumber: t.invoice_number ?? null,
      status: t.status,
      billedAt: t.billed_at ?? t.created_at ?? null,
      amount: t.details?.totals?.grand_total ?? null,
      currency: t.currency_code ?? null,
    }));
  });
