import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { buildStarterPrompt, getUseCase, USE_CASES } from "@/lib/use-cases";

const BASE = "https://idea-spark-fast.lovable.app";

export const Route = createFileRoute("/use-cases/$slug")({
  loader: ({ params }) => {
    const useCase = getUseCase(params.slug);
    if (!useCase) throw notFound();
    return { useCase };
  },
  head: ({ params, loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Use case not found" }, { name: "robots", content: "noindex" }] };
    }
    const u = loaderData.useCase;
    const url = `${BASE}/use-cases/${params.slug}`;
    const description = `${u.tagline} ${u.description}`.slice(0, 155);
    const image = `${BASE}${u.ogImage}`;
    const ratings = u.caseStudies.map((c) => c.rating);
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return {
      meta: [
        { title: `${u.title} — MicroSaaS Solution Finder` },
        { name: "description", content: description },
        { property: "og:title", content: u.title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: url },
        { property: "og:image", content: image },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:image", content: image },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: u.title,
            description,
            url,
            image,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: `MicroSaaS Solution Finder — ${u.painType}`,
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            url,
            image,
            aggregateRating: {
              "@type": "AggregateRating",
              ratingValue: avg.toFixed(1),
              reviewCount: ratings.length,
              bestRating: 5,
              worstRating: 1,
            },
            review: u.caseStudies.map((c) => ({
              "@type": "Review",
              name: c.headline,
              reviewBody: c.quote,
              author: { "@type": "Person", name: `${c.author}, ${c.role}` },
              reviewRating: {
                "@type": "Rating",
                ratingValue: c.rating,
                bestRating: 5,
                worstRating: 1,
              },
            })),
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: `${BASE}/` },
              { "@type": "ListItem", position: 2, name: "Use cases", item: `${BASE}/use-cases` },
              { "@type": "ListItem", position: 3, name: u.painType, item: url },
            ],
          }),
        },
      ],
    };
  },
  component: UseCaseDetail,
  notFoundComponent: UseCaseNotFound,
});

function StarterPromptSection({ prompt }: { prompt: string }) {
  const [copied, setCopied] = useState(false);

  async function copyPrompt() {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the prompt is still selectable below
    }
  }

  return (
    <section className="mt-12">
      <h2 className="text-xl font-semibold">Build it: paste this into a coding LLM</h2>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        A bare-bones starter prompt for this pain point. Copy it into Lovable, Cursor, Claude, or
        any coding assistant to scaffold the MVP — then iterate.
      </p>
      <Card className="mt-4 gap-0 overflow-hidden border-border bg-surface p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-2">
          <span className="label-mono text-muted-foreground">starter-prompt.txt</span>
          <Button variant="ghost" size="sm" onClick={copyPrompt} className="gap-2">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy prompt"}
          </Button>
        </div>
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap p-4 font-mono text-xs leading-relaxed text-muted-foreground">
          {prompt}
        </pre>
      </Card>
    </section>
  );
}

function UseCaseNotFound() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-semibold">That use case doesn't exist</h1>
        <Link to="/use-cases" className="label-mono mt-4 inline-block text-primary hover:underline">
          Back to all use cases
        </Link>
      </main>
    </div>
  );
}

function UseCaseDetail() {
  const { useCase: u } = Route.useLoaderData();
  const others = USE_CASES.filter((o) => o.slug !== u.slug).slice(0, 3);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-4xl px-4 py-16">
        <Link to="/use-cases" className="label-mono text-muted-foreground hover:text-foreground">
          ← Use cases
        </Link>
        <p className="label-mono mt-6 text-primary">{u.painType}</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">{u.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{u.tagline}</p>
        <p className="mt-4 max-w-2xl text-muted-foreground">{u.description}</p>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Signals this is the pain</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {u.signals.map((s) => (
              <li
                key={s}
                className="rounded-md border border-border bg-surface p-3 text-sm text-muted-foreground"
              >
                {s}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">App shapes that remove it</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {u.appShapes.map((a) => (
              <Card key={a.name} className="gap-2 border-border bg-surface p-5">
                <h3 className="font-medium">{a.name}</h3>
                <p className="text-sm text-muted-foreground">{a.blurb}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Example workflow</h2>
          <ol className="mt-4 space-y-2">
            {u.workflow.map((step, i) => (
              <li key={step} className="flex gap-3 text-sm text-muted-foreground">
                <span className="font-mono text-xs text-primary">0{i + 1}</span>
                {step}
              </li>
            ))}
          </ol>
        </section>

        <StarterPromptSection prompt={buildStarterPrompt(u)} />

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Mini case studies</h2>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Composite examples drawn from typical niche builds — what hurt, what shipped, and what
            moved.
          </p>
          <div className="mt-6 space-y-4">
            {u.caseStudies.map((c) => (
              <Card key={c.headline} className="gap-3 border-border bg-surface p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="label-mono text-primary">{c.niche}</p>
                  <span className="font-mono text-xs text-muted-foreground">
                    {"★".repeat(c.rating)}
                    <span className="opacity-30">{"★".repeat(5 - c.rating)}</span>
                  </span>
                </div>
                <h3 className="text-lg font-medium">{c.headline}</h3>
                <dl className="grid gap-3 sm:grid-cols-3">
                  {[
                    ["Challenge", c.challenge],
                    ["What shipped", c.build],
                    ["Result", c.result],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt className="label-mono text-muted-foreground">{k}</dt>
                      <dd className="mt-1 text-sm text-muted-foreground">{v}</dd>
                    </div>
                  ))}
                </dl>
                <blockquote className="mt-1 border-l-2 border-primary pl-4 text-sm italic">
                  “{c.quote}”
                  <footer className="mt-1 font-mono text-xs not-italic text-muted-foreground">
                    {c.author} — {c.role}
                  </footer>
                </blockquote>
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <h2 className="text-xl font-semibold">Niches where it bites hardest</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {u.niches.map((n) => (
              <span
                key={n}
                className="rounded-full border border-border px-3 py-1 font-mono text-xs text-muted-foreground"
              >
                {n}
              </span>
            ))}
          </div>
          <Button asChild className="mt-6">
            <Link to="/">Generate a report for one of these</Link>
          </Button>
        </section>

        <section className="mt-16 border-t border-border pt-8">
          <h2 className="text-sm font-medium">Other pain-point types</h2>
          <div className="mt-3 flex flex-wrap gap-4">
            {others.map((o) => (
              <Link
                key={o.slug}
                to="/use-cases/$slug"
                params={{ slug: o.slug }}
                className="label-mono text-primary hover:underline"
              >
                {o.painType}
              </Link>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
