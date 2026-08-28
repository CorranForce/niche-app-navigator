import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface PaymentFailedProps {
  planName?: string;
  amount?: string;
  attemptedAt?: string;
  nextRetryAt?: string;
  billingUrl?: string;
}

const PaymentFailedEmail = ({
  planName = "your plan",
  amount,
  attemptedAt,
  nextRetryAt,
  billingUrl = "https://freedomopsai.dev/billing",
}: PaymentFailedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We could not process your payment — update your card to restore full access</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Niche App Navigator</Text>
        <Heading style={h1}>Your payment did not go through</Heading>
        <Text style={text}>
          We tried to charge your payment method for <strong>{planName}</strong>
          {amount ? ` (${amount})` : ""}
          {attemptedAt ? ` on ${attemptedAt}` : ""}, but the charge was declined.
        </Text>
        <Text style={text}>
          Until it is resolved, new report generation is paused on your account for the rest of the
          billing period. Your saved reports are untouched.
        </Text>

        <Section style={panel}>
          <Text style={panelTitle}>How to fix it</Text>
          <Text style={step}>1. Open your billing page and choose “Update payment details”.</Text>
          <Text style={step}>2. Enter a valid card or switch to a different payment method.</Text>
          <Text style={step}>
            3. We retry the charge automatically
            {nextRetryAt ? ` around ${nextRetryAt}` : " over the next few days"} — full access
            returns as soon as it succeeds.
          </Text>
        </Section>

        <Button style={button} href={billingUrl}>
          Update payment details
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          Common causes: expired card, insufficient funds, or a bank block on international charges.
          If the card is fine, contacting your bank usually clears it.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: PaymentFailedEmail,
  subject: "Action needed: your payment failed",
  displayName: "Payment failed",
  previewData: {
    planName: "Pro (monthly)",
    amount: "$19.00",
    attemptedAt: "August 25, 2026",
    nextRetryAt: "August 28, 2026",
    billingUrl: "https://freedomopsai.dev/billing",
  },
} satisfies TemplateEntry;

const main = { backgroundColor: "#ffffff", fontFamily: "Arial, Helvetica, sans-serif" };
const container = { padding: "24px 25px", maxWidth: "560px" };
const eyebrow = {
  fontSize: "11px",
  letterSpacing: "1.5px",
  textTransform: "uppercase" as const,
  color: "#8a8f98",
  margin: "0 0 12px",
};
const h1 = { fontSize: "22px", fontWeight: "bold" as const, color: "#15202b", margin: "0 0 18px" };
const text = { fontSize: "14px", color: "#55575d", lineHeight: "1.6", margin: "0 0 16px" };
const panel = {
  backgroundColor: "#fdf7e8",
  borderRadius: "10px",
  padding: "16px 18px",
  margin: "0 0 22px",
};
const panelTitle = {
  fontSize: "13px",
  fontWeight: "bold" as const,
  color: "#15202b",
  margin: "0 0 10px",
};
const step = { fontSize: "13px", color: "#55575d", lineHeight: "1.6", margin: "0 0 8px" };
const button = {
  backgroundColor: "#f0b429",
  color: "#1b2430",
  fontSize: "14px",
  fontWeight: "bold" as const,
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#e6e8eb", margin: "26px 0 16px" };
const footer = { fontSize: "12px", color: "#8a8f98", lineHeight: "1.6", margin: "0" };
