import { Link } from "@tanstack/react-router";
import { SELLER_LEGAL_NAME } from "@/lib/legal";

const LINKS = [
  { to: "/use-cases", label: "Use cases" },
  { to: "/pricing", label: "Pricing" },
  { to: "/faq", label: "FAQ" },
  { to: "/terms", label: "Terms" },
  { to: "/refunds", label: "Refunds" },
  { to: "/privacy", label: "Privacy" },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8">
        <div>
          <p className="font-mono text-xs text-muted-foreground">µ solutionfinder</p>
          <p className="mt-1 text-xs text-muted-foreground">
            © {new Date().getFullYear()} {SELLER_LEGAL_NAME}. Payments processed by Paddle.com
            Market Ltd, our Merchant of Record.
          </p>
        </div>
        <nav className="flex flex-wrap gap-4">
          {LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="label-mono text-muted-foreground hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
