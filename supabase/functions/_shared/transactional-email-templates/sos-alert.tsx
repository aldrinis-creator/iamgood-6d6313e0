/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface SosAlertProps {
  userName?: string
  message?: string
}

const SosAlertEmail = ({ userName, message }: SosAlertProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>🚨 EMERGENCY SOS from {userName || 'a Check-iN user'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <div style={logoBadge}>C-iN</div>
        </Section>

        <Section style={alertBanner}>
          <Heading style={alertTitle}>🚨 EMERGENCY SOS ALERT</Heading>
        </Section>

        <Text style={text}>
          {message || `Emergency SOS alert from ${userName || 'a Check-iN user'}. Please respond immediately.`}
        </Text>

        <Section style={urgentBox}>
          <Text style={urgentText}>
            ⚠️ This is an emergency alert. Please respond immediately.
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
  component: SosAlertEmail,
  subject: (data: Record<string, any>) =>
    `🚨 EMERGENCY SOS from ${data.userName || 'Check-iN User'}`,
  displayName: 'SOS alert',
  previewData: {
    userName: 'John',
    message: 'Emergency SOS alert from John.\n\nLocation: https://maps.google.com/?q=19.0760,72.8777\n\nPlease respond immediately.',
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
const alertBanner: React.CSSProperties = {
  textAlign: 'center' as const, padding: '16px', backgroundColor: '#dc2626',
  borderRadius: '8px', marginBottom: '16px',
}
const alertTitle = { color: '#ffffff', margin: '0', fontSize: '24px' }
const text = { fontSize: '15px', color: '#333333', lineHeight: '1.6', margin: '0 0 16px', whiteSpace: 'pre-line' as const }
const urgentBox: React.CSSProperties = {
  backgroundColor: '#fef2f2', borderLeft: '4px solid #dc2626',
  padding: '16px', margin: '20px 0', borderRadius: '4px',
}
const urgentText = { fontSize: '14px', color: '#dc2626', margin: '0', fontWeight: 'bold' as const }
const divider = { borderColor: '#e5e5e5', margin: '28px 0 16px' }
const footerText = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, margin: '0' }
