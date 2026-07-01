import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const GuardianRing: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });

  const ringProgress = interpolate(
    spring({ frame: frame - 20, fps, config: { damping: 25, stiffness: 90 } }),
    [0, 1],
    [0, 0.92],
  );
  const score = Math.round(ringProgress * 100);
  const R = 88;
  const C = 2 * Math.PI * R;
  const dash = C * ringProgress;

  const items = [
    { label: "Vitals", value: "94", tone: COLORS.emerald },
    { label: "Adherence", value: "91%", tone: COLORS.navy },
    { label: "Mood", value: "Good", tone: COLORS.amber },
    { label: "Sleep", value: "7h 20m", tone: "#8b5cf6" },
  ];

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 50, flexDirection: isV ? "column" : "row" }}>
      {!isV && (
        <div style={{ maxWidth: 480, opacity: enter }}>
          <div style={{ fontSize: 28, color: COLORS.navy, fontWeight: 700, marginBottom: 10 }}>GUARDIAN DASHBOARD</div>
          <div style={{ fontSize: 62, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, lineHeight: 1.05 }}>
            The full picture,<br />at a glance.
          </div>
          <div style={{ marginTop: 20, fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, lineHeight: 1.5 }}>
            Live Health Score. Vitals. Adherence. Mood. Sleep. Location.
          </div>
        </div>
      )}
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
        <PhoneFrame width={isV ? 500 : 440}>
          <StatusBar />
          <div style={{ padding: "6px 22px 0", fontFamily: "Inter" }}>
            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>WARD · MEERA A</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy, marginTop: 2 }}>Today's status</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 20 }}>
            <div style={{ position: "relative", width: 220, height: 220 }}>
              <svg width={220} height={220} viewBox="0 0 220 220" style={{ transform: "rotate(-90deg)" }}>
                <circle cx={110} cy={110} r={R} stroke={COLORS.line} strokeWidth={16} fill="none" />
                <circle
                  cx={110} cy={110} r={R}
                  stroke={COLORS.emerald} strokeWidth={16} fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${dash} ${C}`}
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: 56, fontWeight: 800, color: COLORS.navy, fontFamily: "Plus Jakarta Sans", lineHeight: 1 }}>{score}</div>
                <div style={{ fontSize: 12, color: COLORS.muted, fontFamily: "Inter", fontWeight: 600, marginTop: 4 }}>HEALTH SCORE</div>
              </div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "20px 18px 0", fontFamily: "Inter" }}>
            {items.map((it, i) => {
              const op = interpolate(frame, [40 + i * 8, 55 + i * 8], [0, 1], { extrapolateRight: "clamp" });
              return (
                <div key={it.label} style={{ padding: 12, borderRadius: 14, background: "#fff", boxShadow: "0 4px 12px rgba(15,35,64,0.06)", opacity: op }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>{it.label.toUpperCase()}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: it.tone, marginTop: 4 }}>{it.value}</div>
                </div>
              );
            })}
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
