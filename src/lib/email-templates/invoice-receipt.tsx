import * as React from 'react'
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
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface InvoiceReceiptProps {
  planName?: string
  amount?: string
  invoiceNumber?: string
  billedAt?: string
  nextRenewalAt?: string
  invoiceUrl?: string
  billingUrl?: string
}

const InvoiceReceiptEmail = ({
  planName = 'your plan',
  amount,
  invoiceNumber,
  billedAt,
  nextRenewalAt,
  invoiceUrl,
  billingUrl = 'https://freedomopsai.dev/billing',
}: InvoiceReceiptProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>
      {`Payment received${amount ? ` — ${amount}` : ''} for ${planName}`}
    </Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>Niche App Navigator</Text>
        <Heading style={h1}>Thanks — your payment went through</Heading>
        <Text style={text}>
          Your subscription to <strong>{planName}</strong> has renewed and your access continues
          uninterrupted.
        </Text>

        <Section style={panel}>
          <Row style={row}>
            <Column style={label}>Amount</Column>
            <Column style={value}>{amount ?? '—'}</Column>
          </Row>
          <Row style={row}>
            <Column style={label}>Invoice</Column>
            <Column style={value}>{invoiceNumber ?? '—'}</Column>
          </Row>
          <Row style={row}>
            <Column style={label}>Billed on</Column>
            <Column style={value}>{billedAt ?? '—'}</Column>
          </Row>
          <Row style={row}>
            <Column style={label}>Next renewal</Column>
            <Column style={value}>{nextRenewalAt ?? '—'}</Column>
          </Row>
        </Section>

        <Button style={button} href={invoiceUrl || billingUrl}>
          {invoiceUrl ? 'View invoice' : 'View billing'}
        </Button>

        <Hr style={hr} />
        <Text style={footer}>
          You can change or cancel your plan any time from your billing page — changes take effect
          at your next renewal, and cancellations keep access until the end of the paid period.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: InvoiceReceiptEmail,
  subject: 'Your receipt and renewal confirmation',
  displayName: 'Invoice / renewal confirmation',
  previewData: {
    planName: 'Pro (monthly)',
    amount: '$19.00',
    invoiceNumber: 'INV-1042',
    billedAt: 'August 25, 2026',
    nextRenewalAt: 'September 25, 2026',
    billingUrl: 'https://freedomopsai.dev/billing',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, Helvetica, sans-serif' }
const container = { padding: '24px 25px', maxWidth: '560px' }
const eyebrow = {
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase' as const,
  color: '#8a8f98',
  margin: '0 0 12px',
}
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#15202b', margin: '0 0 18px' }
const text = { fontSize: '14px', color: '#55575d', lineHeight: '1.6', margin: '0 0 16px' }
const panel = {
  backgroundColor: '#f5f6f8',
  borderRadius: '10px',
  padding: '14px 18px',
  margin: '0 0 22px',
}
const row = { marginBottom: '6px' }
const label = { fontSize: '13px', color: '#8a8f98', width: '45%' }
const value = { fontSize: '13px', color: '#15202b', fontWeight: 'bold' as const }
const button = {
  backgroundColor: '#f0b429',
  color: '#1b2430',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
  display: 'inline-block',
}
const hr = { borderColor: '#e6e8eb', margin: '26px 0 16px' }
const footer = { fontSize: '12px', color: '#8a8f98', lineHeight: '1.6', margin: '0' }
