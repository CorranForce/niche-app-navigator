import { createFileRoute, redirect } from "@tanstack/react-router";

/** The email delivery log now lives on the owner's dashboard. */
export const Route = createFileRoute("/_authenticated/admin/emails")({
  beforeLoad: () => {
    throw redirect({ to: "/admin", hash: "emails" });
  },
  component: () => null,
});
