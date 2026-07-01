import React from "react";
import { Composition } from "remotion";
import { MainVideo } from "./MainVideo";
import { TOTAL_FRAMES, FPS } from "./voDurations";

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
    </>
  );
};
