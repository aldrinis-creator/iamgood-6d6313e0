import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const UserMedsSos: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";

  const medEnter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  const sosEnter = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 150 } });
  const sosPulse = 1 + Math.sin((frame - 40) / 5) * 0.06;
  const pressed = frame > 110;
  const pressScale = pressed ? interpolate(spring({ frame: frame - 110, fps, config: { damping: 6 } }), [0, 1], [1, 0.88]) : 1;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 50, flexDirection: isV ? "column" : "row" }}>
      {/* Med card phone */}
      <div style={{ transform: `translateY(${interpolate(medEnter, [0, 1], [50, 0])}px)`, opacity: medEnter }}>
        <PhoneFrame width={isV ? 420 : 380}>
          <StatusBar />
          <div style={{ padding: "6px 22px 0", fontFamily: "Inter" }}>
            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>TABLETS · 8:00 AM</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.navy, marginTop: 4 }}>Time for meds</div>
          </div>
          {[
            { name: "Metformin", dose: "500 mg · with food", color: COLORS.emerald, taken: frame > 60 },
            { name: "Amlodipine", dose: "5 mg · morning", color: COLORS.navy, taken: frame > 75 },
            { name: "Atorvastatin", dose: "10 mg · after breakfast", color: COLORS.amber, taken: frame > 90 },
          ].map((m, i) => (
            <div
              key={m.name}
              style={{
                margin: "12px 18px",
                padding: 16,
                borderRadius: 18,
                background: "#fff",
                boxShadow: "0 4px 14px rgba(15,35,64,0.06)",
                display: "flex",
                alignItems: "center",
                gap: 14,
                fontFamily: "Inter",
                opacity: interpolate(frame, [10 + i * 8, 25 + i * 8], [0, 1], { extrapolateRight: "clamp" }),
                transform: `translateX(${interpolate(frame, [10 + i * 8, 25 + i * 8], [30, 0], { extrapolateRight: "clamp" })}px)`,
              }}
            >
              <div style={{ width: 42, height: 42, borderRadius: 12, background: m.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff" }}>
                <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.5 20.5a7 7 0 01-4.95-11.95l7-7A7 7 0 0117.5 11.5l-7 7a7 7 0 01-.02.02z" />
                  <path d="M8.5 8.5l7 7" />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: COLORS.navy }}>{m.name}</div>
                <div style={{ fontSize: 13, color: COLORS.inkSoft }}>{m.dose}</div>
              </div>
              <div
                style={{
                  width: 30, height: 30, borderRadius: "50%",
                  background: m.taken ? COLORS.emerald : "transparent",
                  border: `2px solid ${m.taken ? COLORS.emerald : COLORS.line}`,
                  display: "flex", alignItems: "center", justifyContent: "center", color: "#fff",
                }}
              >
                {m.taken && (
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
          ))}
        </PhoneFrame>
      </div>

      {/* SOS phone */}
      <div style={{ transform: `translateY(${interpolate(sosEnter, [0, 1], [50, 0])}px) scale(${sosPulse * pressScale})`, opacity: sosEnter }}>
        <PhoneFrame width={isV ? 420 : 380} bg="#0f172a">
          <StatusBar />
          <div style={{ padding: 24, fontFamily: "Inter", color: "#fff" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600, letterSpacing: 1 }}>EMERGENCY</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>One tap. Everyone alerted.</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", marginTop: 40 }}>
            <div
              style={{
                width: 260, height: 260, borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, #f87171, ${COLORS.sos})`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 0 ${16 + Math.sin(frame / 5) * 8}px ${COLORS.sos}33, 0 30px 80px ${COLORS.sos}66`,
                color: "#fff",
              }}
            >
              <svg width={80} height={80} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <div style={{ fontSize: 44, fontWeight: 800, marginTop: 6 }}>SOS</div>
            </div>
          </div>
          {pressed && (
            <div style={{ margin: "24px 20px 0", padding: 14, borderRadius: 14, background: "#1e293b", fontFamily: "Inter", color: "#fff" }}>
              <div style={{ fontSize: 13, color: "#f87171", fontWeight: 700 }}>SOS ACTIVATED</div>
              <div style={{ fontSize: 15, marginTop: 4 }}>3 guardians · location shared · WhatsApp sent</div>
            </div>
          )}
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
