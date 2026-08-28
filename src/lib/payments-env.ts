/**
 * Single source of truth for which payment environment the app is talking to.
 *
 * Derived from the client token prefix so browser code, server functions and
 * database reads always agree. Deriving it from `import.meta.env.PROD` (as some
 * server code used to) can disagree with the shipped token and make the server
 * read the wrong environment's subscription rows.
 */
export type PaymentsEnv = "sandbox" | "live";

const clientToken = import.meta.env["VITE_PAYMENTS_CLIENT_TOKEN"] as string | undefined;

export function paymentsEnv(): PaymentsEnv {
  return clientToken?.startsWith("live_") ? "live" : "sandbox";
}
