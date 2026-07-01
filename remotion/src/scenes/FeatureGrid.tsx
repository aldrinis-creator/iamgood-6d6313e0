import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import type { Orientation } from "../MainVideo";

const TILES = [
  { label: "Tablets", tone: COLORS.emerald },
  { label: "Health Tools", tone: COLORS.navy },
  { label: "Ambulance", tone: COLORS.sos },
  { label: "Vitals", tone: "#8b5cf6" },
  { label: "First Aid", tone: COLORS.amber },
  { label: "Blood Banks", tone: "#dc2626" },
  { label: "Vault", tone: "#0891b2" },
  { label: "Voice Agent", tone: COLORS.emerald },
  { label: "Wellness", tone: "#10b981" },
];

const iconFor = (label: string) => {
  const common = { width: 34, height: 34, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (label) {
    case "Tablets": return <svg {...common}><path d="M10.5 20.5a7 7 0 01-4.95-11.95l7-7A7 7 0 0117.5 11.5l-7 7z" /><path d="M8.5 8.5l7 7" /></svg>;
    case "Ambulance": return <svg {...common}><rect x={2} y={7} width={20} height={10} rx={2} /><path d="M12 10v4M10 12h4" /></svg>;
    case "First Aid": return <svg {...common}><rect x={3} y={7} width={18} height={12} rx={2} /><path d="M12 11v4M10 13h4" /></svg>;
    case "Blood Banks": return <svg {...common}><path d="M12 2s6 7 6 12a6 6 0 01-12 0c0-5 6-12 6-12z" /></svg>;
    case "Vault": return <svg {...common}><rect x={3} y={5} width={18} height={14} rx={2} /><circle cx={12} cy={12} r={3} /></svg>;
    case "Vitals": return <svg {...common}><path d="M22 12h-4l-3 9L9 3l-3 9H2" /></svg>;
    case "Voice Agent": return <svg {...common}><rect x={9} y={2} width={6} height={12} rx={3} /><path d="M5 10a7 7 0 0014 0M12 19v3" /></svg>;
    case "Wellness": return <svg {...common}><path d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z" /></svg>;
    default: return <svg {...common}><circle cx={12} cy={12} r={9} /></svg>;
  }
};

export const FeatureGrid: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const cols = isV ? 3 : 3;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 40, padding: 60 }}>
      <div style={{ fontSize: isV ? 56 : 64, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, textAlign: "center" }}>
        Everything in one app.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 22, width: isV ? 800 : 900 }}>
        {TILES.map((t, i) => {
          const s = spring({ frame: frame - 5 - i * 4, fps, config: { damping: 18, stiffness: 200 } });
          return (
            <div
              key={t.label}
              style={{
                opacity: s,
                transform: `scale(${interpolate(s, [0, 1], [0.7, 1])})`,
                background: "#fff",
                borderRadius: 24,
                padding: 22,
                boxShadow: "0 10px 30px rgba(15,35,64,0.08)",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                fontFamily: "Inter",
                height: 150,
              }}
            >
              <div style={{ width: 56, height: 56, borderRadius: 16, background: `${t.tone}22`, color: t.tone, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {iconFor(t.label)}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: COLORS.navy, marginTop: "auto" }}>{t.label}</div>
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
