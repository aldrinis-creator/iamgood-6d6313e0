import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const UserCheckIn: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";

  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  const tapAt = 90; // frame when tap occurs
  const tap = spring({ frame: frame - tapAt, fps, config: { damping: 8, stiffness: 220 } });
  const tapScale = interpolate(tap, [0, 1], [1, 0.85]);
  const checked = frame > tapAt + 12;
  const ripple = interpolate(frame - tapAt, [0, 40], [0, 1.6], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const rippleOp = interpolate(frame - tapAt, [0, 40], [0.6, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const heartColor = checked ? COLORS.emerald : COLORS.sos;
  const heartLabel = checked ? "Checked In ✓" : "Tap the heart to Check-iN";

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60 }}>
      <div style={{ display: "flex", gap: isV ? 0 : 80, alignItems: "center", flexDirection: isV ? "column" : "row" }}>
        {!isV && (
          <div style={{ maxWidth: 520, transform: `translateX(${interpolate(enter, [0, 1], [-40, 0])}px)`, opacity: enter }}>
            <div style={{ fontSize: 28, color: COLORS.emerald, fontWeight: 700, marginBottom: 10 }}>USER · MORNING</div>
            <div style={{ fontSize: 68, fontWeight: 800, color: COLORS.navy, lineHeight: 1.05, letterSpacing: -2 }}>
              Three taps.<br />That's the whole app.
            </div>
            <div style={{ marginTop: 24, fontSize: 24, fontFamily: "Inter", color: COLORS.inkSoft, lineHeight: 1.5 }}>
              7 AM · 12 PM · 7 PM<br />One tap says "I'm okay."
            </div>
          </div>
        )}
        <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [60, 0])}px)`, opacity: enter }}>
          <PhoneFrame width={isV ? 520 : 440}>
            <StatusBar />
            <div style={{ padding: "10px 24px 0", fontFamily: "Inter" }}>
              <div style={{ fontSize: 14, color: COLORS.muted, fontWeight: 600 }}>Good morning</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: COLORS.navy, marginTop: 2 }}>Meera</div>
            </div>
            <div
              style={{
                margin: "24px 20px",
                padding: 26,
                borderRadius: 28,
                background: "#fff",
                boxShadow: "0 8px 24px rgba(15,35,64,0.08)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 18,
              }}
            >
              <div style={{ fontSize: 14, color: COLORS.muted, fontFamily: "Inter", fontWeight: 600 }}>
                7:00 AM CHECK-IN
              </div>
              <div style={{ position: "relative", width: 220, height: 220 }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: heartColor,
                    transform: `scale(${1 + ripple * 0.4})`,
                    opacity: rippleOp,
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: `linear-gradient(135deg, ${heartColor}, ${checked ? "#059669" : "#dc2626"})`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    transform: `scale(${tapScale})`,
                    boxShadow: `0 12px 40px ${heartColor}55`,
                    transition: "background 0.3s",
                  }}
                >
                  {checked ? (
                    <svg viewBox="0 0 24 24" width={130} height={130} fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width={140} height={140} fill="#fff">
                      <path d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z" />
                    </svg>
                  )}
                </div>
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: COLORS.navy, fontFamily: "Inter" }}>{heartLabel}</div>
              {checked && (
                <div style={{ fontSize: 14, color: COLORS.emerald, fontFamily: "Inter", fontWeight: 600 }}>
                  Family notified · 7:02 AM
                </div>
              )}
            </div>
          </PhoneFrame>
        </div>
      </div>
    </AbsoluteFill>
  );
};
