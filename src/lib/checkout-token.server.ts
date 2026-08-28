/**
 * Server-signed checkout intent tokens.
 *
 * Paddle `customData` is supplied by the browser, so it can never be trusted to
 * say *who* a subscription belongs to: anyone could pay for a plan while
 * tagging the purchase with another account's id. Instead the server mints a
 * short-lived HMAC-signed token at checkout time that binds the authenticated
 * user (and the price they picked) to the checkout, and the webhook resolves
 * the owner by verifying that token.
 */
import { createHmac, timingSafeEqual } from "crypto";

export type CheckoutIntent = {
  /** Authenticated user id, as known by the server at checkout time. */
  uid: string;
  /** Human-readable price id the checkout was opened for. */
  price: string;
  /** Payments environment ("sandbox" | "live"). */
  env: string;
  /** Issued-at, epoch seconds. */
  iat: number;
  /** Expiry, epoch seconds. */
  exp: number;
};

/** Checkouts must be completed within this window. */
export const CHECKOUT_INTENT_TTL_SECONDS = 60 * 60 * 6;

function signingKey(): string {
  const key = process.env["CHECKOUT_SIGNING_SECRET"];
  if (!key) throw new Error("Checkout signing is not configured.");
  return key;
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function signature(payload: string): string {
  return b64url(createHmac("sha256", signingKey()).update(payload).digest());
}

/** Mints a token for the signed-in user. Never call with a client-supplied id. */
export function signCheckoutIntent(
  intent: Omit<CheckoutIntent, "iat" | "exp">,
  now: Date = new Date(),
): string {
  const iat = Math.floor(now.getTime() / 1000);
  const payload: CheckoutIntent = { ...intent, iat, exp: iat + CHECKOUT_INTENT_TTL_SECONDS };
  const body = b64url(JSON.stringify(payload));
  return `${body}.${signature(body)}`;
}

export type VerifyResult =
  | { ok: true; intent: CheckoutIntent }
  | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

/** Verifies a token and returns the trusted intent it carries. */
export function verifyCheckoutIntent(
  token: string | null | undefined,
  now: Date = new Date(),
): VerifyResult {
  if (!token || typeof token !== "string") return { ok: false, reason: "malformed" };
  const [body, sig] = token.split(".");
  if (!body || !sig) return { ok: false, reason: "malformed" };

  const expected = signature(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b))
    return { ok: false, reason: "bad_signature" };

  let intent: CheckoutIntent;
  try {
    intent = JSON.parse(fromB64url(body).toString("utf8")) as CheckoutIntent;
  } catch {
    return { ok: false, reason: "malformed" };
  }
  if (!intent?.uid || typeof intent.uid !== "string") return { ok: false, reason: "malformed" };
  if (!intent.exp || intent.exp * 1000 < now.getTime()) return { ok: false, reason: "expired" };

  return { ok: true, intent };
}
