import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  POLICY_LAST_UPDATED,
  REFUND_WINDOW_DAYS,
  SELLER_CONTACT_EMAIL,
  SELLER_LEGAL_NAME,
  SELLER_TRADING_NAME,
} from "@/lib/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "The terms governing use of MicroSaaS Solution Finder: subscriptions, acceptable use, intellectual property, suspension and liability.",
      },
      { property: "og:title", content: "Terms & Conditions" },
      {
        property: "og:description",
        content: "Subscription terms, acceptable use and legal conditions for using the service.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="label-mono text-primary">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold">Terms &amp; Conditions</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {POLICY_LAST_UPDATED}. These terms form a binding agreement between you and{" "}
          {SELLER_LEGAL_NAME}.
        </p>

        <Section title="1. Who you are contracting with">
          <p>
            {SELLER_TRADING_NAME} (&ldquo;the Service&rdquo;) is owned and operated by{" "}
            {SELLER_LEGAL_NAME} (&ldquo;we&rdquo;, &ldquo;us&rdquo;). You can reach us at{" "}
            <a className="text-primary hover:underline" href={`mailto:${SELLER_CONTACT_EMAIL}`}>
              {SELLER_CONTACT_EMAIL}
            </a>
            .
          </p>
          <p>
            Our order process is conducted by our online reseller and Merchant of Record, Paddle.com
            Market Ltd (&ldquo;Paddle&rdquo;). Paddle handles all customer orders, payments,
            invoicing, tax and refunds, and is the seller of record for every purchase made through
            this site. Paddle&rsquo;s own terms and privacy notice are available at paddle.net and
            apply to the payment transaction.
          </p>
        </Section>

        <Section title="2. Acceptance">
          <p>
            By creating an account, starting a free trial, or purchasing a subscription you accept
            these terms. If you do not agree, do not use the Service. We may update these terms;
            material changes take effect at your next renewal and continued use after that date
            means you accept them.
          </p>
        </Section>

        <Section title="3. Accounts">
          <p>
            You must provide accurate information, be at least 18 years old, and keep your
            credentials secure. You are responsible for all activity under your account. Studio plan
            seat holders you invite are also bound by these terms.
          </p>
        </Section>

        <Section title="4. Subscriptions, trials and billing">
          <p>
            Plans are Solo, Pro and Studio, billed monthly or annually as shown on the pricing page.
            Every plan starts with a 7-day free trial and requires a valid payment method. If you do
            not cancel before the trial ends, the plan renews automatically at the listed price
            until cancelled.
          </p>
          <p>
            Plan changes (upgrades and downgrades) take effect at your next renewal. Cancellations
            keep access until the end of the paid period. Prices are shown exclusive or inclusive of
            tax as determined by Paddle at checkout for your location.
          </p>
          <p>
            Refunds are governed by our Refund Policy, which allows a full refund within{" "}
            {REFUND_WINDOW_DAYS} days of a charge.
          </p>
        </Section>

        <Section title="5. Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              resell, sublicense or redistribute the Service or generated reports as a competing
              product;
            </li>
            <li>
              scrape, reverse engineer, or attempt to access the Service outside the published
              interfaces or MCP endpoints;
            </li>
            <li>
              use the Service for unlawful, deceptive, infringing, harassing or harmful purposes;
            </li>
            <li>
              submit content you have no right to submit, or personal data of others without a
              lawful basis;
            </li>
            <li>circumvent plan limits, rate limits, trials or billing;</li>
            <li>overload, disrupt or probe our infrastructure or that of our providers.</li>
          </ul>
        </Section>

        <Section title="6. Intellectual property">
          <p>
            We own the Service, its software, branding, prompts and site content. You are granted a
            limited, non-exclusive, non-transferable right to use it while your subscription is
            active. You own the niche inputs you submit, and you may use the reports the Service
            generates for you — including commercially — within the limits of section 5.
          </p>
        </Section>

        <Section title="7. AI-generated output">
          <p>
            Reports are produced by automated models and are suggestions, not professional,
            financial or legal advice. Output may be inaccurate or incomplete, and similar output
            may be generated for other customers. Validate findings before acting on them.
          </p>
        </Section>

        <Section title="8. Suspension and termination">
          <p>
            We may suspend or terminate access immediately for breach of these terms, suspected
            fraud or abuse, non-payment after Paddle&rsquo;s dunning attempts, or where required by
            law. Where practical we will warn you first and allow you to fix the problem. You may
            cancel at any time from Account &amp; billing. On termination for breach, no refund is
            due beyond the Refund Policy window.
          </p>
        </Section>

        <Section title="9. Availability and support">
          <p>
            We aim for continuous availability but do not guarantee uninterrupted service; planned
            maintenance and third-party outages can interrupt it. Support is by email at{" "}
            <a className="text-primary hover:underline" href={`mailto:${SELLER_CONTACT_EMAIL}`}>
              {SELLER_CONTACT_EMAIL}
            </a>
            ; Studio customers receive priority handling.
          </p>
        </Section>

        <Section title="10. Liability">
          <p>
            To the maximum extent permitted by law, the Service is provided &ldquo;as is&rdquo;, and
            our aggregate liability arising from the Service is limited to the amount you paid in
            the 12 months preceding the claim. We are not liable for indirect or consequential loss,
            lost profits, or business decisions made on the basis of generated reports. Nothing
            limits liability that cannot lawfully be limited, and statutory consumer rights are
            unaffected.
          </p>
        </Section>

        <Section title="11. Governing law">
          <p>
            These terms are governed by the laws applicable at {SELLER_LEGAL_NAME}&rsquo;s place of
            establishment, without prejudice to mandatory consumer protections in your country of
            residence.
          </p>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}
