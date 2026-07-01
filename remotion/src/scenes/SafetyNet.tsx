import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import type { Orientation } from "../MainVideo";

const Feature: React.FC<{ delay: number; icon: React.ReactNode; title: string; desc: string; tone: string }> = ({ delay, icon, title, desc, tone }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 20, stiffness: 150 } });
  return (
    <div
      style={{
        opacity: s,
        transform: `translateY(${interpolate(s, [0, 1], [30, 0])}px)`,
        background: "#fff",
        borderRadius: 22,
        padding: 22,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
        boxShadow: "0 10px 30px rgba(15,35,64,0.08)",
        fontFamily: "Inter",
        width: 360,
      }}
    >
      <div style={{ width: 54, height: 54, borderRadius: 14, background: `${tone}22`, display: "flex", alignItems: "center", justifyContent: "center", color: tone, flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy }}>{title}</div>
        <div style={{ fontSize: 15, color: COLORS.inkSoft, marginTop: 4, lineHeight: 1.4 }}>{desc}</div>
      </div>
    </div>
  );
};

export const SafetyNet: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const isV = orientation === "vertical";
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30, flexDirection: "column", padding: 80 }}>
      <div style={{ fontSize: isV ? 60 : 68, fontWeight: 800, color: COLORS.navy, textAlign: "center", letterSpacing: -2, lineHeight: 1.1, maxWidth: 900 }}>
        A silent safety net,<br />always on.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isV ? "1fr" : "1fr 1fr", gap: 22, marginTop: 20 }}>
        <Feature
          delay={10} tone={COLORS.sos}
          icon={<svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v6M12 22v-6M4.93 4.93l4.24 4.24M14.83 14.83l4.24 4.24M2 12h6M22 12h-6M4.93 19.07l4.24-4.24M14.83 9.17l4.24-4.24" /></svg>}
          title="Fall Detection"
          desc="Guardians alerted the second a fall is detected."
        />
        <Feature
          delay={22} tone={COLORS.navy}
          icon={<svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l19-9-9 19-2-8-8-2z" /></svg>}
          title="Map My Journey"
          desc="Live route sharing on every trip."
        />
        <Feature
          delay={34} tone={COLORS.emerald}
          icon={<svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l8 4v6c0 5-3.5 9-8 10-4.5-1-8-5-8-10V6l8-4z" /></svg>}
          title="Medical Vault"
          desc="Encrypted records, ready in one tap."
        />
        <Feature
          delay={46} tone={COLORS.amber}
          icon={<svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round"><circle cx={12} cy={12} r={10} /><polyline points="12 6 12 12 16 14" /></svg>}
          title="Auto Sleep Mode"
          desc="Pauses check-ins during rest hours."
        />
      </div>
    </AbsoluteFill>
  );
};
