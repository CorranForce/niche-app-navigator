import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";
import { USE_CASES } from "@/lib/use-cases";

const URL = "https://idea-spark-fast.lovable.app/use-cases";

export const Route = createFileRoute("/use-cases/")({
  head: () => ({
    meta: [
      { title: "Use Cases — Pain-Point Types We Turn Into Apps" },
      {
        name: "description",
        content:
          "Explore the six pain-point types the finder maps: scheduling, manual admin, lead follow-up, quoting, invoicing and client communication — each with app concepts and example niches.",
      },
      { property: "og:title", content: "Use Cases — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content:
          "Six recurring small-business pain-point types, the app shapes that fix them, and the niches where they bite hardest.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: URL },
      { property: "og:image", content: "https://idea-spark-fast.lovable.app/og-use-cases.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://idea-spark-fast.lovable.app/og-use-cases.jpg" },
    ],
    links: [{ rel: "canonical", href: URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "ItemList",
          name: "MicroSaaS pain-point use cases",
          url: URL,
          itemListElement: USE_CASES.map((u, i) => ({
            "@type": "ListItem",
            position: i + 1,
            name: u.painType,
            url: `${URL}/${u.slug}`,
          })),
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Home",
              item: "https://idea-spark-fast.lovable.app/",
            },
            { "@type": "ListItem", position: 2, name: "Use cases", item: URL },
          ],
        }),
      },
    ],
  }),
  component: UseCasesIndex,
});

function UseCasesIndex() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-16">
        <p className="label-mono text-primary">Use cases</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          Six pain-point types, six kinds of app
        </h1>
        <p className="mt-4 max-w-2xl text-muted-foreground">
          Almost every niche report lands on one of these. Each page shows the signals to look for,
          the app shapes that remove the pain, and the niches where it hurts most.
        </p>

        <div className="mt-10 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <Card key={u.slug} className="gap-2 border-border bg-surface p-5">
              <p className="label-mono text-primary">{u.painType}</p>
              <h2 className="font-medium">{u.tagline}</h2>
              <p className="text-sm text-muted-foreground">{u.description}</p>
              <Link
                to="/use-cases/$slug"
                params={{ slug: u.slug }}
                className="label-mono mt-2 inline-flex items-center text-primary hover:underline"
              >
                Read the breakdown <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Card>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
