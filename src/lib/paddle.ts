import { resolvePaddlePrice } from "@/lib/payments.functions";

const clientToken = import.meta.env['VITE_PAYMENTS_CLIENT_TOKEN'] as string | undefined;

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Paddle: any;
  }
}

export function getPaddleEnvironment(): "sandbox" | "live" {
  return clientToken?.startsWith("test_") ? "sandbox" : "live";
}

let paddleInitialized = false;

export async function initializePaddle() {
  if (paddleInitialized) return;
  if (!clientToken) throw new Error("Payments are not configured yet.");

  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
    script.onload = () => {
      const paddleJsEnvironment =
        getPaddleEnvironment() === "sandbox" ? "sandbox" : "production";
      window.Paddle.Environment.set(paddleJsEnvironment);
      window.Paddle.Initialize({ token: clientToken });
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

export { planForProductId, PLAN_LIMITS, limitForPlan, entitledPlan, isPastDue } from "@/lib/plan-limits";
export type { PlanId } from "@/lib/plan-limits";

export const PLANS = [
  {
    id: "free",
    name: "Free",
    tagline: "Test the tool on a niche you already know.",
    monthly: { amount: "$0", priceId: null as string | null },
    yearly: { amount: "$0", priceId: null as string | null },
    productId: null as string | null,
    features: [
      "5 reports per month",
      "Full pain-point analysis",
      "3 app concepts per report",
      "Pricing tiers + feature breakdown",
      "Saved report history",
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
      "Everything in Free",
      "Markdown export",
      "Deeper 72-hour build plans",
      "Priority generation queue",
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
    ],
  },
] as const;

