/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface AppointmentConfirmationProps {
  name?: string
  title?: string
  date?: string
  time?: string
  doctorName?: string
  location?: string
  appointmentType?: string
}

const AppointmentConfirmationEmail = ({
  name, title, date, time, doctorName, location, appointmentType,
}: AppointmentConfirmationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Appointment confirmed: {title || 'Your appointment'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <div style={logoBadge}>C-iN</div>
        </Section>

        <Heading style={h1}>Appointment Confirmed</Heading>

        <Text style={text}>
          {name ? `Hi ${name},` : 'Hi,'} your appointment has been successfully scheduled.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailLabel}>📋 Title</Text>
          <Text style={detailValue}>{title || 'Appointment'}</Text>

          <Text style={detailLabel}>📅 Date</Text>
          <Text style={detailValue}>{date || 'Not specified'}</Text>

          <Text style={detailLabel}>🕐 Time</Text>
          <Text style={detailValue}>{time || 'Not specified'}</Text>

          {doctorName && (
            <>
              <Text style={detailLabel}>👨‍⚕️ Doctor</Text>
              <Text style={detailValue}>{doctorName}</Text>
            </>
          )}

          {location && (
            <>
              <Text style={detailLabel}>📍 Location</Text>
              <Text style={detailValue}>{location}</Text>
            </>
          )}

          {appointmentType && (
            <>
              <Text style={detailLabel}>🏥 Type</Text>
              <Text style={detailValue}>{appointmentType === 'online' ? '💻 Online' : '🏥 In-Person'}</Text>
            </>
          )}
        </Section>

        <Text style={text}>
          You'll receive alarm reminders before your appointment as configured. You can manage your appointments anytime in the {SITE_NAME} app.
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
  component: AppointmentConfirmationEmail,
  subject: (data: Record<string, any>) => `Appointment confirmed: ${data.title || 'Your appointment'}`,
  displayName: 'Appointment confirmation',
  previewData: { name: 'Jane', title: 'Annual Checkup', date: '2025-01-15', time: '10:30', doctorName: 'Dr. Smith', location: 'City Hospital', appointmentType: 'in-person' },
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
  backgroundColor: '#f0f9ff',
  borderLeft: '4px solid #1a365d',
  padding: '16px',
  margin: '20px 0',
  borderRadius: '4px',
}
const detailLabel = { fontSize: '12px', color: '#1a365d', fontWeight: 'bold' as const, margin: '12px 0 2px', textTransform: 'uppercase' as const }
const detailValue = { fontSize: '15px', color: '#333333', margin: '0 0 4px' }
const divider = { borderColor: '#e5e5e5', margin: '28px 0 16px' }
const footerText = { fontSize: '12px', color: '#999999', textAlign: 'center' as const, margin: '0' }
