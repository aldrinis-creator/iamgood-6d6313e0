/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface WaitlistProps {
  name?: string
}

const PremiumPlusWaitlistEmail = ({ name }: WaitlistProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're on the {SITE_NAME} Premium Plus Smart Ring waitlist</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <div style={logoBadge}>C-iN</div>
        </Section>

        <Heading style={h1}>
          {name ? `You're on the list, ${name}!` : `You're on the list!`}
        </Heading>

        <Text style={text}>
          Thank you for pre-registering for the {SITE_NAME} <strong>Premium Plus</strong> bundle with the upcoming Smart Ring.
        </Text>

        <Section style={highlightBox}>
          <Text style={highlightTitle}>What you'll get at launch</Text>
          <Text style={featureItem}>💍 <strong>Smart Ring</strong> — continuous ECG, HR, SpO₂, BP & sleep tracking</Text>
          <Text style={featureItem}>📡 <strong>24×7 mobile / satellite tracking*</strong></Text>
          <Text style={featureItem}>⭐ <strong>Special early-bird price</strong> of ₹9,999/year (save ₹5,000)</Text>
        </Section>

        <Text style={text}>
          We'll email you the moment the Smart Ring is ready to ship and your pre-order link is live. No payment is required today — your spot is reserved.
        </Text>

        <Text style={smallNote}>
          * Data charges as applicable after Year 1.
        </Text>

        <Hr style={divider} />

        <Section style={contactBox}>
          <Text style={contactTitle}>Questions?</Text>
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
  component: PremiumPlusWaitlistEmail,
  subject: `You're on the ${SITE_NAME} Premium Plus waitlist`,
  displayName: 'Premium Plus waitlist confirmation',
  previewData: { name: 'Jane' },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '600px', margin: '0 auto' }
const logoSection: React.CSSProperties = { textAlign: 'center' as const, marginBottom: '24px' }
const logoBadge: React.CSSProperties = {
  display: 'inline-block',
  width: '60px',
  height: '60px',
  borderRadius: '50%',
  backgroundColor: '#2d5f3f',
  color: '#ffffff',
  lineHeight: '60px',
  textAlign: 'center' as const,
  fontWeight: 'bold',
  fontSize: '14px',
}
const h1 = { fontSize: '24px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 20px', textAlign: 'center' as const }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px' }
const highlightBox: React.CSSProperties = {
  backgroundColor: '#f0f9ff',
  borderLeft: '4px solid #1a365d',
  padding: '16px',
  margin: '20px 0',
  borderRadius: '4px',
}
const highlightTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 12px' }
const featureItem = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 6px' }
const smallNote = { fontSize: '12px', color: '#777777', lineHeight: '1.5', margin: '0 0 16px', fontStyle: 'italic' as const }
const contactBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  padding: '16px',
  margin: '16px 0',
  borderRadius: '6px',
}
const contactTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 10px' }
const contactRow = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 4px' }
const contactLink = { color: '#2d5f3f', textDecoration: 'underline' }
const divider = { borderColor: '#e5e5e5', margin: '28px 0 16px' }
const footerText = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, margin: '0' }
