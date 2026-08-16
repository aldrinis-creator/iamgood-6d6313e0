/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface GuardianInvitationProps {
  guardianName?: string
  userName?: string
  relation?: string
  acceptLink?: string
  rejectLink?: string
  installLink?: string
  reminderNumber?: number
}

const GuardianInvitationEmail = ({
  guardianName, userName, relation, acceptLink, rejectLink, installLink, reminderNumber,
}: GuardianInvitationProps) => {
  const relationText = relation ? ` (${relation})` : ''
  const defaultAcceptLink = 'https://iamgood.lovable.app/register'
  const install = installLink || 'https://iamgood.lovable.app/install'
  const isReminder = !!reminderNumber && reminderNumber > 0

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{userName || 'Someone'} has nominated you as their Guardian on {SITE_NAME}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={logoSection}>
            <div style={logoBadge}>C-iN</div>
          </Section>

          <Heading style={h1}>
            {isReminder ? 'Reminder: Your Guardian Nomination' : "You've Been Nominated as a Guardian"}
          </Heading>

          <Text style={text}>
            Hi {guardianName || 'there'},
          </Text>

          {isReminder && (
            <Text style={text}>
              This is reminder {reminderNumber} of 3 — your nomination is still waiting for a response.
            </Text>
          )}

          <Text style={text}>
            <strong>{userName || 'A user'}</strong>{relationText} has nominated you as their <strong>Guardian</strong> on <strong>{SITE_NAME}</strong> — a personal emergency response app.
          </Text>


          <Section style={infoBox}>
            <Text style={infoTitle}>What does this mean?</Text>
            <Text style={infoText}>
              As a Guardian, you'll receive real-time alerts about {userName || 'their'} safety including:
            </Text>
            <Text style={bulletItem}>🆘 SOS emergency alerts with location</Text>
            <Text style={bulletItem}>✅ Daily check-in status updates</Text>
            <Text style={bulletItem}>💊 Medication adherence notifications</Text>
            <Text style={bulletItem}>📋 Health passport and vitals reports</Text>
            <Text style={bulletItem}>🚨 Fall detection alerts</Text>
          </Section>

          <Section style={infoBox}>
            <Text style={infoTitle}>📱 Install the Check-iN app</Text>
            <Text style={infoText}>
              After accepting, install Check-iN on your phone so you receive SOS alerts and check-in updates instantly — even when the app is closed.
            </Text>
            <Text style={bulletItem}><strong>iPhone:</strong> Open the link in Safari → Share → Add to Home Screen</Text>
            <Text style={bulletItem}><strong>Android:</strong> Open the link in Chrome → tap "Install app" when prompted</Text>
          </Section>

          <Section style={warningBox}>
            <Text style={warningTitle}>⏰ 24-Hour Window</Text>
            <Text style={warningText}>
              You have <strong>24 hours</strong> to reject this nomination. If you do not reject within 24 hours, the nomination is <strong>automatically accepted</strong>.
            </Text>
          </Section>

          <Section style={buttonSection}>
            <Button href={acceptLink || defaultAcceptLink} style={acceptButton}>
              ✅ Accept & Create Account
            </Button>
          </Section>

          {rejectLink && (
            <Section style={buttonSection}>
              <Button href={rejectLink} style={rejectButton}>
                ❌ Reject Nomination
              </Button>
            </Section>
          )}

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
  component: GuardianInvitationEmail,
  subject: (data: Record<string, any>) => `${data.userName || 'Someone'} has nominated you as their Guardian on ${SITE_NAME}`,
  displayName: 'Guardian invitation',
  previewData: {
    guardianName: 'Jane',
    userName: 'John',
    relation: 'Son',
    acceptLink: 'https://iamgood.lovable.app/register?nomination=accept&token=abc123',
    rejectLink: 'https://iamgood.lovable.app/register?nomination=reject&token=abc123',
  },
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
const infoBox: React.CSSProperties = {
  backgroundColor: '#f0f9ff',
  borderLeft: '4px solid #1a365d',
  padding: '16px',
  margin: '20px 0',
  borderRadius: '4px',
}
const infoTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#1a365d', margin: '0 0 8px' }
const infoText = { fontSize: '14px', color: '#555555', margin: '0 0 8px' }
const bulletItem = { fontSize: '14px', color: '#555555', margin: '0 0 4px' }
const warningBox: React.CSSProperties = {
  backgroundColor: '#fff3cd',
  borderLeft: '4px solid #ffc107',
  padding: '16px',
  margin: '20px 0',
  borderRadius: '4px',
}
const warningTitle = { fontSize: '14px', fontWeight: 'bold' as const, color: '#856404', margin: '0 0 8px' }
const warningText = { fontSize: '14px', color: '#856404', margin: '0' }
const buttonSection: React.CSSProperties = { textAlign: 'center' as const, margin: '16px 0' }
const acceptButton: React.CSSProperties = {
  backgroundColor: '#1a365d',
  color: '#ffffff',
  padding: '14px 28px',
  borderRadius: '12px',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
}
const rejectButton: React.CSSProperties = {
  backgroundColor: '#dc3545',
  color: '#ffffff',
  padding: '10px 20px',
  borderRadius: '12px',
  fontSize: '14px',
  textDecoration: 'none',
}
const divider = { borderColor: '#e5e5e5', margin: '28px 0 16px' }
const footerText = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, margin: '0' }
