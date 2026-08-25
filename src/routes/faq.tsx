import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { Card } from "@/components/ui/card";

const FAQS: { q: string; a: string }[] = [
  {
    q: "How much does MicroSaaS Solution Finder cost?",
    a: "Free is $0 and includes 5 niche reports per month. Pro is $19 per month or $190 per year and includes 50 reports per month. Studio is $49 per month or $490 per year with unlimited reports.",
  },
  {
    q: "What counts as a report against my monthly limit?",
    a: "Each successful generation counts as one report. Re-opening, exporting or copying a saved report as markdown never counts again. Generations that fail before a report is saved are not counted.",
  },
  {
    q: "When does my monthly report allowance reset?",
    a: "The allowance is counted per calendar month and resets at the start of each month, independent of the day you subscribed.",
  },
  {
    q: "What happens when I upgrade or downgrade my plan?",
    a: "Plan changes always take effect at your next renewal date. You keep the plan you are currently paying for until that renewal, then the new plan and its report limit apply.",
  },
  {
    q: "What happens if I cancel my subscription?",
    a: "Cancelling keeps full access until the end of the period you already paid for. At that point the account drops back to the Free plan and its 5 reports per month. Reports you already generated stay in your history.",
  },
  {
    q: "Do you offer refunds?",
    a: "Payments are processed by our reseller of record. If a charge was unexpected or you have not used the plan in the current period, contact support within 14 days of the charge and we will review it and, where appropriate, ask the reseller to refund it. Because plan changes apply at renewal, the usual outcome for a change of mind is cancelling before the next renewal rather than a mid-period refund.",
  },
  {
    q: "My payment failed — what happens to my account?",
    a: "A failed payment puts the subscription into a past-due state and the account immediately falls back to Free plan limits. Nothing is deleted: your saved reports remain available, and full limits return as soon as a payment succeeds.",
  },
  {
    q: "How do I recover from a failed payment?",
    a: "Open Billing from the site header, use Update payment details to enter a working card, then retry the outstanding payment from the same page. The banner across the top of the app disappears once the retry succeeds. If it fails again, check with your bank for a block on recurring international charges, then try a different card.",
  },
  {
    q: "Where can I see my invoices and billing history?",
    a: "Billing shows your current plan, renewal date and past transactions. An invoice receipt email is also sent after each successful billing cycle.",
  },
  {
    q: "Do I need an account to generate a report?",
    a: "Yes. Reports are saved to your account so you can reopen them later. You can sign up with email and password or with Google.",
  },
];

const FAQ_URL = "https://idea-spark-fast.lovable.app/faq";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Pricing, Billing & Refunds | MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "Answers on plan pricing, report limits, upgrades and cancellations, refunds, and how to recover from a failed subscription payment.",
      },
      { property: "og:title", content: "FAQ — MicroSaaS Solution Finder" },
      {
        property: "og:description",
        content:
          "Pricing, billing, refunds and payment-failed recovery steps for the MicroSaaS Solution Finder.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: FAQ_URL },
      { property: "og:image", content: "https://idea-spark-fast.lovable.app/og-image.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://idea-spark-fast.lovable.app/og-image.jpg" },
    ],
    links: [{ rel: "canonical", href: FAQ_URL }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "FAQPage",
          url: FAQ_URL,
          mainEntity: FAQS.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
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
            { "@type": "ListItem", position: 2, name: "FAQ", item: FAQ_URL },
          ],
        }),
      },
    ],
  }),
  component: FaqPage,
});

function FaqPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-16">
        <p className="label-mono text-primary">Support</p>
        <h1 className="mt-3 text-3xl font-semibold sm:text-4xl">
          Pricing, billing and payment questions
        </h1>
        <p className="mt-4 text-muted-foreground">
          Everything about plans, limits, refunds and getting a failed payment back on track.
        </p>

        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <Card key={f.q} className="gap-2 border-border bg-surface p-5">
              <h2 className="text-base font-medium">{f.q}</h2>
              <p className="text-sm text-muted-foreground">{f.a}</p>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap gap-4">
          <Link to="/pricing" className="label-mono text-primary hover:underline">
            See plans
          </Link>
          <Link to="/use-cases" className="label-mono text-primary hover:underline">
            Browse use cases
          </Link>
        </div>
      </main>
    </div>
  );
}
