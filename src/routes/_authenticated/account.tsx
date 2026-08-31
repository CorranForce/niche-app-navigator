import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SiteHeader } from "@/components/site-header";
import { PaymentTestModeBanner } from "@/components/payment-test-mode-banner";
import { BillingManager } from "@/components/billing-manager";
import { TeamManager } from "@/components/team-manager";
import { AccountDangerZone } from "@/components/account-danger-zone";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({
    meta: [
      { title: "Account & billing — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Manage your sign-in methods, plan, payment details and cancellations for MicroSaaS Solution Finder in one place.",
      },
      { property: "og:title", content: "Account & billing" },
      {
        property: "og:description",
        content: "Sign-in methods, plan changes, invoices and cancellations in one place.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

type Identity = { identity_id: string; provider: string; email?: string | undefined };

function AccountPage() {
  const { user } = useSession();
  const [identities, setIdentities] = useState<Identity[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [pwConfirm, setPwConfirm] = useState("");
  const [pwBusy, setPwBusy] = useState(false);

  async function refresh() {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      toast.error(error.message);
      return;
    }
    setIdentities(
      (data?.identities ?? []).map((i) => ({
        identity_id: i.identity_id,
        provider: i.provider,
        email: (i.identity_data?.["email"] as string | undefined) ?? undefined,
      })),
    );
  }

  useEffect(() => {
    void refresh();
  }, [user?.id]);

  const google = identities?.find((i) => i.provider === "google");
  const hasPassword = Boolean(identities?.some((i) => i.provider === "email"));

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (pw !== pwConfirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setPwBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      setPw("");
      setPwConfirm("");
      setPwOpen(false);
      await refresh();
      toast.success(hasPassword ? "Password updated." : "Password set — you can now sign in with email too.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your password");
    } finally {
      setPwBusy(false);
    }
  }

  async function connectGoogle() {
    setBusy(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (error) {
      // Manual linking can be disabled at the auth-provider level; in that case
      // signing in with Google on the same verified email links automatically.
      const message = error instanceof Error ? error.message : "Could not link Google";
      if (/manual linking|not enabled|disabled/i.test(message)) {
        try {
          const result = await lovable.auth.signInWithOAuth("google", {
            redirect_uri: `${window.location.origin}/auth/callback`,
            extraParams: { prompt: "select_account", login_hint: user?.email ?? "" },
          });
          if (result.error) throw new Error(result.error.message);
          await refresh();
          toast.success("Google is now linked to this account.");
          return;
        } catch (fallbackError) {
          toast.error(
            fallbackError instanceof Error
              ? fallbackError.message
              : "Could not link Google to this account",
          );
          return;
        }
      }
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  async function disconnectGoogle() {
    if (!google) return;
    if (!hasPassword) {
      toast.error("Set an email password first — Google is your only way to sign in.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await supabase.auth.getUserIdentities();
      const target = data?.identities?.find((i) => i.identity_id === google.identity_id);
      if (!target) throw new Error("Google identity not found");
      const { error } = await supabase.auth.unlinkIdentity(target);
      if (error) throw error;
      await refresh();
      toast.success("Google disconnected.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect Google");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <PaymentTestModeBanner />
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-12">
        <p className="label-mono text-primary">Account</p>
        <h1 className="mt-3 text-3xl font-semibold">Account &amp; billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {user?.email ?? "Signed in"} — manage how you sign in and what you pay for.
        </p>

        <Card className="mt-8 max-w-2xl gap-4 border-border bg-surface p-6">
          <h2 className="label-mono text-muted-foreground">Sign-in methods</h2>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Email &amp; password</p>
              <p className="text-xs text-muted-foreground">
                {hasPassword ? (user?.email ?? "Enabled") : "Not set up"}
              </p>
            </div>
            <span className="label-mono text-muted-foreground">
              {hasPassword ? "linked" : "unlinked"}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-md border border-border/70 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Google</p>
              <p className="text-xs text-muted-foreground">
                {google ? (google.email ?? "Linked") : "Sign in faster with your Google account"}
              </p>
            </div>
            {google ? (
              <Button variant="outline" size="sm" onClick={disconnectGoogle} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Disconnect"}
              </Button>
            ) : (
              <Button size="sm" onClick={connectGoogle} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Connect Google"}
              </Button>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Signing in with Google using an email that already has an account links the two
            automatically — you keep the same reports and history.
          </p>
        </Card>

        <div className="mt-12 border-t border-border pt-10">
          <BillingManager />
          <TeamManager />
          <div className="mt-12 border-t border-border pt-10">
            <AccountDangerZone />
          </div>
        </div>
      </main>
    </div>
  );
}
