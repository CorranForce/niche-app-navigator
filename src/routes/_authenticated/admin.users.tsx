import { createFileRoute, redirect } from "@tanstack/react-router";

/** Customer billing now lives on the owner's dashboard. */
export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", hash: "customers" });
  },
  component: () => null,
});
