import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import { PhoneFrame, StatusBar } from "../components/PhoneFrame";
import type { Orientation } from "../MainVideo";

export const Ambulance: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const enter = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  const booked = frame > 90;
  const eta = Math.max(4, 12 - Math.floor((frame - 90) / fps));
  const pulse = 1 + Math.sin(frame / 6) * 0.05;
  const roll = interpolate(frame, [90, 260], [-100, 300], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: 60, flexDirection: isV ? "column" : "row" }}>
      <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [40, 0])}px)`, opacity: enter }}>
        <PhoneFrame width={isV ? 500 : 420}>
          <StatusBar />
          <div style={{ padding: "10px 22px", fontFamily: "Inter" }}>
            <div style={{ fontSize: 12, color: COLORS.sos, fontWeight: 700 }}>AMBULANCE</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: COLORS.navy, marginTop: 4 }}>
              {booked ? "On the way" : "One tap to dispatch"}
            </div>
          </div>
          {!booked && (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
              <div style={{ width: 220, height: 220, borderRadius: "50%",
                background: `radial-gradient(circle at 30% 30%, #f87171, ${COLORS.sos})`,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                color: "#fff", transform: `scale(${pulse})`,
                boxShadow: `0 0 0 12px ${COLORS.sos}22, 0 20px 60px ${COLORS.sos}66` }}>
                <div style={{ fontSize: 60 }}>🚑</div>
                <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, fontFamily: "Inter" }}>Call Ambulance</div>
              </div>
            </div>
          )}
          {booked && (
            <>
              <div style={{ margin: "18px 18px", height: 220, borderRadius: 20, background: "linear-gradient(180deg,#dbeafe,#eef2ff)", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", top: 100, left: 0, right: 0, height: 2, background: COLORS.navy }} />
                <div style={{ position: "absolute", left: roll, top: 60, fontSize: 60 }}>🚑</div>
                <div style={{ position: "absolute", right: 20, top: 140, fontSize: 34 }}>🏠</div>
              </div>
              <div style={{ margin: "0 18px", padding: 14, borderRadius: 14, background: `${COLORS.emerald}18`, border: `1px solid ${COLORS.emerald}55`, fontFamily: "Inter" }}>
                <div style={{ fontSize: 13, color: COLORS.emerald, fontWeight: 700 }}>DISPATCHED · KA 05 MH 2341</div>
                <div style={{ fontSize: 18, fontWeight: 800, color: COLORS.navy, marginTop: 4 }}>ETA {eta} min · ₹1,500 base</div>
                <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>Emergency card sent to driver</div>
              </div>
            </>
          )}
        </PhoneFrame>
      </div>
      {!isV && (
        <div style={{ maxWidth: 480, opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [40, 0])}px)` }}>
          <div style={{ fontSize: 26, color: COLORS.sos, fontWeight: 700 }}>AMBULANCE BOOKING</div>
          <div style={{ fontSize: 60, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, lineHeight: 1.05, marginTop: 8 }}>
            Help,<br />on the way.
          </div>
          <div style={{ fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, marginTop: 20, lineHeight: 1.5 }}>
            One tap dispatches an ambulance with your emergency card — blood group, allergies, meds — pre-sent to the driver.
          </div>
        </div>
      )}
    </AbsoluteFill>
  );
};
