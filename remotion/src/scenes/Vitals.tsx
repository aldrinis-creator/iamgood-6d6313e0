import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const Vitals: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  const scan = interpolate(frame, [20, 100], [0, 1], { extrapolateRight: "clamp" });
  const bpm = Math.round(interpolate(frame, [40, 110], [0, 74], { extrapolateRight: "clamp" }));
  const spo2 = Math.round(interpolate(frame, [60, 120], [0, 98], { extrapolateRight: "clamp" }));

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60, flexDirection: isV ? "column" : "row" }}>
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
        <PhoneFrame width={isV ? 500 : 420} bg="#0b1220">
          <StatusBar />
          <div style={{ padding: "10px 22px", fontFamily: "Inter", color: "#fff" }}>
            <div style={{ fontSize: 12, color: "#94a3b8", fontWeight: 600 }}>FACE SCAN · VITALS</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>Hold still…</div>
          </div>
          <div style={{ position: "relative", margin: "18px 22px", height: 320, borderRadius: 24, overflow: "hidden", background: "linear-gradient(180deg,#1e293b,#0f172a)" }}>
            {/* face silhouette */}
            <div style={{ position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)", width: 180, height: 240, border: `2px dashed ${COLORS.emerald}88`, borderRadius: "50%" }} />
            {/* scan line */}
            <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 100}%`, height: 3, background: COLORS.emerald, boxShadow: `0 0 20px ${COLORS.emerald}` }} />
          </div>
          <div style={{ margin: "12px 22px", display: "flex", gap: 12, fontFamily: "Inter" }}>
            {[
              { l: "Heart", v: `${bpm}`, u: "bpm", c: COLORS.sos },
              { l: "SpO₂", v: `${spo2}`, u: "%", c: COLORS.emerald },
              { l: "BP", v: frame > 130 ? "118/76" : "—", u: "", c: COLORS.amber },
            ].map((v) => (
              <div key={v.l} style={{ flex: 1, background: "#1e293b", borderRadius: 14, padding: 12, color: "#fff" }}>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>{v.l}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: v.c, marginTop: 4 }}>
                  {v.v}<span style={{ fontSize: 11, color: "#94a3b8", fontWeight: 500, marginLeft: 3 }}>{v.u}</span>
                </div>
              </div>
            ))}
          </div>
        </PhoneFrame>
      </div>
      {!isV && (
        <div style={{ maxWidth: 480, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [40, 0])}px)` }}>
          <div style={{ fontSize: 26, color: "#8b5cf6", fontWeight: 700 }}>NO WEARABLE NEEDED</div>
          <div style={{ fontSize: 60, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
            Vitals from<br />a face scan.
          </div>
          <div style={{ fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, marginTop: 20, lineHeight: 1.5 }}>
            Heart rate · SpO₂ · Blood pressure — captured with the front camera in under 30 seconds.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
