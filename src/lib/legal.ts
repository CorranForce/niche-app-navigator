/**
 * Single source of truth for the seller details shown on the public policy
 * pages. Paddle's readiness check requires the seller to be identified by
 * legal name on Terms, Refund Policy and Privacy Notice.
 *
 * Update SELLER_LEGAL_NAME to the exact registered legal entity (or the
 * individual's full legal name if selling as a sole trader).
 */
export const SELLER_LEGAL_NAME = "Freedom Ops AI";
export const SELLER_TRADING_NAME = "MicroSaaS Solution Finder";
export const SELLER_CONTACT_EMAIL = "support@freedomopsai.dev";
export const SELLER_SITE_NAME = "solutionfinder";

/** Days within which a customer may request a full refund. Must be 14–90. */
export const REFUND_WINDOW_DAYS = 30;

export const POLICY_LAST_UPDATED = "August 28, 2026";
