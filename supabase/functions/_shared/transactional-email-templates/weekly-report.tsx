/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Row, Column
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Check-iN'

interface WeeklyReportProps {
  userName?: string
  recipientName?: string
  startDate?: string
  endDate?: string
  checkInStats?: {
    total: number
    responded: number
    missed: number
    rate: number
  }
  medicationStats?: {
    total: number
    taken: number
    missed: number
    rate: number
  }
  wellnessStats?: {
    avgSleep: number
    avgStress: number
    avgEnergy: number
    topMood: string
  }
  activityStats?: {
    totalSteps: number
    totalExerciseMin: number
  }
}

const WeeklyReportEmail = ({
  userName,
  recipientName,
  startDate,
  endDate,
  checkInStats = { total: 0, responded: 0, missed: 0, rate: 0 },
  medicationStats = { total: 0, taken: 0, missed: 0, rate: 0 },
  wellnessStats = { avgSleep: 0, avgStress: 3, avgEnergy: 3, topMood: 'N/A' },
  activityStats = { totalSteps: 0, totalExerciseMin: 0 }
}: WeeklyReportProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>📊 Weekly Health & Safety Report for {userName || 'your ward'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <div style={logoBadge}>C-iN</div>
        </Section>

        <Section style={headerSection}>
          <Heading style={title}>Weekly Summary Report</Heading>
          <Text style={subtitle}>
            For {userName || 'Your ward'} ({startDate || ''} – {endDate || ''})
          </Text>
        </Section>

        <Text style={text}>Hi {recipientName || 'there'},</Text>
        <Text style={text}>
          Here is the consolidated weekly health and safety summary for {userName || 'your ward'}.
        </Text>

        {/* Section 1: Check-iN Status */}
        <Section style={card}>
          <Heading style={cardTitle}>🔔 Check-iN Compliance</Heading>
          <Hr style={innerDivider} />
          <Row style={statsRow}>
            <Column style={statCol}>
              <Text style={statVal}>{checkInStats.rate}%</Text>
              <Text style={statLabel}>Compliance</Text>
            </Column>
            <Column style={statDetailCol}>
              <Text style={detailText}>• Completed Check-iNs: <strong>{checkInStats.responded}</strong></Text>
              <Text style={detailText}>• Missed Check-iNs: <strong>{checkInStats.missed}</strong></Text>
              <Text style={detailText}>• Total Scheduled: <strong>{checkInStats.total}</strong></Text>
            </Column>
          </Row>
        </Section>

        {/* Section 2: Medication Status */}
        <Section style={card}>
          <Heading style={cardTitle}>💊 Medication Compliance</Heading>
          <Hr style={innerDivider} />
          <Row style={statsRow}>
            <Column style={statCol}>
              <Text style={statVal}>{medicationStats.rate}%</Text>
              <Text style={statLabel}>Compliance</Text>
            </Column>
            <Column style={statDetailCol}>
              <Text style={detailText}>• Taken: <strong>{medicationStats.taken}</strong></Text>
              <Text style={detailText}>• Missed: <strong>{medicationStats.missed}</strong></Text>
              <Text style={detailText}>• Total Scheduled: <strong>{medicationStats.total}</strong></Text>
            </Column>
          </Row>
        </Section>

        {/* Section 3: Wellness logs */}
        <Section style={card}>
          <Heading style={cardTitle}>🧘 Wellness & Mood</Heading>
          <Hr style={innerDivider} />
          <Row style={statsRow}>
            <Column style={statCol}>
              <Text style={statVal}>{wellnessStats.avgSleep}h</Text>
              <Text style={statLabel}>Avg Daily Sleep</Text>
            </Column>
            <Column style={statDetailCol}>
              <Text style={detailText}>• Dominant Mood: <strong>{wellnessStats.topMood}</strong></Text>
              <Text style={detailText}>• Avg Energy Level: <strong>{wellnessStats.avgEnergy}/5</strong></Text>
              <Text style={detailText}>• Avg Stress Level: <strong>{wellnessStats.avgStress}/5</strong></Text>
            </Column>
          </Row>
        </Section>

        {/* Section 4: Physical Activity */}
        <Section style={card}>
          <Heading style={cardTitle}>🏃 Activity & Steps</Heading>
          <Hr style={innerDivider} />
          <Row style={statsRow}>
            <Column style={statCol}>
              <Text style={statVal}>{(activityStats.totalSteps / 1000).toFixed(1)}k</Text>
              <Text style={statLabel}>Total Steps</Text>
            </Column>
            <Column style={statDetailCol}>
              <Text style={detailText}>• Total Exercise: <strong>{activityStats.totalExerciseMin} minutes</strong></Text>
              <Text style={detailText}>• Avg Daily Steps: <strong>{Math.round(activityStats.totalSteps / 7)} steps</strong></Text>
            </Column>
          </Row>
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
  component: WeeklyReportEmail,
  subject: (data: Record<string, any>) =>
    `📊 Weekly Health Summary for ${data.userName || 'your ward'} (${data.startDate || ''} – ${data.endDate || ''})`,
  displayName: 'Weekly health report',
  previewData: {
    userName: 'John',
    recipientName: 'Jane',
    startDate: '1 June 2026',
    endDate: '7 June 2026',
    checkInStats: { total: 21, responded: 19, missed: 2, rate: 90 },
    medicationStats: { total: 14, taken: 12, missed: 2, rate: 85 },
    wellnessStats: { avgSleep: 7.2, avgStress: 2, avgEnergy: 4, topMood: 'happy' },
    activityStats: { totalSteps: 35000, totalExerciseMin: 120 }
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#f9fafb', fontFamily: 'Arial, sans-serif' }
const container = { padding: '30px 20px', maxWidth: '600px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e5e7eb' }
const logoSection: React.CSSProperties = { textAlign: 'center' as const, marginBottom: '20px' }
const logoBadge: React.CSSProperties = {
  display: 'inline-block', width: '50px', height: '50px', borderRadius: '50%',
  backgroundColor: '#2d5f3f', color: '#ffffff', lineHeight: '50px',
  textAlign: 'center' as const, fontWeight: 'bold', fontSize: '14px',
}
const headerSection: React.CSSProperties = { textAlign: 'center' as const, marginBottom: '30px' }
const title = { color: '#111827', margin: '0', fontSize: '24px', fontWeight: 'bold' as const }
const subtitle = { color: '#6b7280', margin: '5px 0 0', fontSize: '14px' }
const text = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const card = {
  backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px',
  padding: '16px', marginBottom: '20px',
}
const cardTitle = { fontSize: '16px', color: '#1f2937', margin: '0 0 8px', fontWeight: 'bold' as const }
const innerDivider = { borderColor: '#f3f4f6', margin: '8px 0 12px' }
const statsRow = { display: 'flex' as const, alignItems: 'center' as const }
const statCol = { width: '120px', textAlign: 'center' as const, paddingRight: '16px', borderRight: '1px solid #e5e7eb' }
const statVal = { fontSize: '28px', color: '#10b981', fontWeight: 'bold' as const, margin: '0' }
const statLabel = { fontSize: '11px', color: '#6b7280', margin: '4px 0 0', textTransform: 'uppercase' as const }
const statDetailCol = { paddingLeft: '20px' }
const detailText = { fontSize: '14px', color: '#4b5563', margin: '0 0 6px', lineHeight: '1.4' }
const divider = { borderColor: '#e5e7eb', margin: '30px 0 16px' }
const footerText = { fontSize: '12px', color: '#9ca3af', textAlign: 'center' as const, margin: '0' }
