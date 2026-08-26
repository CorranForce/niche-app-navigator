import { createFileRoute, redirect } from "@tanstack/react-router";

/** Billing now lives on the account page. */
export const Route = createFileRoute("/_authenticated/billing")({
  beforeLoad: () => {
    throw redirect({ to: "/account", hash: "billing" });
  },
  component: () => null,
});
