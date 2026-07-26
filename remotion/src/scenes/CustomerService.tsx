import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, interpolate } from "remotion";
import { COLORS } from "../theme";
import type { Orientation } from "../MainVideo";

export const CustomerService: React.FC<{ orientation: Orientation }> = ({ orientation }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const isV = orientation === "vertical";
  const cardA = spring({ frame, fps, config: { damping: 20, stiffness: 150 } });
  const cardB = spring({ frame: frame - 40, fps, config: { damping: 20, stiffness: 150 } });

  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", padding: 80 }}>
      <div style={{ fontSize: isV ? 46 : 60, fontWeight: 800, color: COLORS.navy, letterSpacing: -2, textAlign: "center" }}>
        Real help, real people.
      </div>
      <div style={{ fontSize: 22, fontFamily: "Inter", color: COLORS.inkSoft, marginTop: 16, textAlign: "center", maxWidth: 800 }}>
        Talk to our team on WhatsApp — or plug Check-iN into Claude &amp; ChatGPT via MCP.
      </div>
      <div style={{ display: "flex", gap: 30, marginTop: 50, flexDirection: isV ? "column" : "row" }}>
        {/* WhatsApp card */}
        <div style={{
          width: 480, background: "#fff", borderRadius: 24, overflow: "hidden",
          boxShadow: "0 20px 50px rgba(15,35,64,0.12)",
          transform: `translateY(${interpolate(cardA, [0, 1], [40, 0])}px)`, opacity: cardA,
        }}>
          <div style={{ background: "#25D366", padding: "16px 22px", color: "#fff", display: "flex", alignItems: "center", gap: 12, fontFamily: "Inter" }}>
            <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#fff2", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>💬</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 17 }}>Check-iN Support</div>
              <div style={{ fontSize: 12, opacity: 0.9 }}>online · replies in minutes</div>
            </div>
          </div>
          <div style={{ padding: 22, background: "#f0f2f5", minHeight: 220, fontFamily: "Inter" }}>
            <div style={{ display: "inline-block", padding: 12, borderRadius: 12, background: "#fff", fontSize: 14, color: COLORS.ink, maxWidth: "85%" }}>
              Hi! How do I nominate a second guardian for my father?
            </div>
            <div style={{ textAlign: "right", marginTop: 14, opacity: interpolate(frame, [40, 60], [0, 1], { extrapolateRight: "clamp" }) }}>
              <div style={{ display: "inline-block", padding: 12, borderRadius: 12, background: "#dcf8c6", fontSize: 14, color: COLORS.ink, maxWidth: "85%", textAlign: "left" }}>
                Sure! Open <b>Profile → Guardians → Add nominee</b>. They'll get an SMS with a link to accept 🙌
              </div>
            </div>
          </div>
        </div>
        {/* MCP card */}
        <div style={{
          width: 480, background: "#0f172a", borderRadius: 24, padding: 26, color: "#fff", fontFamily: "Inter",
          boxShadow: "0 20px 50px rgba(15,35,64,0.25)",
          transform: `translateY(${interpolate(cardB, [0, 1], [40, 0])}px)`, opacity: cardB,
        }}>
          <div style={{ fontSize: 12, color: "#a78bfa", fontWeight: 700, letterSpacing: 2 }}>MCP · AI ASSISTANTS</div>
          <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>Connect Claude or ChatGPT</div>
          <div style={{ fontSize: 15, color: "#94a3b8", marginTop: 8, lineHeight: 1.5 }}>
            Ask your assistant: "What's my mother's medication schedule today?" — with your permission.
          </div>
          <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { l: "get_health_status", t: "Today's Passport score: 87/100" },
              { l: "list_medications_today", t: "3 pending · next 8:00 AM" },
              { l: "list_appointments", t: "Cardiology · 24 Jul, 4 PM" },
            ].map((row, i) => (
              <div key={row.l} style={{
                padding: "10px 14px", borderRadius: 12, background: "#1e293b",
                display: "flex", alignItems: "center", gap: 10,
                opacity: interpolate(frame, [60 + i * 12, 80 + i * 12], [0, 1], { extrapolateRight: "clamp" }),
              }}>
                <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS.emerald }} />
                <div style={{ fontSize: 13, color: "#a78bfa", fontFamily: "monospace" }}>{row.l}</div>
                <div style={{ fontSize: 13, color: "#e2e8f0", marginLeft: "auto" }}>{row.t}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
