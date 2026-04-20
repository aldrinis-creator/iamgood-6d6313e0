/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  code: string
  expiresInMinutes?: number
}

const NAVY = '#1a365d'
const BG = '#f4f6fa'

export const AdminTwoFactorCodeEmail: React.ComponentType<Props> = ({ code, expiresInMinutes = 5 }) => (
  <Html>
    <Head />
    <Preview>Your Check-iN admin verification code</Preview>
    <Body style={{ backgroundColor: BG, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', margin: 0, padding: '24px 0' }}>
      <Container style={{ maxWidth: 560, margin: '0 auto', backgroundColor: '#ffffff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e9f0' }}>
        <Section style={{ backgroundColor: NAVY, padding: '24px 32px' }}>
          <Heading style={{ color: '#ffffff', margin: 0, fontSize: 22, fontWeight: 600 }}>Check-iN — Admin Verification</Heading>
        </Section>
        <Section style={{ padding: '32px' }}>
          <Text style={{ fontSize: 15, color: '#1f2937', margin: '0 0 16px 0' }}>
            A sign-in to the Check-iN admin panel requires verification. Use the code below to continue.
          </Text>
          <Section style={{ backgroundColor: '#f8fafc', border: `2px solid ${NAVY}`, borderRadius: 8, padding: '20px', textAlign: 'center' as const, margin: '20px 0' }}>
            <Text style={{ fontFamily: 'monospace', fontSize: 38, fontWeight: 700, letterSpacing: '8px', color: NAVY, margin: 0 }}>{code}</Text>
          </Section>
          <Text style={{ fontSize: 14, color: '#6b7280', margin: '0 0 8px 0' }}>
            This code expires in <strong>{expiresInMinutes} minutes</strong>.
          </Text>
          <Text style={{ fontSize: 13, color: '#b91c1c', margin: '24px 0 0 0', padding: '12px', backgroundColor: '#fef2f2', borderRadius: 6, borderLeft: '3px solid #b91c1c' }}>
            <strong>Didn't request this?</strong> Someone may be trying to access the admin panel. Contact support immediately and rotate your password.
          </Text>
        </Section>
        <Section style={{ padding: '16px 32px', backgroundColor: '#f8fafc', borderTop: '1px solid #e5e9f0' }}>
          <Text style={{ fontSize: 12, color: '#94a3b8', margin: 0, textAlign: 'center' as const }}>
            Check-iN — Care for those who matter most
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export const template: TemplateEntry = {
  component: AdminTwoFactorCodeEmail,
  subject: 'Your Check-iN admin verification code',
  displayName: 'Admin 2FA Code',
  previewData: { code: '482917', expiresInMinutes: 5 },
}
