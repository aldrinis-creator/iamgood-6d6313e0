/// <reference types="npm:@types/react@18.3.1" />
import * as React from "npm:react@18.3.1";
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
  Section,
  Hr,
  Row,
  Column,
} from "npm:@react-email/components@0.0.22";
import type { TemplateEntry } from "./registry.ts";

const SITE_NAME = "Check-iN";

export interface WeeklyGuardianReportProps {
  guardianName?: string;
  wardName?: string;
  weekLabel?: string;
  relation?: string;
  healthScore?: number;
  adherencePct?: number;
  medAdherencePct?: number;
  totalCheckIns?: number;
  respondedCheckIns?: number;
  missedCheckIns?: number;
  totalMeds?: number;
  takenMeds?: number;
  missedMeds?: number;
  lateMeds?: number;
  totalSOS?: number;
  avgHR?: number | null;
  avgSpO2?: number | null;
  missedCheckInDetails?: string[];
}

// ── Score helpers ──────────────────────────────────────────────────────────
const scoreColour = (score: number) => (score >= 80 ? "#2ECC8A" : score >= 60 ? "#F5A623" : "#E55353");

const scoreLabel = (score: number) => (score >= 80 ? "Excellent" : score >= 60 ? "Fair" : "Needs attention");

const summaryNote = (score: number, wardName: string) => {
  if (score >= 80) return `✅ Great week! ${wardName} checked in regularly and took medications on time.`;
  if (score >= 60)
    return `⚠️ ${wardName} had a reasonable week but missed a few check-ins or medications. Consider reaching out.`;
  return `🚨 ${wardName} had a difficult week with multiple missed check-ins or medications. We recommend calling them directly.`;
};

// ── Component ──────────────────────────────────────────────────────────────
export const WeeklyGuardianReportEmail = ({
  guardianName = "Guardian",
  wardName = "Your ward",
  weekLabel = "This week",
  relation = "Ward",
  healthScore = 0,
  adherencePct = 0,
  medAdherencePct = 0,
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
}: WeeklyGuardianReportProps) => {
  const scoreColor = scoreColour(healthScore);

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        📊 {wardName}'s weekly report — {scoreLabel(healthScore)} ({healthScore}/100) · {weekLabel}
      </Preview>
      <Body style={s.main}>
        <Container style={s.container}>
          {/* ── Logo ── */}
          <Section style={s.logoSection}>
            <div style={s.logoBadge}>
              <span style={s.logoCheck}>CHECK-</span>
              <span style={s.logoIN}>iN</span>
            </div>
            <Text style={s.logoTagline}>Personal Safety Network</Text>
          </Section>

          {/* ── Title ── */}
          <Heading style={s.heading}>Weekly Report Card</Heading>
          <Text style={s.subheading}>
            Hi {guardianName}, here's how <strong>{wardName}</strong> ({relation}) did last week · {weekLabel}
          </Text>

          {/* ── Health score banner ── */}
          <Section style={{ ...s.scoreCard, borderColor: scoreColor }}>
            <Text style={s.scoreLabel}>Overall Health Score</Text>
            <Text style={{ ...s.scoreNum, color: scoreColor }}>
              {healthScore}
              <span style={s.scoreOf}>/100</span>
            </Text>
            <span
              style={{
                ...s.pill,
                backgroundColor: `${scoreColor}18`,
                color: scoreColor,
                border: `1px solid ${scoreColor}30`,
              }}
            >
              {scoreLabel(healthScore)}
            </span>
          </Section>

          {/* ── Check-in card ── */}
          <Section style={s.card}>
            <Text style={s.cardTitle}>🕐 Check-In Adherence</Text>
            <Row>
              <Column style={s.statCol}>
                <Text style={{ ...s.statNum, color: "#2ECC8A" }}>
                  {respondedCheckIns}/{totalCheckIns}
                </Text>
                <Text style={s.statLabel}>Completed</Text>
              </Column>
              <Column style={s.statCol}>
                <Text style={{ ...s.statNum, color: missedCheckIns > 0 ? "#F5A623" : "#9BAAC4" }}>
                  {missedCheckIns}
                </Text>
                <Text style={s.statLabel}>Missed</Text>
              </Column>
              <Column style={s.statCol}>
                <Text
                  style={{
                    ...s.statNum,
                    color: adherencePct >= 80 ? "#2ECC8A" : adherencePct >= 60 ? "#F5A623" : "#E55353",
                  }}
                >
                  {adherencePct}%
                </Text>
                <Text style={s.statLabel}>Rate</Text>
              </Column>
            </Row>
            {/* Progress bar */}
            <div style={s.barTrack}>
              <div
                style={{
                  ...s.barFill,
                  width: `${Math.min(adherencePct, 100)}%`,
                  backgroundColor: adherencePct >= 80 ? "#2ECC8A" : "#F5A623",
                }}
              />
            </div>
            {missedCheckInDetails.length > 0 && (
              <>
                <Hr style={s.innerHr} />
                <Text style={s.missedTitle}>Missed check-in times:</Text>
                {missedCheckInDetails.map((d, i) => (
                  <Text key={i} style={s.missedRow}>
                    • {d}
                  </Text>
                ))}
              </>
            )}
          </Section>

          {/* ── Medication card ── */}
          <Section style={s.card}>
            <Text style={s.cardTitle}>💊 Medication Adherence</Text>
            <Row>
              <Column style={s.statCol}>
                <Text style={{ ...s.statNum, color: "#4682DC" }}>
                  {takenMeds}/{totalMeds}
                </Text>
                <Text style={s.statLabel}>Taken</Text>
              </Column>
              <Column style={s.statCol}>
                <Text style={{ ...s.statNum, color: lateMeds > 0 ? "#F5A623" : "#9BAAC4" }}>{lateMeds}</Text>
                <Text style={s.statLabel}>Late</Text>
              </Column>
              <Column style={s.statCol}>
                <Text style={{ ...s.statNum, color: missedMeds > 0 ? "#E55353" : "#9BAAC4" }}>{missedMeds}</Text>
                <Text style={s.statLabel}>Missed</Text>
              </Column>
              <Column style={s.statCol}>
                <Text
                  style={{
                    ...s.statNum,
                    color: medAdherencePct >= 80 ? "#2ECC8A" : medAdherencePct >= 60 ? "#F5A623" : "#E55353",
                  }}
                >
                  {medAdherencePct}%
                </Text>
                <Text style={s.statLabel}>Rate</Text>
              </Column>
            </Row>
            <div style={s.barTrack}>
              <div
                style={{
                  ...s.barFill,
                  width: `${Math.min(medAdherencePct, 100)}%`,
                  backgroundColor: medAdherencePct >= 80 ? "#2ECC8A" : "#F5A623",
                }}
              />
            </div>
          </Section>

          {/* ── Vitals & SOS ── */}
          <Section style={s.card}>
            <Text style={s.cardTitle}>❤️ Vitals & Safety</Text>
            <Row>
              {avgHR != null && (
                <Column style={s.statCol}>
                  <Text style={{ ...s.statNum, color: "#2ECC8A" }}>{avgHR} bpm</Text>
                  <Text style={s.statLabel}>Avg heart rate</Text>
                </Column>
              )}
              {avgSpO2 != null && (
                <Column style={s.statCol}>
                  <Text style={{ ...s.statNum, color: "#4682DC" }}>{avgSpO2}%</Text>
                  <Text style={s.statLabel}>Avg SpO₂</Text>
                </Column>
              )}
              <Column style={s.statCol}>
                <Text style={{ ...s.statNum, color: totalSOS > 0 ? "#E55353" : "#9BAAC4" }}>{totalSOS}</Text>
                <Text style={s.statLabel}>SOS events</Text>
              </Column>
            </Row>
            {totalSOS > 0 && (
              <Text style={s.sosWarning}>
                ⚠️ {wardName} triggered {totalSOS} SOS alert{totalSOS > 1 ? "s" : ""} this week. Please review the app
                for full details.
              </Text>
            )}
          </Section>

          {/* ── Summary note ── */}
          <Section style={s.summaryBox}>
            <Text style={s.summaryText}>{summaryNote(healthScore, wardName)}</Text>
            <Text style={{ ...s.summaryText, marginTop: "8px", marginBottom: "0" }}>
              Open the Check-iN Guardian app to see live status, location history, and full logs.
            </Text>
          </Section>

          <Hr style={s.divider} />

          {/* ── Footer ── */}
          <Text style={s.footer}>
            {SITE_NAME} — Personal Emergency Response System{"\n"}
            Future Wave Technologies Pvt. Ltd. · Mumbai, India{"\n"}
            You are receiving this as a nominated Guardian of {wardName}. To unsubscribe, update notification settings
            in the Check-iN app.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  main: { backgroundColor: "#06101E", fontFamily: "Arial, sans-serif" },
  container: { maxWidth: "580px", margin: "0 auto", padding: "28px 20px 40px" },
  logoSection: { textAlign: "center" as const, marginBottom: "6px" },
  logoBadge: {
    display: "inline-block",
    backgroundColor: "#1C3050",
    border: "1.5px solid rgba(46,204,138,0.3)",
    borderRadius: "14px",
    padding: "8px 18px",
  },
  logoCheck: { fontSize: "22px", fontWeight: "800" as const, color: "#F0F4FF", letterSpacing: "-0.03em" },
  logoIN: { fontSize: "22px", fontWeight: "800" as const, color: "#2ECC8A", letterSpacing: "-0.03em" },
  logoTagline: { fontSize: "12px", color: "#5E7499", margin: "4px 0 20px", textAlign: "center" as const },

  heading: {
    fontSize: "24px",
    fontWeight: "700" as const,
    color: "#F0F4FF",
    margin: "0 0 6px",
    letterSpacing: "-0.02em",
  },
  subheading: { fontSize: "14px", color: "#9BAAC4", margin: "0 0 20px", lineHeight: "1.5" },

  scoreCard: {
    backgroundColor: "rgba(46,204,138,0.05)",
    border: "1.5px solid",
    borderRadius: "16px",
    padding: "20px",
    textAlign: "center" as const,
    marginBottom: "12px",
  },
  scoreLabel: {
    fontSize: "11px",
    fontWeight: "600" as const,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: "#9BAAC4",
    margin: "0 0 8px",
  },
  scoreNum: { fontSize: "52px", fontWeight: "800" as const, lineHeight: "1", margin: "0 0 10px" },
  scoreOf: { fontSize: "20px", color: "#5E7499" },
  pill: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: "600" as const,
    padding: "4px 12px",
    borderRadius: "99px",
    letterSpacing: "0.04em",
  },

  card: {
    backgroundColor: "#1C3050",
    border: "1px solid #243D60",
    borderRadius: "14px",
    padding: "16px 18px",
    marginBottom: "10px",
  },
  cardTitle: {
    fontSize: "11px",
    fontWeight: "600" as const,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
    color: "#9BAAC4",
    margin: "0 0 14px",
  },
  statCol: { textAlign: "center" as const, padding: "0 6px" },
  statNum: { fontSize: "26px", fontWeight: "700" as const, lineHeight: "1", margin: "0 0 3px", color: "#F0F4FF" },
  statLabel: { fontSize: "11px", color: "#9BAAC4", margin: "0" },

  barTrack: {
    backgroundColor: "#162744",
    borderRadius: "3px",
    height: "5px",
    marginTop: "12px",
    overflow: "hidden" as const,
  },
  barFill: { height: "5px", borderRadius: "3px" },

  innerHr: { borderColor: "#243D60", margin: "14px 0 10px" },
  missedTitle: {
    fontSize: "11px",
    fontWeight: "600" as const,
    color: "#9BAAC4",
    textTransform: "uppercase" as const,
    letterSpacing: "0.06em",
    margin: "0 0 6px",
  },
  missedRow: {
    fontSize: "13px",
    color: "#9BAAC4",
    margin: "3px 0",
    paddingLeft: "4px",
    borderLeft: "2px solid #F5A623",
  },

  sosWarning: {
    fontSize: "13px",
    color: "#E55353",
    marginTop: "12px",
    marginBottom: "0",
    backgroundColor: "rgba(229,83,83,0.08)",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(229,83,83,0.2)",
  },

  summaryBox: {
    backgroundColor: "rgba(46,204,138,0.05)",
    border: "1px solid rgba(46,204,138,0.15)",
    borderRadius: "12px",
    padding: "14px 16px",
    marginTop: "8px",
  },
  summaryText: { fontSize: "13px", color: "#9BAAC4", lineHeight: "1.6", margin: "0" },

  divider: { borderColor: "#243D60", margin: "24px 0 16px" },
  footer: {
    fontSize: "11px",
    color: "#5E7499",
    textAlign: "center" as const,
    lineHeight: "1.7",
    margin: "0",
    whiteSpace: "pre-line" as const,
  },
};

// ── Template export (matches registry pattern exactly) ─────────────────────
export const template = {
  component: WeeklyGuardianReportEmail,
  subject: (data: Record<string, any>) =>
    `📊 ${data.wardName || "Your ward"}'s Weekly Check-iN Report — ${data.weekLabel || ""}`,
  displayName: "Weekly guardian report",
  previewData: {
    guardianName: "Rahul Alphonso",
    wardName: "Aldrin Alphonso",
    weekLabel: "30 Jun – 6 Jul",
    relation: "Son",
    healthScore: 82,
    adherencePct: 86,
    medAdherencePct: 75,
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
    missedCheckInDetails: ["Mon, 30 Jun — 7:00 AM", "Wed, 2 Jul — 7:00 PM", "Thu, 3 Jul — 12:00 PM"],
  },
} satisfies TemplateEntry;
