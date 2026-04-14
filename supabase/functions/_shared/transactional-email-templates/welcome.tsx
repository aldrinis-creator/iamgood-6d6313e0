/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Button, Link,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface WelcomeProps {
  name?: string
  phone?: string
  primaryGuardian?: string
  setPasswordUrl?: string
}

const WelcomeEmail = ({ name, phone, primaryGuardian, setPasswordUrl }: WelcomeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — your personal emergency response system</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <div style={logoBadge}>C-iN</div>
        </Section>

        <Heading style={h1}>
          {name ? `Welcome, ${name}!` : `Welcome to ${SITE_NAME}!`}
        </Heading>

        <Text style={text}>
          Thank you for creating your {SITE_NAME} account. You now have access to a comprehensive personal emergency response system designed to keep you and your loved ones safe.
        </Text>

        {/* Account Details */}
        <Section style={detailsBox}>
          <Text style={detailsTitle}>Your Account Details</Text>
          <Text style={detailRow}><strong>User Name:</strong> {name || 'Not provided'}</Text>
          <Text style={detailRow}><strong>Phone Number:</strong> {phone || 'Not provided'}</Text>
          <Text style={detailRow}><strong>Primary Guardian:</strong> {primaryGuardian || 'None nominated yet'}</Text>
        </Section>

        {setPasswordUrl && (
          <Section style={buttonSection}>
            <Text style={text}>
              To secure your account, please set a password:
            </Text>
            <Button style={button} href={setPasswordUrl}>
              Set Your Password
            </Button>
          </Section>
        )}

        <Section style={featureBox}>
          <Text style={featureTitle}>Here's what you can do:</Text>
          <Text style={featureItem}>🆘 <strong>SOS Alerts</strong> — one-tap emergency alerts with live location</Text>
          <Text style={featureItem}>✅ <strong>Daily Check-Ins</strong> — let your guardians know you're safe</Text>
          <Text style={featureItem}>💊 <strong>Medication Tracking</strong> — never miss a dose with smart reminders</Text>
          <Text style={featureItem}>📋 <strong>Health Passport</strong> — your medical profile always at hand</Text>
          <Text style={featureItem}>🛡️ <strong>Guardian Network</strong> — connect trusted people to watch over you</Text>
        </Section>

        <Text style={text}>
          We recommend completing your health profile and adding at least one guardian to get the most out of {SITE_NAME}.
        </Text>

        <Hr style={divider} />

        {/* Check-iN Contact Details */}
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
  component: WelcomeEmail,
  subject: `Welcome to ${SITE_NAME}!`,
  displayName: 'Welcome email',
  previewData: { name: 'Jane', phone: '+91 98765 43210', primaryGuardian: 'Rahul Sharma (+91 91234 56789)', setPasswordUrl: 'https://iamgood.lovable.app/reset-password' },
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
const detailsBox: React.CSSProperties = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  padding: '16px',
  margin: '20px 0',
  borderRadius: '6px',
}
const detailsTitle = { fontSize: '15px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 12px' }
const detailRow = { fontSize: '14px', color: '#333333', lineHeight: '1.6', margin: '0 0 6px' }
const buttonSection: React.CSSProperties = { textAlign: 'center' as const, margin: '20px 0' }
const button: React.CSSProperties = {
  backgroundColor: '#2d5f3f',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'inline-block',
}
const featureBox: React.CSSProperties = {
  backgroundColor: '#f0f9ff',
  borderLeft: '4px solid #1a365d',
  padding: '16px',
  margin: '20px 0',
  borderRadius: '4px',
}
const featureTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 12px' }
const featureItem = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 6px' }
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
