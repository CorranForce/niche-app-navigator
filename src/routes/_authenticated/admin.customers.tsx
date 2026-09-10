import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { AdminErrorFallback } from "@/components/admin-error-fallback";
import { AdminCustomersSection } from "@/components/admin-customers";

export const Route = createFileRoute("/_authenticated/admin/customers")({
  head: () => ({
    meta: [
      { title: "Customers — owner's dashboard" },
      {
        name: "description",
        content:
          "Internal customer list: every account with its plan, payment customer ID, access status and invoice history.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Customers — owner's dashboard" },
      {
        property: "og:description",
        content: "Every account with plan, payment customer ID and access status.",
      },
    ],
  }),
  component: AdminCustomersPage,
  errorComponent: AdminErrorFallback,
});

function AdminCustomersPage() {
  const [environment, setEnvironment] = useState<"sandbox" | "live">(() => {
    if (typeof window === "undefined") return "live";
    return window.localStorage.getItem("admin-data-environment") === "sandbox"
      ? "sandbox"
      : "live";
  });

  function apply(next: "sandbox" | "live") {
    setEnvironment(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("admin-data-environment", next);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Everyone who has signed in, what they pay for and whether their access is active.
            </p>
          </div>
          <div className="ml-auto flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
            <Label
              htmlFor="customers-environment"
              className={`label-mono cursor-pointer ${
                environment === "sandbox" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Test data
            </Label>
            <Switch
              id="customers-environment"
              checked={environment === "live"}
              onCheckedChange={(checked) => apply(checked ? "live" : "sandbox")}
              aria-label="Toggle between test and live data"
            />
            <Label
              htmlFor="customers-environment"
              className={`label-mono cursor-pointer ${
                environment === "live" ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Live data
            </Label>
          </div>
          <Button asChild variant="ghost">
            <Link to="/admin">
              <ArrowLeft className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>

        <Card className="mt-4 p-4 text-sm text-muted-foreground">
          Showing {environment === "live" ? "real paying customers" : "test-mode customers"}. Each
          row lists the payment customer ID used by the payment provider, so you can match an
          account to its payment record.
        </Card>

        <AdminCustomersSection environment={environment} />
      </main>
    </div>
  );
}
