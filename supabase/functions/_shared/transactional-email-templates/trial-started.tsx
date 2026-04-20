/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface TrialProps {
  name?: string
  expiresAt?: string
}

const formatIST = (iso?: string) => {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    }) + ' IST'
  } catch { return iso }
}

const TrialStartedEmail = ({ name, expiresAt }: TrialProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your 7-day {SITE_NAME} Premium trial has started</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <div style={logoBadge}>C-iN</div>
        </Section>

        <Heading style={h1}>
          {name ? `Your trial is live, ${name}!` : 'Your free trial is live!'}
        </Heading>

        <Text style={text}>
          You've unlocked <strong>{SITE_NAME} Premium</strong> for the next 7 days. All Pro features are
          now active on your account — no payment required.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailsTitle}>Trial details</Text>
          <Text style={detailRow}><strong>Plan:</strong> Premium (Pro)</Text>
          <Text style={detailRow}><strong>Duration:</strong> 7 days</Text>
          <Text style={detailRow}><strong>Ends on:</strong> {formatIST(expiresAt)}</Text>
        </Section>

        <Section style={featureBox}>
          <Text style={featureTitle}>What's unlocked:</Text>
          <Text style={featureItem}>💊 <strong>Medication Manager</strong> with smart reminders</Text>
          <Text style={featureItem}>✅ <strong>3 Daily Check-iNs</strong></Text>
          <Text style={featureItem}>📊 <strong>Advanced Vitals</strong> &amp; Activity Tracking</Text>
          <Text style={featureItem}>🌬️ <strong>AQI Suite</strong> for air-quality alerts</Text>
          <Text style={featureItem}>🤖 <strong>AI Health Tools</strong> — symptom checker &amp; more</Text>
        </Section>

        <Section style={buttonSection}>
          <Button style={button} href="https://iamgood.lovable.app/dashboard">
            Open Dashboard
          </Button>
        </Section>

        <Text style={text}>
          Want to keep Pro after the trial?{' '}
          <Link href="https://iamgood.lovable.app/subscription" style={contactLink}>
            Upgrade any time
          </Link>{' '}
          to lock in your access — your data stays the same.
        </Text>

        <Hr style={divider} />

        <Section style={contactBox}>
          <Text style={contactTitle}>{SITE_NAME} Contact Details</Text>
          <Text style={contactRow}>
            📧 Email: <Link href="mailto:checkin_support@futurewave.in" style={contactLink}>checkin_support@futurewave.in</Link>
          </Text>
          <Text style={contactRow}>
            📞 Contact Center: <Link href="tel:+917045868482" style={contactLink}>+91 7045868482</Link>
          </Text>
        </Section>

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

export const template = {
  component: TrialStartedEmail,
  subject: `Your 7-day ${SITE_NAME} Premium trial has started`,
  displayName: 'Trial started',
  previewData: {
    name: 'Jane',
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const logoSection: React.CSSProperties = { textAlign: 'center' as const, marginBottom: '24px' }
const logoBadge: React.CSSProperties = {
  display: 'inline-block', width: '60px', height: '60px', borderRadius: '50%',
  backgroundColor: '#2d5f3f', color: '#ffffff', lineHeight: '60px',
  textAlign: 'center' as const, fontWeight: 'bold', fontSize: '14px',
}
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 20px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox: React.CSSProperties = {
  backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
  padding: '16px', margin: '20px 0', borderRadius: '6px',
}
const detailsTitle = { fontSize: '15px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 12px' }
const detailRow = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 6px' }
const buttonSection: React.CSSProperties = { textAlign: 'center' as const, margin: '20px 0' }
const button: React.CSSProperties = {
  backgroundColor: '#2d5f3f', color: '#ffffff', padding: '12px 28px', borderRadius: '6px',
  fontSize: '15px', fontWeight: 'bold', textDecoration: 'none', display: 'inline-block',
}
const featureBox: React.CSSProperties = {
  backgroundColor: '#f0f9ff', borderLeft: '4px solid #1a365d',
  padding: '16px', margin: '20px 0', borderRadius: '4px',
}
const featureTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 12px' }
const featureItem = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 6px' }
const contactBox: React.CSSProperties = {
  backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
  padding: '16px', margin: '16px 0', borderRadius: '6px',
}
const contactTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 10px' }
const contactRow = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 4px' }
const contactLink = { color: '#2d5f3f', textDecoration: 'underline' }
const divider = { borderColor: '#e5e5e5', margin: '28px 0 16px' }
const footerText = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, margin: '0' }
