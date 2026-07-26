import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

const DOCS = [
  { icon: "💊", title: "Prescription — Dr Rao", when: "12 Jul", tag: "Doctor's Diagnosis", tone: COLORS.emerald },
  { icon: "🧪", title: "Lipid Profile", when: "08 Jul", tag: "Lab Report", tone: COLORS.navy },
  { icon: "🏥", title: "Apollo Discharge Summary", when: "04 Jul", tag: "Hospital", tone: "#8b5cf6" },
  { icon: "🪪", title: "Aadhaar · Insurance", when: "Verified", tag: "ID Docs", tone: COLORS.amber },
  { icon: "🖼️", title: "X-Ray · Chest", when: "01 Jul", tag: "Imaging", tone: "#0891b2" },
];

export const Vault: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60, flexDirection: isV ? "column" : "row" }}>
      {!isV && (
        <div style={{ maxWidth: 500, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [-40, 0])}px)` }}>
          <div style={{ fontSize: 26, color: "#0891b2", fontWeight: 700 }}>MEDICAL VAULT</div>
          <div style={{ fontSize: 60, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
            Every report.<br />One safe place.
          </div>
          <div style={{ fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, marginTop: 20, lineHeight: 1.5 }}>
            Encrypted storage for prescriptions, lab reports, insurance and ID — with nominee recovery for peace of mind.
          </div>
        </div>
      )}
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
        <PhoneFrame width={isV ? 500 : 440}>
          <StatusBar />
          <div style={{ padding: "10px 22px", fontFamily: "Inter" }}>
            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>ENCRYPTED · NOMINEE-READY</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.navy, marginTop: 4 }}>Your Vault 🔒</div>
          </div>
          <div style={{ margin: "12px 18px" }}>
            {DOCS.map((d, i) => (
              <div key={d.title}
                style={{
                  display: "flex", alignItems: "center", gap: 12,
                  background: "#fff", borderRadius: 16, padding: 14, marginBottom: 10,
                  boxShadow: "0 4px 14px rgba(15,35,64,0.06)",
                  opacity: interpolate(frame, [10 + i * 10, 25 + i * 10], [0, 1], { extrapolateRight: "clamp" }),
                  transform: `translateX(${interpolate(frame, [10 + i * 10, 25 + i * 10], [40, 0], { extrapolateRight: "clamp" })}px)`,
                  fontFamily: "Inter",
                }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: `${d.tone}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>{d.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: COLORS.navy }}>{d.title}</div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>{d.tag} · {d.when}</div>
                </div>
                <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={d.tone} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <rect x={3} y={11} width={18} height={11} rx={2} /><path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
              </div>
            ))}
          </div>
        </PhoneFrame>
      </div>
    </AbsoluteFill>
  );
};
