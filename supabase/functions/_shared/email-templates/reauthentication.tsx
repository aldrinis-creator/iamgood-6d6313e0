/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Check-iN verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={logoSection}>
          <table cellPadding="0" cellSpacing="0" style={{ margin: '0 auto' }}>
            <tr>
              <td style={logoBadge}>C-iN</td>
            </tr>
          </table>
        </Section>
        <Heading style={h1}>Verification Code</Heading>
        <Text style={text}>
          Use the code below to confirm your identity on Check-iN:
        </Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footerText}>
          This code will expire shortly. If you didn't request this, you can
          safely ignore this email.
        </Text>
        <Hr style={divider} />
        <Text style={companyFooter}>
          Check-iN — Personal Emergency Response System{'\n'}
          Future Wave Technologies Pvt. Ltd.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '30px 25px', maxWidth: '600px', margin: '0 auto' }
const logoSection = { textAlign: 'center' as const, marginBottom: '24px' }
const logoBadge = {
  width: '56px', height: '56px', borderRadius: '50%',
  backgroundColor: '#1a365d', color: '#ffffff',
  fontWeight: 'bold' as const, fontSize: '14px',
  textAlign: 'center' as const, verticalAlign: 'middle' as const, lineHeight: '56px',
}
const h1 = {
  fontSize: '22px', fontWeight: 'bold' as const, color: '#1a365d',
  margin: '0 0 16px', textAlign: 'center' as const,
}
const text = { fontSize: '15px', color: '#6b7280', lineHeight: '1.6', margin: '0 0 16px' }
const codeStyle = {
  fontFamily: 'Courier, monospace', fontSize: '28px',
  fontWeight: 'bold' as const, color: '#1a365d',
  margin: '0 0 24px', textAlign: 'center' as const,
  letterSpacing: '4px',
}
const footerText = { fontSize: '13px', color: '#9ca3af', margin: '24px 0 0' }
const divider = { borderTop: '1px solid #e5e7eb', margin: '24px 0' }
const companyFooter = {
  fontSize: '11px', color: '#9ca3af', textAlign: 'center' as const, lineHeight: '1.5',
}
