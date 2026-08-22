import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2, Search } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSession } from "@/hooks/use-session";
import { generateReport } from "@/lib/reports.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MicroSaaS Solution Finder — Niche Pain Points to Shippable Apps" },
      {
        name: "description",
        content:
          "Enter any niche and get its top pain points, three buildable micro-SaaS concepts, pricing tiers and a 72-hour release plan.",
      },
      { property: "og:title", content: "MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content:
          "Turn a niche into validated pain points, app concepts, pricing tiers and a 72-hour build plan.",
      },
    ],
  }),
  component: Index,
});

const EXAMPLES = [
  "Independent dental clinics",
  "Boutique fitness studios",
  "Freelance wedding photographers",
];

const QUICK_IDEAS = [
  "Mobile dog groomers",
  "Indie ceramics sellers",
  "Small-town law firms",
  "Food truck operators",
  "Music teachers",
  "Local moving companies",
  "Boutique travel agents",
  "Auto detailing shops",
];

function Index() {
  const { user, loading } = useSession();
  const navigate = useNavigate();
  const [niche, setNiche] = useState("");
  const [audience, setAudience] = useState("small businesses (1-20 staff)");
  const [budget, setBudget] = useState("moderate ($20-100/mo)");

  const generate = useServerFn(generateReport);
  const mutation = useMutation({
    mutationFn: (input: { niche: string; audience: string; budget: string }) =>
      generate({ data: input }),
    onSuccess: ({ id }) => navigate({ to: "/reports/$id", params: { id } }),
    onError: (error: Error) => toast.error(error.message),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    let target = niche.trim();
    if (target.length < 2) {
      target = QUICK_IDEAS[Math.floor(Math.random() * QUICK_IDEAS.length)] ?? "Mobile dog groomers";
      setNiche(target);
      toast.info(`Feeling lucky — trying "${target}"`);
    }
    if (!user) {
      navigate({ to: "/auth", search: { redirect: "/" } });
      return;
    }
    mutation.mutate({ niche: target, audience, budget });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />

      <main>
        <section className="grid-canvas border-b border-border">
          <div className="mx-auto max-w-4xl px-4 py-20 text-center">
            <p className="label-mono text-primary">Niche in · shippable product out</p>
            <h1 className="mx-auto mt-4 max-w-3xl text-4xl font-semibold leading-tight sm:text-5xl">
              Find the pain worth building for — then ship it in 72 hours.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-muted-foreground">
              Name a niche. Get its most common operational pain points, three narrow app concepts
              that fix them, a pricing tier structure and a feature breakdown scoped to a three-day
              first release.
            </p>

            <Card className="mx-auto mt-10 max-w-3xl border-border bg-surface p-5 text-left">
              <form onSubmit={onSubmit} className="space-y-4">
                <div>
                  <p className="label-mono text-muted-foreground">Quick ideas</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {QUICK_IDEAS.slice(0, 6).map((idea) => (
                      <button
                        key={idea}
                        type="button"
                        onClick={() => setNiche(idea)}
                        className="rounded-md border border-border bg-background px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                      >
                        {idea}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="niche" className="label-mono text-muted-foreground">
                    Niche
                  </label>
                  <div className="mt-2 flex gap-2">
                    <Input
                      id="niche"
                      value={niche}
                      onChange={(e) => setNiche(e.target.value)}
                      placeholder="e.g. independent dental clinics"
                      className="h-11"
                      maxLength={120}
                    />
                    <Button type="submit" size="lg" disabled={mutation.isPending || loading}>
                      {mutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Search className="h-4 w-4" />
                      )}
                      <span className="ml-2 hidden sm:inline">Find solutions</span>
                    </Button>
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="label-mono text-muted-foreground">Audience</label>
                    <Select value={audience} onValueChange={setAudience}>
                      <SelectTrigger className="mt-2 w-full">
                        <SelectValue>{audience}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="solo operators">Solo operators</SelectItem>
                        <SelectItem value="small businesses (1-20 staff)">
                          Small businesses (1–20)
                        </SelectItem>
                        <SelectItem value="mid-market (20-200 staff)">
                          Mid-market (20–200)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="label-mono text-muted-foreground">Budget level</label>
                    <Select value={budget} onValueChange={setBudget}>
                      <SelectTrigger className="mt-2 w-full">
                        <SelectValue>{budget}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="tight (under $20/mo)">Tight (under $20/mo)</SelectItem>
                        <SelectItem value="moderate ($20-100/mo)">Moderate ($20–100/mo)</SelectItem>
                        <SelectItem value="premium ($100+/mo)">Premium ($100+/mo)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <span className="label-mono text-muted-foreground">Try</span>
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setNiche(ex)}
                      className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </form>
            </Card>

            {mutation.isPending ? (
              <p className="mt-6 font-mono text-xs text-muted-foreground">
                Analysing the niche, scoring pain points and scoping the build… this takes a minute.
              </p>
            ) : !user && !loading ? (
              <p className="mt-6 font-mono text-xs text-muted-foreground">
                You'll be asked to sign in — reports are saved to your account.
              </p>
            ) : null}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-20">
          <p className="label-mono text-primary">What comes back</p>
          <h2 className="mt-3 text-2xl font-semibold">Every report is the same four-part brief</h2>
          <div className="mt-8 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                n: "01",
                t: "Pain points",
                d: "5–7 specific operational pains, ranked by severity, each with the signal it shows up in.",
              },
              {
                n: "02",
                t: "App concepts",
                d: "Three narrow product ideas, each flagged for build complexity and 72-hour feasibility.",
              },
              {
                n: "03",
                t: "Pricing tiers",
                d: "A three-tier structure with realistic monthly prices and the limits that separate them.",
              },
              {
                n: "04",
                t: "Feature breakdown",
                d: "Features mapped to tiers with hour estimates, split into first release and later.",
              },
            ].map((f) => (
              <Card key={f.n} className="gap-2 border-border bg-surface p-5">
                <p className="font-mono text-xs text-primary">{f.n}</p>
                <h3 className="font-medium">{f.t}</h3>
                <p className="text-sm text-muted-foreground">{f.d}</p>
              </Card>
            ))}
          </div>

          <div className="mt-10">
            <Button asChild variant="outline">
              <Link to="/pricing">
                See plans <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8">
          <p className="font-mono text-xs text-muted-foreground">µ solutionfinder</p>
          <Link to="/pricing" className="label-mono text-muted-foreground hover:text-foreground">
            Pricing
          </Link>
        </div>
      </footer>
    </div>
  );
}
