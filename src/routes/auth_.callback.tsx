import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ensureAccount } from "@/lib/account.functions";

export const Route = createFileRoute("/auth_/callback")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Finishing sign-in — MicroSaaS Solution Finder" },
      {
        name: "description",
        content: "Completing your sign-in and returning you to your micro-SaaS reports.",
      },
      { property: "og:title", content: "Finishing sign-in — MicroSaaS Solution Finder" },
      { property: "og:description", content: "Completing your sign-in." },
    ],
  }),
  component: AuthCallback,
});

function safePath(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function AuthCallback() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let done = false;
    const target = safePath(
      typeof window === "undefined" ? null : sessionStorage.getItem("post_auth_redirect"),
    );

    async function finish() {
      if (done) return;
      done = true;
      sessionStorage.removeItem("post_auth_redirect");
      // First Google sign-in for this email → provision a free-tier account,
      // link it to an existing one, or explain why we couldn't.
      let onboarding = false;
      try {
        const result = await ensureAccount();
        if (result.status === "missing_email" || result.status === "duplicate_email") {
          await supabase.auth.signOut();
          setProblem(result.message ?? "We couldn't complete that sign-in.");
          return;
        }
        if (result.needsOnboarding) {
          onboarding = true;
        }
      } catch {
        /* non-blocking: fall through to the requested destination */
      }
      if (onboarding) {
        void navigate({ to: "/onboarding", search: { next: target }, replace: true });
      } else {
        void navigate({ to: target, replace: true });
      }
    }

    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) void finish();
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) void finish();
    });

    const timer = window.setTimeout(() => {
      if (!done) setFailed(true);
    }, 8000);

    return () => {
      sub.subscription.unsubscribe();
      window.clearTimeout(timer);
    };
  }, [navigate]);

  return (
    <div className="grid-canvas flex min-h-screen flex-col items-center justify-center gap-3 px-4 text-center">
      {problem ? (
        <>
          <p className="max-w-sm text-sm text-muted-foreground">{problem}</p>
          <a href="/auth" className="label-mono text-primary underline">
            Back to sign in
          </a>
        </>
      ) : failed ? (
        <>
          <p className="text-sm text-muted-foreground">
            We couldn&apos;t complete that sign-in. Please try again.
          </p>
          <a href="/auth" className="label-mono text-primary underline">
            Back to sign in
          </a>
        </>
      ) : (
        <>
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Finishing sign-in…</p>
        </>
      )}
    </div>
  );
}
