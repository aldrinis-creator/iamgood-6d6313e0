import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

declare const __APP_VERSION__: string;

const isIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();
const isPreview =
  /id-preview--|lovableproject\.com/.test(window.location.hostname);

(async () => {
  if ("serviceWorker" in navigator) {
    try {
      const BUILD_ID = __APP_VERSION__;
      const prev = localStorage.getItem("lovable_build_id");
      const buildChanged = prev !== BUILD_ID;

      if (buildChanged || isIframe || isPreview) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
        // Also remove the legacy push SW if still cached
        try {
          await caches.delete("emergency-profile-v1");
        } catch {}
        localStorage.setItem("lovable_build_id", BUILD_ID);
      }

      if (!isIframe && !isPreview && import.meta.env.PROD) {
        const { registerSW } = await import("virtual:pwa-register");
        registerSW({
          immediate: true,
          onNeedRefresh() {
            location.reload();
          },
        });
      }
    } catch (err) {
      console.warn("SW bootstrap failed:", err);
    }
  }

  createRoot(document.getElementById("root")!).render(<App />);
})();
