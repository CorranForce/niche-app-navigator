import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { ensureAccount } from "@/lib/account.functions";

import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

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
    ],
  }),
  component: AuthPage,
});

function safePath(value: string | undefined) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

type AuthEvent = "start" | "success" | "error" | "timeout" | "redirected";

/**
 * Fire-and-forget OAuth telemetry. Uses sendBeacon so events emitted right
 * before the OAuth redirect still reach the server; falls back to keepalive fetch.
 */
function track(event: AuthEvent, reason?: string) {
  if (typeof window === "undefined") return;
  const payload = JSON.stringify({
    provider: "google",
    event,
    ...(reason ? { reason: reason.slice(0, 300) } : {}),
  });
  const url = "/api/public/auth-event";
  try {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon?.(url, blob)) return;
  } catch {
    /* fall through */
  }
  void fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
}

function AuthPage() {
  const navigate = useNavigate();
  const search = useSearch({ from: "/auth" });
  const { user, loading } = useSession();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);

  const next = safePath(search.redirect);

  useEffect(() => {
    if (!loading && user) navigate({ to: next, replace: true });
  }, [loading, user, next, navigate]);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}${next}` },
        });
        if (error) throw error;
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setOauthError(null);
    track("start");
    // Fallback: if the popup/callback never returns, re-enable the button and
    // tell the user what happened instead of leaving a dead spinner.
    const releaseBusy = window.setTimeout(() => {
      setBusy(false);
      setOauthError(
        "Google sign-in timed out. The popup may have been closed or blocked — try again, or use email and password below.",
      );
      toast.error("Google sign-in timed out");
      track("timeout", "no callback within 45s");
    }, 45000);
    try {
      // Remember where to land, then return to a real public route we own.
      sessionStorage.setItem("post_auth_redirect", next);
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback`,
        extraParams: { prompt: "select_account" },
      });
      if (result.error) {
        const message = result.error.message || "Google sign-in failed. Please try again.";
        setOauthError(message);
        toast.error(message);
        track("error", message);
        return;
      }
      if (result.redirected) {
        track("redirected");
        return; // browser leaves this page
      }

      track("success");
      // New Google email → provision a free-tier account (or link an existing
      // one) before landing.
      let destination = next;
      try {
        const account = await ensureAccount();
        if (account.status === "missing_email" || account.status === "duplicate_email") {
          await supabase.auth.signOut();
          const message = account.message ?? "We couldn't complete that sign-in.";
          setOauthError(message);
          toast.error(message);
          track("error", account.status);
          return;
        }
        if (account.needsOnboarding) {
          destination = `/onboarding?next=${encodeURIComponent(next)}`;
        }
      } catch {
        /* non-blocking */
      }
      // The Lovable auth wrapper has already persisted the returned session.
      // Navigate directly instead of making another auth call while the
      // SIGNED_IN listener is still completing.
      await navigate({ to: next, replace: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Google sign-in failed. Please try again.";
      setOauthError(message);
      toast.error(message);
      track("error", message);
    } finally {
      window.clearTimeout(releaseBusy);
      setBusy(false);
    }
  }

  return (
    <div className="grid-canvas flex min-h-screen items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-sm bg-primary font-mono text-[11px] font-bold text-primary-foreground">
            µ
          </span>
          <span className="font-mono text-sm font-semibold">solutionfinder</span>
        </Link>

        <Card className="gap-5 border-border bg-surface p-6">
          <div>
            <h1 className="text-xl font-semibold">
              {mode === "signin" ? "Sign in" : "Create your account"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Reports are saved to your account so you can come back to them.
            </p>
          </div>

          <Button variant="outline" onClick={handleGoogle} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : oauthError ? (
              "Retry with Google"
            ) : (
              "Continue with Google"
            )}
          </Button>

          {oauthError ? (
            <p
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive-foreground"
            >
              {oauthError}
            </p>
          ) : null}

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="label-mono text-muted-foreground">or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleEmail} className="space-y-3">
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
            />
            <Input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signin" ? (
                "Sign in"
              ) : (
                "Sign up"
              )}
            </Button>
          </form>

          <button
            type="button"
            className="label-mono text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          >
            {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
          </button>
        </Card>
      </div>
    </div>
  );
}
