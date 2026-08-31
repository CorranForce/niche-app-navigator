import { resolvePaddlePrice } from "@/lib/payments.functions";
import { paymentsEnv } from "@/lib/payments-env";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return paymentsEnv();
}

let paddleInitialized = false;
let retainCustomerId: string | null = null;

/**
 * Loads Paddle.js. `paddleCustomerId` is the Paddle customer ID (`ctm_...`) of
 * the signed-in user and enables Paddle Retain — it must never be an internal
 * user id or an email address. Passing it later calls `Paddle.Update` so an
 * already-initialised instance picks the customer up.
 */
export async function initializePaddle(paddleCustomerId?: string | null) {
  if (!clientToken) throw new Error("Payments are not configured yet.");
  const pwCustomer =
    paddleCustomerId && paddleCustomerId.startsWith("ctm_") ? { id: paddleCustomerId } : undefined;

  if (paddleInitialized) {
    if (pwCustomer && pwCustomer.id !== retainCustomerId) {
      retainCustomerId = pwCustomer.id;
      window.Paddle.Update?.({ pwCustomer });
    }
    return;
  }

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      // Live is Paddle.js's default; only the sandbox needs an explicit switch.
      if (getPaddleEnvironment() === "sandbox") {
        window.Paddle.Environment.set("sandbox");
      }
      window.Paddle.Initialize({
        token: clientToken,
        ...(pwCustomer ? { pwCustomer } : {}),
      });
      retainCustomerId = pwCustomer?.id ?? null;
      paddleInitialized = true;
      resolve();
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export async function getPaddlePriceId(priceId: string): Promise<string> {
  return resolvePaddlePrice({ data: { priceId, environment: getPaddleEnvironment() } });
}

export {
  planForProductId,
  planFeatures,
  TRIAL_DAYS,
  STUDIO_SEATS,
  PLAN_LIMITS,
  limitForPlan,
  entitledPlan,
  isPastDue,
} from "@/lib/plan-limits";
export type { PlanId } from "@/lib/plan-limits";

export const PLANS = [
  {
    id: "solo",
    name: "Solo",
    tagline: "For the solo builder validating one niche at a time.",
    monthly: { amount: "$9", priceId: "solo_monthly" as string | null },
    yearly: { amount: "$90", priceId: "solo_yearly" as string | null },
    productId: "solo_plan" as string | null,
    features: [
      "10 reports per month",
      "Full pain-point analysis",
      "3 app concepts per report",
      "Pricing tiers + feature breakdown",
      "Saved report history",
      "7-day free trial",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    tagline: "For builders shipping something new every month.",
    monthly: { amount: "$19", priceId: "pro_monthly" as string | null },
    yearly: { amount: "$190", priceId: "pro_yearly" as string | null },
    productId: "pro_plan" as string | null,
    features: [
      "50 reports per month",
      "Everything in Solo",
      "Markdown export & download",
      "Deeper 72-hour build plans",
      "Priority generation queue",
      "7-day free trial",
    ],
  },
  {
    id: "studio",
    name: "Studio",
    tagline: "For studios and agencies scouting niches together.",
    monthly: { amount: "$49", priceId: "studio_monthly" as string | null },
    yearly: { amount: "$490", priceId: "studio_yearly" as string | null },
    productId: "studio_plan" as string | null,
    features: [
      "Unlimited reports",
      "Everything in Pro",
      "5 seats included",
      "Shared report library",
      "Side-by-side niche comparison",
      "Priority support",
      "7-day free trial",
    ],
  },
] as const;
