import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const Journey: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  const t = interpolate(frame, [20, 180], [0, 1], { extrapolateRight: "clamp" });

  // path across map
  const px = 60 + t * 260;
  const py = 260 - t * 140 + Math.sin(t * Math.PI * 2) * 12;
  const outside = frame > 130;

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60, flexDirection: isV ? "column" : "row" }}>
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
        <PhoneFrame width={isV ? 500 : 440}>
          <StatusBar />
          <div style={{ padding: "10px 22px", fontFamily: "Inter" }}>
            <div style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>MAP MY JOURNEY</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: COLORS.navy, marginTop: 4 }}>Home → Clinic</div>
          </div>
          <div style={{ margin: "12px 18px", height: 380, borderRadius: 24, position: "relative", overflow: "hidden",
            background: "linear-gradient(180deg, #dbeafe 0%, #eef2ff 100%)" }}>
            {/* grid streets */}
            {[...Array(6)].map((_, i) => (
              <div key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: 40 + i * 60, height: 1, background: "#c7d2fe" }} />
            ))}
            {[...Array(5)].map((_, i) => (
              <div key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: 40 + i * 60, width: 1, background: "#c7d2fe" }} />
            ))}
            {/* safe zone */}
            <div style={{ position: "absolute", left: 30, top: 210, width: 120, height: 120, borderRadius: "50%",
              background: `${COLORS.emerald}22`, border: `2px solid ${COLORS.emerald}`, display: "flex", alignItems: "center", justifyContent: "center",
              color: COLORS.emerald, fontFamily: "Inter", fontWeight: 700, fontSize: 12 }}>SAFE ZONE</div>
            {/* path trail */}
            <svg width="100%" height="100%" style={{ position: "absolute", inset: 0 }}>
              <path d={`M 90 270 Q 180 240 ${px} ${py}`} stroke={COLORS.navy} strokeWidth={4} strokeDasharray="8 6" fill="none" />
            </svg>
            {/* dot */}
            <div style={{ position: "absolute", left: px - 12, top: py - 12, width: 24, height: 24, borderRadius: "50%",
              background: outside ? COLORS.sos : COLORS.navy, border: "3px solid #fff", boxShadow: "0 4px 14px rgba(0,0,0,0.2)" }} />
          </div>
          {outside && (
            <div style={{ margin: "12px 18px", padding: 12, borderRadius: 12, background: `${COLORS.sos}18`, border: `1px solid ${COLORS.sos}55`,
              fontFamily: "Inter", fontSize: 13, color: COLORS.sos, fontWeight: 700 }}>
              ⚠️ Ward left safe zone · Guardian notified
            </div>
          )}
        </PhoneFrame>
      </div>
      {!isV && (
        <div style={{ maxWidth: 500, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [40, 0])}px)` }}>
          <div style={{ fontSize: 26, color: COLORS.navy, fontWeight: 700 }}>SAFE ZONES · GEOFENCING</div>
          <div style={{ fontSize: 60, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
            Wander off?<br />We'll know.
          </div>
          <div style={{ fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, marginTop: 20, lineHeight: 1.5 }}>
            Draw safe zones on the map. If your loved one drifts more than 1 km, guardians get a WhatsApp alert instantly.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
