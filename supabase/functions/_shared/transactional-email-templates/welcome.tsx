/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface WelcomeProps {
  name?: string
}

const WelcomeEmail = ({ name }: WelcomeProps) => (
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
const featureBox: React.CSSProperties = {
  backgroundColor: '#f0f9ff',
  borderLeft: '4px solid #1a365d',
  padding: '16px',
  margin: '20px 0',
  borderRadius: '4px',
}
const featureTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 12px' }
const featureItem = { fontSize: '14px', color: '#555555', lineHeight: '1.6', margin: '0 0 6px' }
const divider = { borderColor: '#e5e5e5', margin: '28px 0 16px' }
const footerText = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, margin: '0' }
