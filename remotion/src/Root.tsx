import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { MainVideo3min } from "./MainVideo3min";
import { TOTAL_FRAMES, FPS } from "./voDurations";
import { TOTAL_FRAMES3, FPS3 } from "./voDurations3min";
import { TITLE_CARD_FRAMES } from "./MainVideo3min";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="demo-landscape"
        component={MainVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1920}
        height={1080}
        defaultProps={{ orientation: "landscape" as const }}
      />
      <Composition
        id="demo-vertical"
        component={MainVideo}
        durationInFrames={TOTAL_FRAMES}
        fps={FPS}
        width={1080}
        height={1920}
        defaultProps={{ orientation: "vertical" as const }}
      />
      <Composition
        id="demo-3min-landscape"
        component={MainVideo3min}
        durationInFrames={TOTAL_FRAMES3 + TITLE_CARD_FRAMES}
        fps={FPS3}
        width={1920}
        height={1080}
        defaultProps={{ orientation: "landscape" as const }}
      />
    </>
  );
};
