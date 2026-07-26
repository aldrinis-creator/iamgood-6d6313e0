import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const VoiceAssistant: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });

  const bars = 22;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60, flexDirection: isV ? "column" : "row" }}>
      {!isV && (
        <div style={{ maxWidth: 520, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [-40, 0])}px)` }}>
          <div style={{ fontSize: 26, color: "#8b5cf6", fontWeight: 700 }}>ASK CHECK-iN</div>
          <div style={{ fontSize: 60, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
            Just ask.<br />In your voice.
          </div>
          <div style={{ fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, marginTop: 20, lineHeight: 1.5 }}>
            An Indian-accent voice assistant answers questions about your meds, appointments, and how the app works — 24×7.
          </div>
        </div>
      )}
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
        <PhoneFrame width={isV ? 500 : 420}>
          <StatusBar />
          <div style={{ padding: "10px 22px", fontFamily: "Inter" }}>
            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>ASK CHECK-iN · VOICE</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy, marginTop: 4 }}>How can I help?</div>
          </div>
          {/* user bubble */}
          <div style={{ margin: "16px 20px", opacity: interpolate(frame, [10, 25], [0, 1], { extrapolateRight: "clamp" }) }}>
            <div style={{ display: "inline-block", padding: 14, borderRadius: 18, background: COLORS.navy, color: "#fff", maxWidth: "80%", fontFamily: "Inter", fontSize: 15 }}>
              "When is my next medication?"
            </div>
          </div>
          {/* assistant bubble */}
          <div style={{ margin: "10px 20px", textAlign: "right", opacity: interpolate(frame, [40, 55], [0, 1], { extrapolateRight: "clamp" }) }}>
            <div style={{ display: "inline-block", padding: 14, borderRadius: 18, background: `${COLORS.emerald}18`, color: COLORS.navy, maxWidth: "85%", fontFamily: "Inter", fontSize: 15, textAlign: "left" }}>
              <b>Amlodipine 5 mg</b> at 8 AM tomorrow. Metformin at 8 AM too — with breakfast 🍽️
            </div>
          </div>
          {/* mic + waveform */}
          <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
              {Array.from({ length: bars }).map((_, i) => {
                const h = 6 + Math.abs(Math.sin(frame / 4 + i * 0.6)) * 34;
                return <div key={i} style={{ width: 5, height: h, background: COLORS.emerald, borderRadius: 3 }} />;
              })}
            </div>
            <div style={{ width: 84, height: 84, borderRadius: "50%", background: `radial-gradient(circle,#a78bfa,#8b5cf6)`,
              display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
              boxShadow: `0 0 0 ${8 + Math.sin(frame / 5) * 4}px #8b5cf633` }}>
              <svg width={38} height={38} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <rect x={9} y={2} width={6} height={12} rx={3} /><path d="M5 10a7 7 0 0014 0M12 19v3" />
              </svg>
            </div>
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
