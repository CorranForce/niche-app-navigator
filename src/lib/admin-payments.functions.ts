import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

export type PaymentFeedRow = {
  transactionId: string;
  invoiceNumber: string | null;
  customerLabel: string;
  paddleCustomerId: string | null;
  status: string;
  amountCents: number;
  currency: string;
  billedAt: string | null;
  subscriptionStatus: string | null;
  planLabel: string | null;
  nextBilledAt: string | null;
};

export type PaymentsFeed = {
  environment: "sandbox" | "live";
  rows: PaymentFeedRow[];
  totals: { collectedCents: number; failed: number; currency: string; activeSubscriptions: number };
  fetchedAt: string;
};

const inputSchema = z.object({
  environment: z.enum(["sandbox", "live"]).default("live"),
  limit: z.number().int().min(1).max(100).default(30),
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

type PaddleTxn = {
  id: string;
  status: string;
  invoice_number?: string | null;
  customer_id?: string | null;
  subscription_id?: string | null;
  billed_at?: string | null;
  created_at?: string | null;
  currency_code?: string | null;
  details?: { totals?: { grand_total?: string | null } };
};

type PaddleSub = {
  id: string;
  status: string;
  customer_id?: string | null;
  next_billed_at?: string | null;
  items?: Array<{ price?: { import_meta?: { external_id?: string | null } | null } }>;
};

/**
 * Admin-only live payments feed: recent Paddle transactions joined with the
 * subscription state and the app account each Paddle customer maps to.
 */
export const getPaymentsFeed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => inputSchema.parse(raw ?? {}))
  .handler(async ({ data, context }): Promise<PaymentsFeed> => {
    const supabaseAdmin = await assertAdmin(context.userId);
    const { gatewayFetch } = await import("@/lib/paddle.server");

    const [txnRes, subRes] = await Promise.all([
      gatewayFetch(
        data.environment,
        `/transactions?per_page=${data.limit}&order_by=created_at[DESC]`,
      ),
      gatewayFetch(data.environment, `/subscriptions?per_page=100`),
    ]);
    if (!txnRes.ok) throw new Error(`Paddle returned ${txnRes.status} for transactions.`);
    if (!subRes.ok) throw new Error(`Paddle returned ${subRes.status} for subscriptions.`);

    const txns = ((await txnRes.json()) as { data?: PaddleTxn[] }).data ?? [];
    const subs = ((await subRes.json()) as { data?: PaddleSub[] }).data ?? [];

    const subByCustomer = new Map<string, PaddleSub>();
    for (const s of subs) {
      if (s.customer_id && !subByCustomer.has(s.customer_id)) subByCustomer.set(s.customer_id, s);
    }

    // Map Paddle customers back to app accounts through the mirrored rows.
    const customerIds = [...new Set(txns.map((t) => t.customer_id).filter(Boolean))] as string[];
    const emailByCustomer = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: rows } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id, paddle_customer_id")
        .in("paddle_customer_id", customerIds);
      const userIds = [...new Set((rows ?? []).map((r) => r.user_id))];
      if (userIds.length > 0) {
        const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const emailById = new Map((list?.users ?? []).map((u) => [u.id, u.email ?? ""]));
        for (const r of rows ?? []) {
          const email = emailById.get(r.user_id);
          if (email && r.paddle_customer_id) emailByCustomer.set(r.paddle_customer_id, email);
        }
      }
    }

    const rows: PaymentFeedRow[] = txns.map((t) => {
      const sub = t.customer_id ? (subByCustomer.get(t.customer_id) ?? null) : null;
      return {
        transactionId: t.id,
        invoiceNumber: t.invoice_number ?? null,
        customerLabel:
          (t.customer_id ? emailByCustomer.get(t.customer_id) : null) ??
          t.customer_id ??
          "unknown customer",
        paddleCustomerId: t.customer_id ?? null,
        status: t.status,
        amountCents: Number(t.details?.totals?.grand_total ?? "0"),
        currency: t.currency_code ?? "USD",
        billedAt: t.billed_at ?? t.created_at ?? null,
        subscriptionStatus: sub?.status ?? null,
        planLabel: sub?.items?.[0]?.price?.import_meta?.external_id ?? null,
        nextBilledAt: sub?.next_billed_at ?? null,
      };
    });

    const completed = rows.filter((r) => r.status === "completed");
    return {
      environment: data.environment,
      rows,
      totals: {
        collectedCents: completed.reduce((sum, r) => sum + r.amountCents, 0),
        failed: rows.filter((r) => r.status === "past_due" || r.status === "canceled").length,
        currency: rows[0]?.currency ?? "USD",
        activeSubscriptions: subs.filter((s) => s.status === "active" || s.status === "trialing")
          .length,
      },
      fetchedAt: new Date().toISOString(),
    };
  });
