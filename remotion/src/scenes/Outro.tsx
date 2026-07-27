import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
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
  const footer = interpolate(frame, [100, 120], [0, 1], { extrapolateRight: "clamp" });
  const glow = 1 + Math.sin(frame / 14) * 0.05;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1400px 900px at 50% 45%, ${COLORS.navy} 0%, ${COLORS.navyDeep} 75%)`,
        alignItems: "center",
        justifyContent: "center",
        gap: isV ? 26 : 30,
      }}
    >
      <div
        style={{
          transform: `scale(${logo})`,
          width: isV ? 210 : 190,
          height: isV ? 210 : 190,
          borderRadius: "50%",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 ${70 * glow}px ${COLORS.emerald}77, 0 30px 80px rgba(0,0,0,0.45)`,
        }}
      >
        <Img
          src={staticFile("brand/logo.png")}
          style={{ width: "78%", height: "78%", objectFit: "contain" }}
        />
      </div>
      <div
        style={{
          fontSize: isV ? 100 : 120,
          fontWeight: 800,
          color: "#ffffff",
          letterSpacing: -3,
          opacity: line1,
          fontFamily: "Plus Jakarta Sans",
        }}
      >
        Check-iN
      </div>
      <div
        style={{
          fontSize: isV ? 30 : 34,
          fontFamily: "Inter",
          color: "#E2E8F0",
          fontWeight: 500,
          opacity: line2,
          textAlign: "center",
          maxWidth: 900,
        }}
      >
        Because caring should be simple.
      </div>
      <div
        style={{
          marginTop: 14,
          padding: "14px 32px",
          borderRadius: 999,
          background: COLORS.emerald,
          color: "#ffffff",
          fontFamily: "Inter",
          fontSize: isV ? 24 : 26,
          fontWeight: 700,
          opacity: url,
          boxShadow: `0 12px 30px ${COLORS.emerald}55`,
        }}
      >
        iamgood.lovable.app · Free to start
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: isV ? 20 : 22,
          fontFamily: "Inter",
          fontWeight: 500,
          color: "#94A3B8",
          letterSpacing: 0.4,
          opacity: footer,
        }}
      >
        Future Wave · futurewave.in
      </div>
    </AbsoluteFill>
  );
};
