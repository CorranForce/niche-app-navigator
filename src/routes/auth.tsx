import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

// Critical route config only. The page component lives in auth.lazy.tsx so the
// route module never depends on the lazy chunk to render *something*: if the
// chunk fails to load (e.g. stale hashed asset after a deploy), the router
// falls back to errorComponent instead of a blank screen.
export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } =>
    typeof search["redirect"] === "string" ? { redirect: search["redirect"] } : {},

  head: () => ({
    meta: [
      { title: "Sign in — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Sign in to generate niche pain-point reports and keep your saved micro-SaaS research.",
      },
      { property: "og:title", content: "Sign in — MicroSaaS Solution Finder" },
      { property: "og:description", content: "Access your saved micro-SaaS niche reports." },
      { name: "robots", content: "noindex, follow" },
    ],
  }),

  errorComponent: AuthRouteError,
});

function AuthRouteError({ reset }: { error: unknown; reset: () => void }) {
  return (
    <div className="grid-canvas flex min-h-screen items-center justify-center px-4 py-16">
      <Card className="w-full max-w-sm gap-4 border-border bg-surface p-6 text-center">
        <h1 className="text-xl font-semibold">Sign-in page failed to load</h1>
        <p className="text-sm text-muted-foreground">
          This usually happens right after an update. Reloading fixes it.
        </p>
        <div className="flex flex-col gap-2">
          <Button onClick={() => reset()}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload page
          </Button>
          <Link to="/" className="label-mono text-muted-foreground hover:text-foreground">
            Back to home
          </Link>
        </div>
      </Card>
    </div>
  );
}
