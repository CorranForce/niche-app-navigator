import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Anomaly = {
  id: string;
  severity: "critical" | "warning" | "info";
  title: string;
  detail: string;
};

export type BillingAnomalies = {
  mrr: { currentCents: number; previousCents: number; deltaCents: number; deltaPct: number | null };
  pastDue: Array<{ userId: string; email: string | null; since: string | null }>;
  repeatFailures: Array<{ customerId: string; failures: number; lastFailedAt: string | null }>;
  failedTransactions30d: number;
  churn: { canceled30d: number; cancelScheduled: number; newPaid30d: number };
  anomalies: Anomaly[];
  paddleError: string | null;
};

const PLAN_PRICE_CENTS: Record<string, number> = { solo: 900, pro: 1900, studio: 4900 };

/** Owner-only billing anomaly detection: MRR swings, failed payments and repeat charge failures. */
export const getBillingAnomalies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<BillingAnomalies> => {
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError) throw new Error("Could not verify access.");
    if (!isAdmin) throw new Error("Admins only.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { entitledPlan, isPastDue } = await import("@/lib/plan-limits");

    const now = Date.now();
    const since30 = new Date(now - 30 * 86_400_000).toISOString();

    const [subsRes, profilesRes] = await Promise.all([
      supabaseAdmin
        .from("subscriptions")
        .select(
          "user_id, paddle_customer_id, product_id, status, cancel_at_period_end, environment, created_at, updated_at",
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("profiles").select("id, email"),
    ]);

    const subs = subsRes.data ?? [];
    const emailById = new Map((profilesRes.data ?? []).map((p) => [p.id, p.email ?? null]));

    type SubRow = (typeof subs)[number];
    const latest = new Map<string, SubRow>();
    for (const s of subs) if (!latest.has(s.user_id)) latest.set(s.user_id, s);

    let currentCents = 0;
    let previousCents = 0;
    let cancelScheduled = 0;
    let canceled30d = 0;
    let newPaid30d = 0;
    const pastDue: BillingAnomalies["pastDue"] = [];

    for (const sub of latest.values()) {
      const plan = entitledPlan(sub);
      const price = PLAN_PRICE_CENTS[plan] ?? 0;
      if (plan !== "none") currentCents += price;

      // MRR 30 days ago: the subscription must have existed and not have ended since.
      const existedThen = Boolean(sub.created_at && sub.created_at < since30);
      const endedSince = sub.status === "canceled" || isPastDue(sub.status);
      if (existedThen && (plan !== "none" || endedSince)) {
        const thenPlan =
          plan !== "none" ? plan : sub.product_id?.includes("studio") ? "studio" : "pro";
        previousCents += PLAN_PRICE_CENTS[thenPlan] ?? 0;
      }

      if (sub.cancel_at_period_end) cancelScheduled += 1;
      if (sub.status === "canceled" && sub.updated_at && sub.updated_at >= since30)
        canceled30d += 1;
      if (plan !== "none" && sub.created_at && sub.created_at >= since30) newPaid30d += 1;
      if (isPastDue(sub.status)) {
        pastDue.push({
          userId: sub.user_id,
          email: emailById.get(sub.user_id) ?? null,
          since: sub.updated_at ?? sub.created_at ?? null,
        });
      }
    }

    // Failed / repeatedly failing charges, read live from the payment provider.
    let failedTransactions30d = 0;
    const repeatFailures: BillingAnomalies["repeatFailures"] = [];
    let paddleError: string | null = null;

    const environment =
      (subs.find((s) => s.environment)?.environment as "sandbox" | "live" | undefined) ?? "sandbox";

    try {
      const { gatewayFetch } = await import("@/lib/paddle.server");
      const res = await gatewayFetch(
        environment,
        `/transactions?status=past_due&per_page=100&order_by=created_at[DESC]`,
      );
      if (!res.ok) throw new Error(`Payment provider returned ${res.status}`);
      const json = (await res.json()) as {
        data?: Array<{
          id: string;
          customer_id?: string | null;
          status: string;
          created_at?: string | null;
          billed_at?: string | null;
        }>;
      };
      const rows = (json.data ?? []).filter((t) => {
        const when = t.billed_at ?? t.created_at;
        return !when || when >= since30;
      });
      failedTransactions30d = rows.length;

      const byCustomer = new Map<string, { failures: number; lastFailedAt: string | null }>();
      for (const t of rows) {
        const key = t.customer_id ?? "unknown";
        const entry = byCustomer.get(key) ?? { failures: 0, lastFailedAt: null };
        entry.failures += 1;
        const when = t.billed_at ?? t.created_at ?? null;
        if (when && (!entry.lastFailedAt || when > entry.lastFailedAt)) entry.lastFailedAt = when;
        byCustomer.set(key, entry);
      }
      for (const [customerId, entry] of byCustomer) {
        if (entry.failures >= 2) repeatFailures.push({ customerId, ...entry });
      }
      repeatFailures.sort((a, b) => b.failures - a.failures);
    } catch (error) {
      paddleError =
        error instanceof Error ? error.message : "Could not reach the payment provider.";
    }

    const deltaCents = currentCents - previousCents;
    const deltaPct = previousCents > 0 ? (deltaCents / previousCents) * 100 : null;

    const anomalies: Anomaly[] = [];

    if (deltaPct !== null && Math.abs(deltaPct) >= 20) {
      anomalies.push({
        id: "mrr-swing",
        severity: deltaPct < 0 ? "critical" : "info",
        title: `MRR ${deltaPct < 0 ? "dropped" : "jumped"} ${Math.abs(deltaPct).toFixed(0)}% in 30 days`,
        detail: `$${(previousCents / 100).toFixed(0)} → $${(currentCents / 100).toFixed(0)} per month.`,
      });
    } else if (previousCents === 0 && currentCents > 0) {
      anomalies.push({
        id: "mrr-first",
        severity: "info",
        title: "First recurring revenue recorded",
        detail: `$${(currentCents / 100).toFixed(0)} MRR from new paid accounts.`,
      });
    }

    if (pastDue.length > 0) {
      anomalies.push({
        id: "past-due",
        severity: "critical",
        title: `${pastDue.length} account${pastDue.length === 1 ? "" : "s"} past due`,
        detail: "Paid features are restricted to Free limits until payment succeeds.",
      });
    }

    if (repeatFailures.length > 0) {
      anomalies.push({
        id: "repeat-failures",
        severity: "critical",
        title: `${repeatFailures.length} customer${repeatFailures.length === 1 ? "" : "s"} with repeat charge failures`,
        detail: "Two or more failed attempts — likely an expired or blocked card.",
      });
    }

    if (canceled30d > 0 && canceled30d >= newPaid30d) {
      anomalies.push({
        id: "churn",
        severity: "warning",
        title: `Churn outpacing growth (${canceled30d} canceled vs ${newPaid30d} new in 30d)`,
        detail: `${cancelScheduled} more subscription${cancelScheduled === 1 ? " is" : "s are"} scheduled to cancel at renewal.`,
      });
    }

    if (paddleError) {
      anomalies.push({
        id: "provider",
        severity: "warning",
        title: "Payment provider data unavailable",
        detail: paddleError,
      });
    }

    return {
      mrr: { currentCents, previousCents, deltaCents, deltaPct },
      pastDue: pastDue.slice(0, 10),
      repeatFailures: repeatFailures.slice(0, 10),
      failedTransactions30d,
      churn: { canceled30d, cancelScheduled, newPaid30d },
      anomalies,
      paddleError,
    };
  });
