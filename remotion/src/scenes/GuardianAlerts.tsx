import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import type { Orientation } from "../MainVideo";

export const GuardianAlerts: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";

  const card1 = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  const card2 = spring({ frame: frame - 50, fps, config: { damping: 20, stiffness: 150 } });

  const shake = interpolate(Math.sin(frame / 3), [-1, 1], [-2, 2]);

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, flexDirection: isV ? "column" : "row", padding: 60 }}>
      {/* Missed check-in overlay card */}
      <div
        style={{
          width: isV ? 520 : 520,
          transform: `translateY(${interpolate(card1, [0, 1], [40, 0])}px) translateX(${frame < 90 ? shake : 0}px)`,
          opacity: card1,
          background: "#fff",
          borderRadius: 24,
          padding: 28,
          boxShadow: `0 30px 80px ${COLORS.sos}33, 0 8px 20px rgba(15,35,64,0.08)`,
          border: `2px solid ${COLORS.sos}66`,
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, background: `${COLORS.sos}22`, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke={COLORS.sos} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
              <circle cx={12} cy={12} r={10} />
              <line x1={12} y1={8} x2={12} y2={12} />
              <line x1={12} y1={16} x2={12.01} y2={16} />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13, color: COLORS.sos, fontWeight: 700, letterSpacing: 1 }}>MISSED CHECK-IN</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.navy, marginTop: 2 }}>Meera hasn't checked in</div>
          </div>
        </div>
        <div style={{ marginTop: 16, fontSize: 18, color: COLORS.inkSoft, lineHeight: 1.5 }}>
          7:00 AM Check-iN missed · <b style={{ color: COLORS.sos }}>27 minutes ago</b>
        </div>
        <div style={{ marginTop: 18, display: "flex", gap: 12 }}>
          <div style={{ flex: 1, padding: "14px 20px", borderRadius: 14, background: COLORS.emerald, color: "#fff", fontWeight: 700, fontSize: 16, textAlign: "center" }}>
            Call Meera
          </div>
          <div style={{ flex: 1, padding: "14px 20px", borderRadius: 14, background: COLORS.line, color: COLORS.navy, fontWeight: 700, fontSize: 16, textAlign: "center" }}>
            Send Ping
          </div>
        </div>
      </div>

      {/* WhatsApp safe-zone card */}
      <div
        style={{
          width: isV ? 520 : 520,
          transform: `translateY(${interpolate(card2, [0, 1], [40, 0])}px)`,
          opacity: card2,
          background: "#fff",
          borderRadius: 24,
          padding: 0,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(15,35,64,0.15)",
          fontFamily: "Inter",
        }}
      >
        <div style={{ padding: "14px 20px", background: "#25D366", color: "#fff", display: "flex", alignItems: "center", gap: 10, fontWeight: 700, fontSize: 16 }}>
          <svg width={24} height={24} viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.5 14.4c-.3-.2-1.8-.9-2.1-1-.3-.1-.5-.1-.7.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-1.8-.9-3-1.6-4.2-3.6-.3-.5.3-.5.9-1.7.1-.2 0-.4 0-.5s-.7-1.7-1-2.3c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.2.2 2.1 3.3 5.2 4.6.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.3-.7.3-1.3.2-1.4-.1-.1-.3-.2-.5-.3zM12 2a10 10 0 00-8.6 15L2 22l5.2-1.4A10 10 0 1012 2z" />
          </svg>
          WhatsApp · Check-iN Bot
        </div>
        <div style={{ padding: 22, background: "#f0f2f5" }}>
          <div style={{ display: "inline-block", padding: 14, borderRadius: 12, background: "#dcf8c6", maxWidth: "85%" }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy }}>⚠️ Safe Zone Alert</div>
            <div style={{ fontSize: 15, color: COLORS.ink, marginTop: 6, lineHeight: 1.4 }}>
              <b>Meera</b> has left the <b>Home</b> safe zone at <b>3:42 PM</b>.
            </div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 8, textAlign: "right" }}>3:42 PM ✓✓</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
