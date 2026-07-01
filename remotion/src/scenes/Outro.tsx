import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import type { Orientation } from "../MainVideo";

export const Outro: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const logo = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const line1 = interpolate(frame, [15, 35], [0, 1], { extrapolateRight: "clamp" });
  const line2 = interpolate(frame, [45, 65], [0, 1], { extrapolateRight: "clamp" });
  const url = interpolate(frame, [80, 100], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 30 }}>
      <div
        style={{
          transform: `scale(${logo})`,
          width: isV ? 200 : 180,
          height: isV ? 200 : 180,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.emerald}, #059669)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 30px 80px ${COLORS.emerald}55`,
        }}
      >
        <svg viewBox="0 0 24 24" width={isV ? 120 : 100} height={isV ? 120 : 100} fill="#fff">
          <path d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z" />
        </svg>
      </div>
      <div style={{ fontSize: isV ? 100 : 120, fontWeight: 800, color: COLORS.navy, letterSpacing: -3, opacity: line1 }}>
        Check-iN
      </div>
      <div style={{ fontSize: isV ? 30 : 34, fontFamily: "Inter", color: COLORS.inkSoft, fontWeight: 500, opacity: line2, textAlign: "center", maxWidth: 800 }}>
        Because caring should be simple.
      </div>
      <div
        style={{
          marginTop: 20,
          padding: "14px 32px",
          borderRadius: 999,
          background: COLORS.navy,
          color: "#fff",
          fontFamily: "Inter",
          fontSize: isV ? 24 : 26,
          fontWeight: 700,
          opacity: url,
        }}
      >
        iamgood.lovable.app  ·  Free to start
      </div>
    </AbsoluteFill>
  );
};
