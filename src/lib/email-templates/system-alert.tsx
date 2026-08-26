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

interface SystemAlertProps {
  source?: string;
  event?: string;
  message?: string;
  context?: string;
  occurredAt?: string;
  dashboardUrl?: string;
}

const SystemAlertEmail = ({
  source = "other",
  event = "unknown",
  message = "No further detail.",
  context = "{}",
  occurredAt,
  dashboardUrl = "https://freedomopsai.dev/admin#monitoring",
}: SystemAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      Production alert: {source} / {event}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Niche App Navigator — production alert</Text>
        <Heading style={h1}>
          {source} failure: {event}
        </Heading>
        <Text style={text}>
          {message}
          {occurredAt ? ` (${occurredAt})` : ""}
        </Text>

        <Section style={panel}>
          <Text style={panelTitle}>Context</Text>
          <Text style={code}>{context}</Text>
        </Section>

        <Button style={button} href={dashboardUrl}>
          Open the monitoring dashboard
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          Repeat alerts for the same failure are throttled to one per hour. The full event stream is
          on the owner dashboard.
        </Text>
      </Container>
    </Body>
  </Html>
);

export const template = {
  component: SystemAlertEmail,
  subject: (data: Record<string, unknown>) =>
    `[Alert] ${String(data["source"] ?? "system")}: ${String(data["event"] ?? "failure")}`,
  displayName: "Production alert",
  to: "corranforce@gmail.com",
  previewData: {
    source: "webhook",
    event: "paddle.webhook_failed",
    message: "Signature verification failed",
    context: '{\n  "env": "production"\n}',
    occurredAt: "Wed, 26 Aug 2026 01:12:00 GMT",
    dashboardUrl: "https://freedomopsai.dev/admin#monitoring",
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
const h1 = { fontSize: "20px", fontWeight: "bold" as const, color: "#15202b", margin: "0 0 18px" };
const text = { fontSize: "14px", color: "#55575d", lineHeight: "1.6", margin: "0 0 16px" };
const panel = {
  backgroundColor: "#f5f6f8",
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
const code = {
  fontSize: "12px",
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  color: "#35383d",
  whiteSpace: "pre-wrap" as const,
  margin: "0",
};
const button = {
  backgroundColor: "#1b2430",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  borderRadius: "8px",
  padding: "12px 20px",
  textDecoration: "none",
  display: "inline-block",
};
const hr = { borderColor: "#e6e8eb", margin: "26px 0 16px" };
const footer = { fontSize: "12px", color: "#8a8f98", lineHeight: "1.6", margin: "0" };
