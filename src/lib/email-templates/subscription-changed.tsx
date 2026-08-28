import * as React from "react";
import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import type { TemplateEntry } from "./registry";

interface SubscriptionChangedProps {
  headline?: string;
  summary?: string;
  planName?: string;
  status?: string;
  effectiveAt?: string;
  billingUrl?: string;
}

const SubscriptionChangedEmail = ({
  headline = "Your subscription was updated",
  summary = "We recorded a change to your subscription.",
  planName = "your plan",
  status,
  effectiveAt,
  billingUrl = "https://freedomopsai.dev/account#billing",
}: SubscriptionChangedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{headline}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Niche App Navigator</Text>
        <Heading style={h1}>{headline}</Heading>
        <Text style={text}>{summary}</Text>

        <Section style={panel}>
          <Row style={row}>
            <Column style={label}>Plan</Column>
            <Column style={value}>{planName}</Column>
          </Row>
          <Row style={row}>
            <Column style={label}>Status</Column>
            <Column style={value}>{status ?? "—"}</Column>
          </Row>
          <Row style={row}>
            <Column style={label}>Effective</Column>
            <Column style={value}>{effectiveAt ?? "—"}</Column>
          </Row>
        </Section>

        <Button style={button} href={billingUrl}>
          View billing
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          If you didn&apos;t make this change, open your billing page and review your plan — you can
          undo a scheduled cancellation any time before it takes effect.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: SubscriptionChangedEmail,
  subject: "Your subscription was updated",
  displayName: "Subscription change confirmation",
  previewData: {
    headline: "Your plan change is scheduled",
    summary: "You switched to Pro. The new price applies at your next renewal.",
    planName: "Pro",
    status: "active",
    effectiveAt: "September 25, 2026",
    billingUrl: "https://freedomopsai.dev/account#billing",
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
  backgroundColor: "#f5f6f8",
  borderRadius: "10px",
  padding: "14px 18px",
  margin: "0 0 22px",
};
const row = { marginBottom: "6px" };
const label = { fontSize: "13px", color: "#8a8f98", width: "45%" };
const value = { fontSize: "13px", color: "#15202b", fontWeight: "bold" as const };
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
