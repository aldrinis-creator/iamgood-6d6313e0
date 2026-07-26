import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const FallDetection: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  // countdown ring
  const start = 40;
  const countdown = Math.max(0, 15 - Math.floor((frame - start) / fps));
  const ringP = interpolate(frame, [start, start + 15 * fps], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const R = 90;
  const C = 2 * Math.PI * R;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60, flexDirection: isV ? "column" : "row" }}>
      {!isV && (
        <div style={{ maxWidth: 500, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [-40, 0])}px)` }}>
          <div style={{ fontSize: 26, color: COLORS.sos, fontWeight: 700 }}>FALL DETECTION</div>
          <div style={{ fontSize: 60, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
            If they fall,<br />we act.
          </div>
          <div style={{ fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, marginTop: 20, lineHeight: 1.5 }}>
            Sensor-based fall detection with a 15-second buffer. Cancel it, or SOS fires automatically to every guardian.
          </div>
        </div>
      )}
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
        <PhoneFrame width={isV ? 500 : 420} bg="#0b1220">
          <StatusBar />
          <div style={{ padding: 24, fontFamily: "Inter", color: "#fff", textAlign: "center" }}>
            <div style={{ fontSize: 12, color: COLORS.sos, fontWeight: 700, letterSpacing: 2 }}>FALL DETECTED</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 6 }}>Are you okay?</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <div style={{ position: "relative", width: 220, height: 220 }}>
              <svg width={220} height={220} viewBox="0 0 220 220">
                <circle cx={110} cy={110} r={R} stroke="#1e293b" strokeWidth={12} fill="none" />
                <circle cx={110} cy={110} r={R} stroke={COLORS.sos} strokeWidth={12} fill="none"
                  strokeDasharray={C} strokeDashoffset={C * (1 - ringP)} strokeLinecap="round"
                  transform="rotate(-90 110 110)" />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                <div style={{ fontSize: 64, fontWeight: 800 }}>{countdown}</div>
                <div style={{ fontSize: 12, color: "#94a3b8" }}>seconds to SOS</div>
              </div>
            </div>
          </div>
          <div style={{ margin: "28px 22px", display: "flex", gap: 10, fontFamily: "Inter" }}>
            <div style={{ flex: 1, padding: 16, borderRadius: 14, background: "#1e293b", color: "#fff", textAlign: "center", fontWeight: 700 }}>I'm okay</div>
            <div style={{ flex: 1, padding: 16, borderRadius: 14, background: COLORS.sos, color: "#fff", textAlign: "center", fontWeight: 700 }}>Send SOS</div>
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
