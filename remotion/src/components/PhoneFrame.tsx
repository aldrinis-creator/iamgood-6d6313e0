import React from "react";
import { COLORS } from "../theme";

export const PhoneFrame: React.FC<{
  width?: number;
  children: React.ReactNode;
  bg?: string;
}> = ({ width = 420, children, bg = COLORS.cream }) => {
  const height = Math.round((width * 19.5) / 9);
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 52,
        background: "#0b1220",
        padding: 14,
        boxShadow: "0 40px 80px rgba(15,35,64,0.35), 0 12px 24px rgba(15,35,64,0.2)",
        position: "relative",
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 40,
          background: bg,
          overflow: "hidden",
          position: "relative",
        }}
      >
        {/* notch */}
        <div
          style={{
            position: "absolute",
            top: 12,
            left: "50%",
            transform: "translateX(-50%)",
            width: 110,
            height: 26,
            borderRadius: 999,
            background: "#0b1220",
            zIndex: 20,
          }}
        />
        {children}
      </div>
    </div>
  );
};

export const StatusBar: React.FC = () => (
  <div
    style={{
      height: 46,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "0 28px",
      fontSize: 13,
      fontWeight: 600,
      color: COLORS.ink,
      fontFamily: "Inter",
    }}
  >
    <span>9:41</span>
    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <span>••••</span>
      <span>▲</span>
      <span>▮▮▮</span>
    </span>
  </div>
);
