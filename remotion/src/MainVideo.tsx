import React from "react";
import { AbsoluteFill, Series, Sequence, Audio, staticFile, useCurrentFrame, interpolate } from "remotion";
import { loadFont as loadJakarta } from "@remotion/google-fonts/PlusJakartaSans";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { SCENE_ORDER, sceneFrames, voStartFrame, VO, FPS } from "./voDurations";
import { COLORS } from "./theme";
import { Hook } from "./scenes/Hook";
import { UserCheckIn } from "./scenes/UserCheckIn";
import { UserMedsSos } from "./scenes/UserMedsSos";
import { GuardianRing } from "./scenes/GuardianRing";
import { GuardianAlerts } from "./scenes/GuardianAlerts";
import { SafetyNet } from "./scenes/SafetyNet";
import { FeatureGrid } from "./scenes/FeatureGrid";
import { Outro } from "./scenes/Outro";

loadJakarta("normal", { weights: ["500", "700", "800"], subsets: ["latin"] });
loadInter("normal", { weights: ["400", "500", "600"], subsets: ["latin"] });

export type Orientation = "landscape" | "vertical";

const SCENES: Record<string, React.FC<{ orientation: Orientation }>> = {
  s1_hook: Hook,
  s2_checkin: UserCheckIn,
  s3_meds_sos: UserMedsSos,
  s4_ring: GuardianRing,
  s5_alerts: GuardianAlerts,
  s6_safety: SafetyNet,
  s7_grid: FeatureGrid,
  s8_outro: Outro,
};

const BackgroundGradient: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = interpolate(frame, [0, 1800], [0, 40]);
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 800px at ${20 + shift}% ${30 + shift * 0.3}%, ${COLORS.emeraldSoft}55 0%, transparent 60%), radial-gradient(1400px 900px at ${80 - shift * 0.5}% ${70 - shift * 0.2}%, ${COLORS.navy}22 0%, transparent 55%), ${COLORS.cream}`,
      }}
    />
  );
};

const Caption: React.FC<{ text: string; sceneFrameStart: number; sceneFrameEnd: number }> = ({
  text,
  sceneFrameStart,
  sceneFrameEnd,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [sceneFrameStart - 8, sceneFrameStart, sceneFrameEnd - 8, sceneFrameEnd],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 60,
        pointerEvents: "none",
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: "80%",
          padding: "18px 36px",
          borderRadius: 999,
          background: `${COLORS.navyDeep}dd`,
          color: "#fff",
          fontFamily: "Inter",
          fontSize: 30,
          fontWeight: 500,
          textAlign: "center",
          lineHeight: 1.35,
          boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
};

export const MainVideo: React.FC<{ orientation?: Orientation }> = ({ orientation = "landscape" }) => {
  let cursor = 0;

  return (
    <AbsoluteFill style={{ fontFamily: "Plus Jakarta Sans" }}>
      <BackgroundGradient />
      <Series>
        {SCENE_ORDER.map((key) => {
          const dur = sceneFrames(key);
          const Comp = SCENES[key];
          const voStart = voStartFrame(key);
          const captionEnd = dur - 4;
          const captionStart = voStart;
          const localCursor = cursor;
          cursor += dur;
          return (
            <Series.Sequence key={key} durationInFrames={dur}>
              <AbsoluteFill>
                <Comp orientation={orientation} />
                <Caption text={VO[key].text} sceneFrameStart={captionStart} sceneFrameEnd={captionEnd} />
                <Sequence from={voStart}>
                  <Audio src={staticFile(`audio/${key}.mp3`)} volume={1} />
                </Sequence>
              </AbsoluteFill>
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
