import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition, openBrowser } from "@remotion/renderer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const compId = process.argv[2] || "demo-landscape";
const outPath = process.argv[3] || `/mnt/documents/checkin-${compId}.mp4`;

console.log(`Bundling for ${compId}...`);
const bundled = await bundle({
  entryPoint: path.resolve(__dirname, "../src/index.ts"),
  webpackOverride: (config) => config,
});

console.log("Launching Chromium...");
const browser = await openBrowser("chrome", {
  browserExecutable: process.env.PUPPETEER_EXECUTABLE_PATH ?? "/bin/chromium",
  chromiumOptions: {
    args: ["--no-sandbox", "--disable-gpu", "--disable-dev-shm-usage"],
  },
  chromeMode: "chrome-for-testing",
});

const composition = await selectComposition({
  serveUrl: bundled,
  id: compId,
  puppeteerInstance: browser,
});

console.log(`Rendering ${composition.width}x${composition.height} · ${composition.durationInFrames} frames...`);
const t0 = Date.now();
await renderMedia({
  composition,
  serveUrl: bundled,
  codec: "h264",
  outputLocation: outPath,
  puppeteerInstance: browser,
  muted: false,
  audioCodec: "aac",
  concurrency: 2,
  onProgress: ({ progress }) => {
    if (Math.round(progress * 100) % 10 === 0) {
      process.stdout.write(`  ${Math.round(progress * 100)}%\n`);
    }
  },
});
console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s → ${outPath}`);

await browser.close({ silent: false });
