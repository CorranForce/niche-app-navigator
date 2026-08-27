import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// After a new deploy, old hashed chunks disappear. A stale tab then fails to
// lazy-load a route module and renders a blank screen. Reload once to pick up
// the fresh build (guarded so we never loop on a genuine network failure).
const RELOAD_KEY = "chunk-reload-at";

function isStaleChunkError(message: string) {
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message)
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
