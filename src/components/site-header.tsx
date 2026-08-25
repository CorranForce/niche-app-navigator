import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { getIsAdmin } from "@/lib/auth-analytics.functions";
import { Button } from "@/components/ui/button";
import { PastDueBanner } from "@/components/past-due-banner";

const NAV = [
  { to: "/", label: "Finder" },
  { to: "/use-cases", label: "Use cases" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
] as const;

export function SiteHeader() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const checkAdmin = useServerFn(getIsAdmin);
  const { data: admin } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => checkAdmin(),
    enabled: Boolean(user),
    retry: false,
  });
  const isAdmin = Boolean(admin?.isAdmin);

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border/80 bg-background/85 backdrop-blur">
      <PastDueBanner />
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="grid h-6 w-6 place-items-center rounded-sm bg-primary font-mono text-[11px] font-bold text-primary-foreground">
            µ
          </span>
          <span className="font-mono text-sm font-semibold tracking-tight">solutionfinder</span>
        </Link>

        <nav className="hidden items-center gap-5 sm:flex">
          {NAV.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`label-mono transition-colors hover:text-foreground ${
                pathname === item.to ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {user ? (
            <Link
              to="/reports"
              className={`label-mono transition-colors hover:text-foreground ${
                pathname.startsWith("/reports") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              My reports
            </Link>
          ) : null}
          {user ? (
            <Link
              to="/billing"
              className={`label-mono transition-colors hover:text-foreground ${
                pathname.startsWith("/billing") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Billing
            </Link>
          ) : null}
          {user ? (
            <Link
              to="/account"
              className={`label-mono transition-colors hover:text-foreground ${
                pathname.startsWith("/account") ? "text-primary" : "text-muted-foreground"
              }`}
            >
              Account
            </Link>
          ) : null}

          {isAdmin ? (
            <>
              <Link
                to="/admin/oauth"
                className={`label-mono transition-colors hover:text-foreground ${
                  pathname.startsWith("/admin/oauth") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                OAuth health
              </Link>
              <Link
                to="/admin/users"
                className={`label-mono transition-colors hover:text-foreground ${
                  pathname.startsWith("/admin/users") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Customers
              </Link>
              <Link
                to="/admin/emails"
                className={`label-mono transition-colors hover:text-foreground ${
                  pathname.startsWith("/admin/emails") ? "text-primary" : "text-muted-foreground"
                }`}
              >
                Emails
              </Link>
            </>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {loading ? null : user ? (
            <>
              <span className="hidden font-mono text-xs text-muted-foreground md:inline">
                {user.email}
              </span>
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                Sign out
              </Button>
            </>
          ) : (
            <Button asChild size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
