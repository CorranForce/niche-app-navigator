import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Turn a niche into pain points, app concepts, pricing tiers and a 72-hour build plan.",
      },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MicroSaaS Solution Finder" },
      { property: "og:locale", content: "en_US" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "index, follow, max-image-preview:large, max-snippet:-1" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "MicroSaaS Solution Finder",
          url: "https://idea-spark-fast.lovable.app/",
          description:
            "Turn a niche into pain points, app concepts, pricing tiers and a 72-hour build plan.",
          publisher: { "@id": "https://idea-spark-fast.lovable.app/#organization" },
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          "@id": "https://idea-spark-fast.lovable.app/#organization",
          name: "MicroSaaS Solution Finder",
          alternateName: "solutionfinder",
          url: "https://idea-spark-fast.lovable.app/",
          logo: {
            "@type": "ImageObject",
            url: "https://idea-spark-fast.lovable.app/og-image.jpg",
            width: 1200,
            height: 630,
          },
          image: "https://idea-spark-fast.lovable.app/og-image.jpg",
          description:
            "An AI research tool that turns any business niche into ranked pain points, three buildable micro-SaaS concepts, a pricing tier structure and a 72-hour first-release plan.",
          foundingDate: "2026",
          knowsAbout: [
            "Micro-SaaS product research",
            "Small business operational pain points",
            "SaaS pricing tiers",
            "MVP scoping",
          ],
          contactPoint: [
            {
              "@type": "ContactPoint",
              contactType: "customer support",
              email: "support@notify.freedomopsai.dev",
              url: "https://idea-spark-fast.lovable.app/faq",
              availableLanguage: ["en"],
            },
            {
              "@type": "ContactPoint",
              contactType: "billing support",
              email: "billing@notify.freedomopsai.dev",
              url: "https://idea-spark-fast.lovable.app/faq",
              availableLanguage: ["en"],
            },
          ],
          sameAs: [
            "https://github.com/freedomopsai",
            "https://x.com/freedomopsai",
            "https://www.linkedin.com/company/freedomopsai",
          ],
        }),
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
      },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;

      // Supabase holds its auth client lock while this callback runs. Route
      // invalidation can enter a protected beforeLoad that calls getUser(), so
      // defer all auth-dependent work until the callback and lock have cleared.
      window.setTimeout(() => {
        void router.invalidate();
        if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      <Toaster position="top-center" />
    </QueryClientProvider>
  );
}
