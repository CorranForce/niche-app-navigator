import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  POLICY_LAST_UPDATED,
  REFUND_WINDOW_DAYS,
  SELLER_CONTACT_EMAIL,
  SELLER_LEGAL_NAME,
} from "@/lib/legal";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Refund Policy — MicroSaaS Solution Finder" },
      {
        name: "description",
        content: `Full refunds within ${REFUND_WINDOW_DAYS} days of any charge. How to request a refund, how long it takes, and how trials and cancellations work.`,
      },
      { property: "og:title", content: "Refund Policy" },
      {
        property: "og:description",
        content: `Request a full refund within ${REFUND_WINDOW_DAYS} days of a charge — no questions asked.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RefundsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function RefundsPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-12">
        <p className="label-mono text-primary">Legal</p>
        <h1 className="mt-3 text-3xl font-semibold">Refund Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated {POLICY_LAST_UPDATED}. This policy applies to all subscriptions to
          MicroSaaS Solution Finder, sold by {SELLER_LEGAL_NAME} through our Merchant of Record.
        </p>

        <Section title={`${REFUND_WINDOW_DAYS}-day refund guarantee`}>
          <p>
            You may request a full refund of any subscription charge within {REFUND_WINDOW_DAYS}{" "}
            days of the date that charge was taken. You do not need to give a reason, and you keep
            any reports already generated. Approved refunds are issued in full to the original
            payment method.
          </p>
        </Section>

        <Section title="Free trials">
          <p>
            Every plan includes a 7-day free trial. You are not charged during the trial. Cancel
            before it ends and no payment is taken at all. If your first payment is taken because
            you forgot to cancel, the {REFUND_WINDOW_DAYS}-day refund guarantee above applies to it.
          </p>
        </Section>

        <Section title="How to request a refund">
          <p>Choose whichever is easier:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Email{" "}
              <a className="text-primary hover:underline" href={`mailto:${SELLER_CONTACT_EMAIL}`}>
                {SELLER_CONTACT_EMAIL}
              </a>{" "}
              from your account address with the invoice number or charge date.
            </li>
            <li>
              Contact our Merchant of Record, Paddle.com Market Ltd, at paddle.net — Paddle is the
              seller of record and processes the refund directly.
            </li>
          </ul>
          <p>
            We acknowledge requests within 2 business days. Once approved, Paddle processes the
            refund and it typically reaches your bank or card within 5–10 business days depending on
            your provider.
          </p>
        </Section>

        <Section title="Cancellations">
          <p>
            You can cancel at any time from Account &amp; billing or the Paddle customer portal.
            Cancelling stops future charges and you keep access until the end of the period you have
            already paid for. Cancelling on its own does not trigger a refund — request one using
            the steps above if you are inside the {REFUND_WINDOW_DAYS}-day window.
          </p>
        </Section>

        <Section title="After the refund window">
          <p>
            Charges older than {REFUND_WINDOW_DAYS} days fall outside the guarantee, but we still
            review requests case by case — for example duplicate charges, billing errors, service
            outages or unused annual periods after an accidental renewal. Contact us and we will
            work with you.
          </p>
        </Section>

        <Section title="Chargebacks">
          <p>
            Please contact us before raising a chargeback; we can almost always resolve the issue
            faster. Accounts with an unresolved chargeback may be suspended until the dispute is
            settled.
          </p>
        </Section>
      </main>
      <SiteFooter />
    </div>
  );
}
