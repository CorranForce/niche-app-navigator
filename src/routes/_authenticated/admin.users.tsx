import { createFileRoute, redirect } from "@tanstack/react-router";

/** Customer billing now lives on its own admin customers page. */
export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: () => {
    throw redirect({ to: "/admin/customers" });
  },
  component: () => null,
});
