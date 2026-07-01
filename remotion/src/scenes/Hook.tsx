import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, useVideoConfig, interpolate } from "remotion";
import { COLORS } from "../theme";
import type { Orientation } from "../MainVideo";

export const Hook: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const beat = spring({ frame, fps, config: { damping: 10, stiffness: 90 } });
  const pulse = 1 + Math.sin(frame / 6) * 0.04;
  const titleY = interpolate(spring({ frame: frame - 12, fps, config: { damping: 18 } }), [0, 1], [40, 0]);
  const titleOp = interpolate(frame, [12, 30], [0, 1], { extrapolateRight: "clamp" });
  const tagOp = interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" });
  const isV = orientation === "vertical";

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: isV ? 40 : 60 }}>
      <div
        style={{
          transform: `scale(${beat * pulse})`,
          width: isV ? 320 : 260,
          height: isV ? 320 : 260,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${COLORS.emerald}, #059669)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 30px 80px ${COLORS.emerald}55`,
        }}
      >
        <svg viewBox="0 0 24 24" width={isV ? 180 : 150} height={isV ? 180 : 150} fill="#fff">
          <path d="M12 21s-7-4.35-7-10a5 5 0 019-3 5 5 0 019 3c0 5.65-7 10-7 10z" />
        </svg>
      </div>
      <div style={{ textAlign: "center", opacity: titleOp, transform: `translateY(${titleY}px)` }}>
        <div
          style={{
            fontSize: isV ? 110 : 130,
            fontWeight: 800,
            color: COLORS.navy,
            letterSpacing: -3,
            lineHeight: 1,
          }}
        >
          Check-iN
        </div>
        <div
          style={{
            fontSize: isV ? 32 : 36,
            fontFamily: "Inter",
            fontWeight: 500,
            color: COLORS.inkSoft,
            marginTop: 18,
            opacity: tagOp,
            letterSpacing: 0.5,
          }}
        >
          Care that shows up, every day.
        </div>
      </div>
    </AbsoluteFill>
  );
};
