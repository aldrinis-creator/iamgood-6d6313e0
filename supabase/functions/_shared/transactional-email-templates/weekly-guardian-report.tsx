/// <reference types="npm:@types/react@18.3.1" />
import * as React from "npm:react@18.3.1";
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr, Row, Column,
} from "npm:@react-email/components@0.0.22";

// ── Colour palette (matches the app dark-navy brand) ──────────────────────
const C = {
  bg:         "#0F1E35",
  card:       "#1C3050",
  cardBorder: "#243D60",
  green:      "#2ECC8A",
  greenDim:   "#1A5C40",
  amber:      "#F5A623",
  amberDim:   "#7A4F08",
  red:        "#E55353",
  redDim:     "#7A1F1F",
  blue:       "#4682DC",
  text1:      "#F0F4FF",
  text2:      "#9BAAC4",
  text3:      "#5E7499",
  white:      "#FFFFFF",
};

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  main:        { backgroundColor: "#06101E", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" },
  container:   { maxWidth: "560px", margin: "0 auto", padding: "24px 16px 40px" },
  logoBadge:   { display: "inline-block", background: C.card, border: `1.5px solid rgba(46,204,138,0.3)`, borderRadius: "14px", padding: "10px 16px", marginBottom: "20px" },
  logoText:    { color: C.green, fontSize: "20px", fontWeight: "700", letterSpacing: "-0.02em", margin: 0 },
  logoSub:     { color: C.text3, fontSize: "11px", margin: "2px 0 0" },
  heading:     { color: C.text1, fontSize: "24px", fontWeight: "700", margin: "0 0 6px", letterSpacing: "-0.02em" },
  subheading:  { color: C.text2, fontSize: "14px", margin: "0 0 24px", lineHeight: "1.5" },
  card:        { background: C.card, border: `1px solid ${C.cardBorder}`, borderRadius: "16px", padding: "18px 20px", marginBottom: "12px" },
  cardTitle:   { color: C.text2, fontSize: "10px", fontWeight: "600", letterSpacing: "0.08em", textTransform: "uppercase" as const, margin: "0 0 14px" },
  statNum:     { fontSize: "28px", fontWeight: "700", lineHeight: "1", margin: "0 0 3px" },
  statLabel:   { color: C.text2, fontSize: "11px", margin: 0 },
  bodyText:    { color: C.text2, fontSize: "14px", lineHeight: "1.6", margin: "0 0 8px" },
  pill:        (color: string) => ({
    display: "inline-block", background: `${color}18`, color, border: `1px solid ${color}30`,
    borderRadius: "99px", fontSize: "10px", fontWeight: "600", padding: "3px 10px",
    letterSpacing: "0.04em", textTransform: "uppercase" as const,
  }),
  missedRow:   { color: C.text2, fontSize: "13px", margin: "4px 0", paddingLeft: "12px", borderLeft: `2px solid ${C.amber}` },
  footer:      { color: C.text3, fontSize: "11px", textAlign: "center" as const, marginTop: "28px", lineHeight: "1.6" },
  hr:          { border: "none", borderTop: `1px solid ${C.cardBorder}`, margin: "16px 0" },
  barTrack:    { background: "#162744", borderRadius: "3px", height: "6px", width: "100%", marginTop: "5px", overflow: "hidden" },
  progressBar: (pct: number, color: string) => ({
    width: `${Math.min(pct, 100)}%`, height: "6px", background: color, borderRadius: "3px",
  }),
};

// ── Stat cell ──────────────────────────────────────────────────────────────
const StatCell = ({ n, label, color }: { n: string | number; label: string; color: string }) => (
  <Column style={{ textAlign: "center" as const, padding: "0 8px" }}>
    <Text style={{ ...s.statNum, color }}>{n}</Text>
    <Text style={s.statLabel}>{label}</Text>
  </Column>
);

// ── Score badge ────────────────────────────────────────────────────────────
const scoreBadge = (score: number) => {
  if (score >= 80) return { color: C.green, label: "Excellent" };
  if (score >= 60) return { color: C.amber, label: "Fair" };
  return { color: C.red, label: "Needs attention" };
};

// ── Props ──────────────────────────────────────────────────────────────────
export interface WeeklyReportEmailProps {
  guardianName: string;
  wardName: string;
  weekLabel: string;
  relation: string;
  adherencePct: number;
  medAdherencePct: number;
  healthScore: number;
  totalCheckIns: number;
  respondedCheckIns: number;
  missedCheckIns: number;
  totalMeds: number;
  takenMeds: number;
  missedMeds: number;
  lateMeds: number;
  totalSOS: number;
  avgHR: number | null;
  avgSpO2: number | null;
  missedCheckInDetails: string[];
}

// ═══════════════════════════════════════════════════════════════════════════
export const WeeklyReportEmail = ({
  guardianName = "Guardian",
  wardName = "Your ward",
  weekLabel = "This week",
  relation = "Ward",
  adherencePct = 0,
  medAdherencePct = 0,
  healthScore = 0,
  totalCheckIns = 0,
  respondedCheckIns = 0,
  missedCheckIns = 0,
  totalMeds = 0,
  takenMeds = 0,
  missedMeds = 0,
  lateMeds = 0,
  totalSOS = 0,
  avgHR = null,
  avgSpO2 = null,
  missedCheckInDetails = [],
}: WeeklyReportEmailProps) => {
  const badge = scoreBadge(healthScore);

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        📊 {wardName}'s weekly report — {badge.label} ({healthScore}/100) · {weekLabel}
      </Preview>
      <Body style={s.main}>
        <Container style={s.container}>

          {/* ── Logo ── */}
          <Section style={{ textAlign: "center" as const, marginBottom: "24px" }}>
            <div style={s.logoBadge}>
              <Text style={s.logoText}>Check-iN</Text>
              <Text style={s.logoSub}>Personal Safety Network</Text>
            </div>
          </Section>

          {/* ── Header ── */}
          <Section>
            <Heading style={s.heading}>Weekly Report Card</Heading>
            <Text style={s.subheading}>
              Hi {guardianName}, here's how <strong style={{ color: C.text1 }}>{wardName}</strong> ({relation}) did last week · {weekLabel}
            </Text>
          </Section>

          {/* ── Health score banner ── */}
          <Section style={{ ...s.card, border: `1.5px solid ${badge.color}30`, background: `${badge.color}08`, textAlign: "center" as const, padding: "20px" }}>
            <Text style={{ color: C.text2, fontSize: "11px", fontWeight: "600", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 8px" }}>
              Overall Health Score
            </Text>
            <Text style={{ fontSize: "52px", fontWeight: "800", color: badge.color, margin: "0 0 4px", lineHeight: "1" }}>
              {healthScore}<span style={{ fontSize: "20px", color: C.text3 }}>/100</span>
            </Text>
            <span style={s.pill(badge.color)}>{badge.label}</span>
          </Section>

          {/* ── Check-in stats ── */}
          <Section style={s.card}>
            <Text style={s.cardTitle}>🕐 Check-In Adherence</Text>
            <Row>
              <StatCell n={`${respondedCheckIns}/${totalCheckIns}`} label="Completed" color={C.green} />
              <StatCell n={missedCheckIns} label="Missed" color={missedCheckIns > 0 ? C.amber : C.text3} />
              <StatCell n={`${adherencePct}%`} label="Rate" color={adherencePct >= 80 ? C.green : adherencePct >= 60 ? C.amber : C.red} />
            </Row>
            <div style={s.barTrack}>
              <div style={s.progressBar(adherencePct, adherencePct >= 80 ? C.green : C.amber)} />
            </div>
            {missedCheckInDetails.length > 0 && (
              <>
                <Hr style={{ ...s.hr, margin: "14px 0 10px" }} />
                <Text style={{ ...s.cardTitle, margin: "0 0 8px" }}>Missed times</Text>
                {missedCheckInDetails.map((detail, i) => (
                  <Text key={i} style={s.missedRow}>• {detail}</Text>
                ))}
              </>
            )}
          </Section>

          {/* ── Medication stats ── */}
          <Section style={s.card}>
            <Text style={s.cardTitle}>💊 Medication Adherence</Text>
            <Row>
              <StatCell n={`${takenMeds}/${totalMeds}`} label="Taken" color={C.blue} />
              <StatCell n={lateMeds} label="Late" color={lateMeds > 0 ? C.amber : C.text3} />
              <StatCell n={missedMeds} label="Missed" color={missedMeds > 0 ? C.red : C.text3} />
              <StatCell n={`${medAdherencePct}%`} label="Rate" color={medAdherencePct >= 80 ? C.green : medAdherencePct >= 60 ? C.amber : C.red} />
            </Row>
            <div style={s.barTrack}>
              <div style={s.progressBar(medAdherencePct, medAdherencePct >= 80 ? C.green : C.amber)} />
            </div>
          </Section>

          {/* ── Vitals & SOS ── */}
          <Section style={s.card}>
            <Text style={s.cardTitle}>❤️ Vitals & Safety</Text>
            <Row>
              {avgHR ? <StatCell n={`${avgHR} bpm`} label="Avg heart rate" color={C.green} /> : null}
              {avgSpO2 ? <StatCell n={`${avgSpO2}%`} label="Avg SpO₂" color={C.blue} /> : null}
              <StatCell
                n={totalSOS}
                label="SOS events"
                color={totalSOS > 0 ? C.red : C.text3}
              />
            </Row>
            {totalSOS > 0 && (
              <Text style={{ ...s.bodyText, color: C.red, marginTop: "10px", fontSize: "13px" }}>
                ⚠️ {wardName} triggered {totalSOS} SOS alert{totalSOS > 1 ? "s" : ""} this week. Please review the app for details.
              </Text>
            )}
          </Section>

          {/* ── Summary note ── */}
          <Section style={{ ...s.card, background: "rgba(46,204,138,0.04)", border: `1px solid rgba(46,204,138,0.15)` }}>
            <Text style={s.bodyText}>
              {healthScore >= 80
                ? `✅ Great week! ${wardName} is checking in regularly and taking medications on time. Keep up the good work.`
                : healthScore >= 60
                ? `⚠️ ${wardName} had a reasonable week but missed a few check-ins or medications. Consider reaching out to check in.`
                : `🚨 ${wardName} had a difficult week with multiple missed check-ins or medications. We recommend calling them or reviewing the app for more details.`}
            </Text>
            <Text style={{ ...s.bodyText, margin: 0 }}>
              Open the Check-iN Guardian app to see live status, location history, and full medication logs.
            </Text>
          </Section>

          <Hr style={s.hr} />

          {/* ── Footer ── */}
          <Text style={s.footer}>
            Check-iN · Personal Emergency Response System<br />
            Future Wave Technologies Pvt. Ltd. · Mumbai, India<br />
            <span style={{ color: C.text3 }}>
              You are receiving this as a nominated Guardian of {wardName}.
              To unsubscribe, update notification settings in the Check-iN app.
            </span>
          </Text>

        </Container>
      </Body>
    </Html>
  );
};

export const template = {
  component: WeeklyReportEmail,
  subject: (data: Record<string, any>) =>
    `📊 ${data.wardName || "Your ward"}'s Weekly Check-iN Report — ${data.weekLabel || ""}`,
  displayName: "Weekly Guardian Report",
  previewData: {
    guardianName: "Rahul Alphonso",
    wardName: "Aldrin Alphonso",
    weekLabel: "23 Jun – 29 Jun",
    relation: "Son",
    adherencePct: 86,
    medAdherencePct: 75,
    healthScore: 82,
    totalCheckIns: 21,
    respondedCheckIns: 18,
    missedCheckIns: 3,
    totalMeds: 14,
    takenMeds: 10,
    missedMeds: 2,
    lateMeds: 2,
    totalSOS: 0,
    avgHR: 74,
    avgSpO2: 97,
    missedCheckInDetails: ["Mon, 23 Jun, 07:00 AM", "Wed, 25 Jun, 07:00 PM", "Thu, 26 Jun, 12:00 PM"],
  },
};
