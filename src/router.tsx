import { QueryClient } from "@tanstack/react-query";
import { createRouter, Link } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// Last-resort fallback for any route whose lazy chunk fails to resolve (e.g. a
// stale hashed asset after a deploy). The reload-once handler below usually
// recovers first; this guarantees the route never renders a blank screen.
function DefaultRouteError({ reset }: { error: unknown; reset: () => void }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm space-y-4 text-center">
        <h1 className="text-xl font-semibold">This page failed to load</h1>
        <p className="text-sm text-muted-foreground">
          This usually happens right after an update. Reloading fixes it.
        </p>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            className="text-sm font-medium underline underline-offset-4"
            onClick={() => reset()}
          >
            Try again
          </button>
          <button
            type="button"
            className="text-sm text-muted-foreground underline underline-offset-4"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
          <Link to="/" className="text-sm text-muted-foreground underline underline-offset-4">
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}

// After a new deploy, old hashed chunks disappear. A stale tab then fails to
// lazy-load a route module and renders a blank screen. Reload once to pick up
// the fresh build (guarded so we never loop on a genuine network failure).
const RELOAD_KEY = "chunk-reload-at";

function isStaleChunkError(message: string) {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    // A stale hashed chunk can also resolve to an empty module, so the router
    // reads `.component` off undefined instead of throwing a fetch error.
    /reading 'component'/i.test(message) ||
    /undefined is not an object \(evaluating '.*\.component'\)/i.test(message)
  );
}


function reloadOnce() {
  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Date.now() - last < 15_000) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  window.location.reload();
}

if (typeof window !== "undefined") {
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadOnce();
  });
  window.addEventListener("error", (event) => {
    if (isStaleChunkError(event.message ?? "")) reloadOnce();
  });
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const message = typeof reason === "string" ? reason : (reason?.message ?? "");
    if (isStaleChunkError(message)) reloadOnce();
  });
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
