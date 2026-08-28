import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { POLICY_LAST_UPDATED, SELLER_CONTACT_EMAIL, SELLER_LEGAL_NAME } from "@/lib/legal";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — MicroSaaS Solution Finder" },
      {
        name: "description",
        content:
          "What personal data MicroSaaS Solution Finder collects, why, who we share it with (including Paddle, our Merchant of Record), and your data rights.",
      },
      { property: "og:title", content: "Privacy Notice" },
      {
        property: "og:description",
        content: "Data we collect, how it is used and shared, retention periods and your rights.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="label-mono text-primary">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold">Privacy Notice</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated {POLICY_LAST_UPDATED}.</p>

        <Section title="Who controls your data">
          <p>
            {SELLER_LEGAL_NAME}, operator of MicroSaaS Solution Finder, is the data controller for
            personal data processed through this site. Contact us about privacy at{" "}
            <a className="text-primary hover:underline" href={`mailto:${SELLER_CONTACT_EMAIL}`}>
              {SELLER_CONTACT_EMAIL}
            </a>
            .
          </p>
          <p>
            Paddle.com Market Ltd is our Merchant of Record and an independent controller for
            payment and tax data it collects at checkout. See paddle.net for Paddle&rsquo;s privacy
            notice.
          </p>
        </Section>

        <Section title="Categories of personal data we collect">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Account data</strong> — email address, display name, Google account identifier
              when you sign in with Google, and password credentials held by our auth provider.
            </li>
            <li>
              <strong>Profile and onboarding data</strong> — workspace name, role title and stated
              use case.
            </li>
            <li>
              <strong>Content data</strong> — the niches, audiences and budgets you submit and the
              reports generated from them.
            </li>
            <li>
              <strong>Team data</strong> — email addresses you invite to a Studio team and their
              membership status.
            </li>
            <li>
              <strong>Billing data</strong> — subscription plan, status, billing period and the
              customer/subscription identifiers issued by Paddle. We never receive or store your
              full card number.
            </li>
            <li>
              <strong>Technical and security data</strong> — sign-in events, browser user-agent, a
              truncated IP prefix, error and system events, and email delivery outcomes.
            </li>
            <li>
              <strong>Agent access data</strong> — MCP client registrations, consents and tool
              request logs when you connect an AI agent.
            </li>
          </ul>
        </Section>

        <Section title="Why we use it and on what basis">
          <p>
            To provide the Service and your account (contract), to take payment and meet tax and
            accounting obligations (contract and legal obligation), to secure the Service and
            prevent fraud or abuse (legitimate interests), to send transactional email such as
            invoices, payment failures and password resets (contract), and to improve reliability
            through aggregated diagnostics (legitimate interests). We do not sell your data and we
            do not use your reports to train third-party models beyond generating your output.
          </p>
        </Section>

        <Section title="Who we share it with">
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Paddle.com Market Ltd</strong> — Merchant of Record: checkout, payment, tax,
              invoicing, refunds and dunning.
            </li>
            <li>
              <strong>Supabase</strong> — database, authentication and hosting of application data.
            </li>
            <li>
              <strong>Lovable</strong> — application hosting, AI model gateway and transactional
              email delivery.
            </li>
            <li>
              <strong>Google</strong> — only if you choose Google sign-in, for authentication.
            </li>
            <li>
              Authorities, advisers or acquirers where legally required or in connection with a
              business transfer.
            </li>
          </ul>
        </Section>

        <Section title="International transfers">
          <p>
            Our providers may process data in the United States and the European Union. Transfers
            outside your region rely on Standard Contractual Clauses or equivalent safeguards
            operated by those providers.
          </p>
        </Section>

        <Section title="Retention">
          <p>
            Account, profile and report data are kept while your account exists and deleted within
            30 days of account deletion. Billing records are retained for up to 7 years to meet tax
            obligations. Security, email and agent logs are retained for up to 12 months.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            You may request access, correction, deletion, restriction, portability or object to
            processing, and you can withdraw consent for optional processing at any time. Email{" "}
            <a className="text-primary hover:underline" href={`mailto:${SELLER_CONTACT_EMAIL}`}>
              {SELLER_CONTACT_EMAIL}
            </a>{" "}
            and we will respond within 30 days. You may also complain to your local data protection
            authority.
          </p>
        </Section>

        <Section title="Cookies and local storage">
          <p>
            We use strictly necessary cookies and browser storage to keep you signed in and to
            remember interface state, plus cookies set by Paddle during checkout for fraud
            prevention. We do not run advertising or cross-site tracking cookies.
          </p>
        </Section>

        <Section title="Children">
          <p>
            The Service is not directed to anyone under 18 and we do not knowingly collect their
            data.
          </p>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}
