

## Plan — Fix mobile blank-screen + desktop stale-version issues

### Root causes

1. **`base: './'` in `vite.config.ts`** produces relative asset URLs (`./assets/...`). On any deep route (`/dashboard`, `/medical-vault`, `/j/<token>`), the browser resolves them against the current path → 404 → blank screen. This hits mobile users hardest because they refresh / open shared deep links more often.
2. **Two competing service workers** at scope `/`:
   - VitePWA's auto-generated Workbox `sw.js` (precaches `index.html` + hashed JS).
   - A manually-registered `/sw-push.js` for push notifications.
   Whichever registered first stays in control. The cached `index.html` references old hashed chunks that were purged on each new publish → app loads stale shell → references missing JS → silently broken.
3. **No "kill-switch" / forced-update logic** for users already running an old SW. `autoUpdate` only refreshes when the SW *script* changes; users whose SW is broken never get the new one.

### A. `vite.config.ts` — three fixes

1. Change `base: './'` → `base: '/'`. All Lovable hosts are served from origin root; relative base breaks SPA deep-linking.
2. Make the PWA service worker share scope with the push worker by **merging push logic into the Workbox SW** via `injectManifest` strategy, OR (simpler) **disable VitePWA's auto-register and let a single SW (`sw-push.js`) handle both**. We'll pick the simpler path: keep VitePWA only for the manifest + icon precache config, set `injectRegister: false`, and import its registration manually in `main.tsx` *behind a guard*.
3. Add `cleanupOutdatedCaches: true` and `skipWaiting: true` + `clientsClaim: true` to Workbox so old precaches are wiped on activation.

```ts
VitePWA({
  registerType: "autoUpdate",
  injectRegister: false,                // we register manually with guards
  workbox: {
    cleanupOutdatedCaches: true,
    clientsClaim: true,
    skipWaiting: true,
    navigateFallbackDenylist: [/^\/~oauth/, /^\/sw-push\.js/],
    /* existing globPatterns, runtimeCaching */
  },
  /* manifest unchanged */
})
```

### B. `src/main.tsx` — single SW registration with iframe/preview guard + kill-switch

Replace the current bare `createRoot(...)` with a guarded registration that:
- **Unregisters ALL existing service workers** if a new `BUILD_ID` differs from `localStorage.lovable_build_id`. This forces every desktop user stuck on a stale SW to reset on next visit.
- **Skips registration entirely** when running inside an iframe or on `id-preview--*` / `lovableproject.com` hosts (per Lovable PWA guidance).
- Registers the **Workbox SW** (`/sw.js`) on production only, then once it's controlling, posts a message to also activate push subscription handling — so we no longer register `/sw-push.js` separately.

Pseudocode at the top of `main.tsx`:
```ts
const BUILD_ID = __APP_VERSION__;          // injected via vite define
const isIframe = (() => { try { return window.self !== window.top; } catch { return true; } })();
const isPreview = /id-preview--|lovableproject\.com/.test(location.hostname);

(async () => {
  if ("serviceWorker" in navigator) {
    const prev = localStorage.getItem("lovable_build_id");
    if (prev !== BUILD_ID || isIframe || isPreview) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      localStorage.setItem("lovable_build_id", BUILD_ID);
    }
    if (!isIframe && !isPreview && import.meta.env.PROD) {
      const { registerSW } = await import("virtual:pwa-register");
      registerSW({ immediate: true, onNeedRefresh() { location.reload(); } });
    }
  }
  createRoot(document.getElementById("root")!).render(<App />);
})();
```

Add `define: { __APP_VERSION__: JSON.stringify(Date.now().toString()) }` in `vite.config.ts` so each build gets a unique ID.

### C. `src/lib/pushNotifications.ts` — stop registering a second SW

Change `registerServiceWorker()` to use the *already-registered* Workbox SW instead of `/sw-push.js`:
```ts
export const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) return null;
  return await navigator.serviceWorker.ready;   // returns the Workbox SW
};
```
Then **port the push event listeners from `public/sw-push.js` into a small `src/sw-push-handlers.ts`** that VitePWA's `injectManifest` mode can include, OR keep the simpler approach: add the `push` and `notificationclick` handlers directly via Workbox's `additionalManifestEntries` workaround — concretely, switch VitePWA's `strategies` to `"injectManifest"` and provide a custom `src/sw.ts` that does:
```ts
import { precacheAndRoute, cleanupOutdatedCaches } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
self.skipWaiting(); clientsClaim(); cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.addEventListener("push", /* existing logic from sw-push.js */);
self.addEventListener("notificationclick", /* existing logic */);
```
Delete `public/sw-push.js` once handlers are migrated. Result: one SW, one scope, no race.

### D. `index.html` — add explicit no-cache for the HTML shell

Add `<meta http-equiv="Cache-Control" content="no-cache" />` so even if the CDN edge caches `index.html` aggressively, browsers re-validate. (Belt-and-suspenders against future stale shells.)

### E. Verification

1. `npx vite build` succeeds; `dist/index.html` references `/assets/...` (absolute, not `./assets/...`).
2. Open the published URL on desktop where the broken old SW lives → on first load the kill-switch unregisters the old SW + clears caches → second load shows the new build.
3. Open `/dashboard` directly on mobile (cold) → loads (no asset 404s).
4. Open `/j/<token>` shared link on mobile → loads.
5. DevTools → Application → Service Workers shows exactly **one** SW (`sw.js`), scope `/`. Push subscription still works (uses the same SW via `serviceWorker.ready`).
6. Publish a new build → existing users get the update on next page load (no "ghost old version") because `BUILD_ID` changed → unregister + re-register cycle.
7. Inside the Lovable editor preview iframe, no SW is registered (per existing PWA guidance), so live edits show instantly.

### What I will NOT change

- No DB / edge function / RLS changes.
- No feature, route, or UI changes.
- No new npm packages (workbox-* is already pulled in transitively by `vite-plugin-pwa`).
- Push notification behavior preserved — same handlers, just hosted in the unified SW.

