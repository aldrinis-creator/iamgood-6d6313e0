/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface EmailHealthAlertProps {
  alertType?: string
  severity?: string
  summary?: string
  detail?: string
  metadataLines?: string[]
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: '#dc2626',
  warning: '#d97706',
  info: '#1a365d',
}

const EmailHealthAlertEmail = ({
  alertType, severity, summary, detail, metadataLines,
}: EmailHealthAlertProps) => {
  const color = SEVERITY_COLOR[severity || 'warning'] || SEVERITY_COLOR.warning
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>Email queue alert: {alertType || 'health check'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoBadge}>C-iN</div>
          </Section>

          <Section style={{ ...banner, backgroundColor: color }}>
            <Heading style={bannerTitle}>Email Pipeline Alert</Heading>
            <Text style={bannerSub}>
              {(severity || 'warning').toUpperCase()} · {alertType || 'health_check'}
            </Text>
          </Section>

          <Text style={text}>{summary || 'An email pipeline health check fired.'}</Text>

          {detail ? (
            <Section style={detailBox}>
              <Text style={detailText}>{detail}</Text>
            </Section>
          ) : null}

          {metadataLines && metadataLines.length > 0 ? (
            <Section style={metaBox}>
              {metadataLines.map((line, i) => (
                <Text key={i} style={metaLine}>{line}</Text>
              ))}
            </Section>
          ) : null}

          <Text style={text}>
            Open the Admin → Emails dashboard to investigate, requeue failed
            messages, or adjust alert thresholds.
          </Text>

          <Hr style={divider} />
          <Text style={footerText}>
            {SITE_NAME} — Personal Emergency Response System
            <br />
            Future Wave Technologies Pvt. Ltd.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EmailHealthAlertEmail,
  subject: (data: Record<string, any>) =>
    `[${(data.severity || 'warning').toUpperCase()}] Email pipeline: ${data.alertType || 'health alert'}`,
  displayName: 'Email pipeline alert',
  previewData: {
    alertType: 'dlq_growth',
    severity: 'critical',
    summary: 'Dead-letter queue grew by 8 messages in the last 15 minutes.',
    detail: 'Recent failures suggest the email provider is rejecting sends. Investigate ASAP.',
    metadataLines: [
      'auth_emails_dlq depth: 4',
      'transactional_emails_dlq depth: 12',
      'Last successful send: 8 minutes ago',
    ],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const logoSection: React.CSSProperties = { textAlign: 'center' as const, marginBottom: '20px' }
const logoBadge: React.CSSProperties = {
  display: 'inline-block', width: '60px', height: '60px', borderRadius: '50%',
  backgroundColor: '#1a365d', color: '#ffffff', lineHeight: '60px',
  textAlign: 'center' as const, fontWeight: 'bold', fontSize: '14px',
}
const banner: React.CSSProperties = {
  textAlign: 'center' as const, padding: '16px', borderRadius: '12px', marginBottom: '20px',
}
const bannerTitle = { color: '#ffffff', margin: '0', fontSize: '20px' }
const bannerSub = { color: '#ffffff', margin: '6px 0 0', fontSize: '13px', opacity: 0.9 }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detailBox: React.CSSProperties = {
  backgroundColor: '#fef2f2', borderLeft: '4px solid #dc2626',
  padding: '14px', margin: '16px 0', borderRadius: '4px',
}
const detailText = { fontSize: '14px', color: '#991b1b', margin: '0' }
const metaBox: React.CSSProperties = {
  backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
  padding: '12px 14px', margin: '12px 0', borderRadius: '8px',
}
const metaLine = { fontSize: '13px', color: '#334155', margin: '2px 0', fontFamily: 'ui-monospace, Menlo, monospace' as const }
const divider = { borderColor: '#e5e5e5', margin: '24px 0 12px' }
const footerText = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, margin: '0' }
