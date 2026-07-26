import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const HealthPassport: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  const score = Math.round(interpolate(frame, [0, 90], [0, 87], { extrapolateRight: "clamp" }));
  const ringP = score / 100;
  const R = 110;
  const C = 2 * Math.PI * R;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60, flexDirection: isV ? "column" : "row" }}>
      {!isV && (
        <div style={{ maxWidth: 520, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [-40, 0])}px)` }}>
          <div style={{ fontSize: 26, color: COLORS.emerald, fontWeight: 700 }}>HEALTH PASSPORT</div>
          <div style={{ fontSize: 64, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
            One daily score.<br />Out of 100.
          </div>
          <div style={{ fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, marginTop: 20, lineHeight: 1.5 }}>
            Vitals · Sleep · Mood · Nutrition — combined into a single trend your family can read at a glance.
          </div>
        </div>
      )}
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
        <PhoneFrame width={isV ? 500 : 420}>
          <StatusBar />
          <div style={{ padding: "10px 22px", fontFamily: "Inter" }}>
            <div style={{ fontSize: 13, color: COLORS.muted, fontWeight: 600 }}>TODAY · HEALTH PASSPORT</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.navy, marginTop: 4 }}>You're doing great</div>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: 24 }}>
            <div style={{ position: "relative", width: 260, height: 260 }}>
              <svg width={260} height={260} viewBox="0 0 260 260">
                <circle cx={130} cy={130} r={R} stroke={COLORS.line} strokeWidth={16} fill="none" />
                <circle
                  cx={130} cy={130} r={R} stroke={COLORS.emerald} strokeWidth={16} fill="none"
                  strokeDasharray={C} strokeDashoffset={C * (1 - ringP)} strokeLinecap="round"
                  transform="rotate(-90 130 130)"
                />
              </svg>
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontSize: 72, fontWeight: 800, color: COLORS.navy, fontFamily: "Inter" }}>{score}</div>
                <div style={{ fontSize: 14, color: COLORS.muted, fontFamily: "Inter" }}>/ 100</div>
              </div>
            </div>
          </div>
          <div style={{ margin: "20px 22px 0", display: "flex", justifyContent: "space-between", fontFamily: "Inter" }}>
            {[
              { l: "Vitals", v: "92" }, { l: "Sleep", v: "84" }, { l: "Mood", v: "88" }, { l: "Meals", v: "80" },
            ].map((s, i) => (
              <div key={s.l} style={{ textAlign: "center", opacity: interpolate(frame, [30 + i * 6, 45 + i * 6], [0, 1], { extrapolateRight: "clamp" }) }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy }}>{s.v}</div>
                <div style={{ fontSize: 11, color: COLORS.muted }}>{s.l}</div>
              </div>
            ))}
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
