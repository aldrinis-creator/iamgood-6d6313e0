import React from "react";
import { AbsoluteFill, Img, staticFile, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import type { Orientation } from "../MainVideo";

export const TitleCard: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const isV = orientation === "vertical";

  const logoIn = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const wordIn = interpolate(frame, [12, 32], [0, 1], { extrapolateRight: "clamp" });
  const wordY = interpolate(spring({ frame: frame - 12, fps, config: { damping: 20 } }), [0, 1], [30, 0]);
  const subIn = interpolate(frame, [28, 50], [0, 1], { extrapolateRight: "clamp" });
  const chipIn = interpolate(frame, [50, 72], [0, 1], { extrapolateRight: "clamp" });

  // Gentle fade at the very end so it hands off smoothly to Hook
  const fadeOut = interpolate(frame, [durationInFrames - 12, durationInFrames], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Ambient breathing glow behind the logo
  const glow = 1 + Math.sin(frame / 14) * 0.06;

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1400px 900px at 50% 40%, ${COLORS.navy} 0%, ${COLORS.navyDeep} 70%)`,
        alignItems: "center",
        justifyContent: "center",
        gap: isV ? 44 : 56,
        opacity: fadeOut,
      }}
    >
      <div
        style={{
          position: "relative",
          transform: `scale(${logoIn})`,
          width: isV ? 300 : 260,
          height: isV ? 300 : 260,
          borderRadius: "50%",
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 ${80 * glow}px ${COLORS.emerald}66, 0 30px 90px rgba(0,0,0,0.45)`,
        }}
      >
        <Img
          src={staticFile("brand/logo.png")}
          style={{
            width: "78%",
            height: "78%",
            objectFit: "contain",
          }}
        />
      </div>

      <div style={{ textAlign: "center", opacity: wordIn, transform: `translateY(${wordY}px)` }}>
        <div
          style={{
            fontSize: isV ? 120 : 150,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: -3,
            lineHeight: 1,
            fontFamily: "Plus Jakarta Sans",
          }}
        >
          Check-iN
        </div>
        <div
          style={{
            fontSize: isV ? 30 : 34,
            fontFamily: "Inter",
            fontWeight: 500,
            color: "#E2E8F0",
            marginTop: 22,
            opacity: subIn,
            letterSpacing: 0.5,
            maxWidth: 1100,
          }}
        >
          Medication Reminder &amp; Senior Safety App for India
        </div>
      </div>

      <div
        style={{
          marginTop: 8,
          padding: "12px 28px",
          borderRadius: 999,
          background: `${COLORS.emerald}22`,
          border: `1px solid ${COLORS.emerald}88`,
          color: "#ffffff",
          fontFamily: "Inter",
          fontSize: isV ? 22 : 24,
          fontWeight: 600,
          letterSpacing: 0.4,
          opacity: chipIn,
        }}
      >
        by Future Wave · futurewave.in
      </div>
    </AbsoluteFill>
  );
};
