

## Plan — Fix white-screen on published site (`vendor-maps` React TDZ)

### Root cause (confirmed via live console)

The published `https://iamgood.lovable.app/` returns HTTP 200 with all assets, but JS crashes at module evaluation:

```
TypeError: Cannot read properties of undefined (reading 'createContext')
  at vendor-maps-BpkyvA2L.js:1:1091
```

That line is `react-leaflet` calling `React.createContext(...)` at top-level. The current `manualChunks` rule in `vite.config.ts` splits chunks by sub-string match:

```ts
if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router')) return 'vendor-react';
if (id.includes('leaflet')) return 'vendor-maps';
```

Problems:
1. The `react` core package files live at paths like `node_modules/react/index.js` and `node_modules/react/cjs/react.production.min.js`. `id.includes('react/')` *does* match those, but it **also matches** `react-leaflet/`, `react-hook-form/`, `react-day-picker/`, `react-markdown/`, `react-resizable-panels/`, etc., dumping unrelated packages into `vendor-react` and making React-dependent packages evaluate before `React` is ready when they're in *other* chunks (`vendor-maps`, `vendor-forms`, `vendor-misc`).
2. `react-leaflet` falls into `vendor-maps` via the leaflet rule and tries to read `React.createContext` before `vendor-react` has finished initialising — Rollup can't guarantee evaluation order across chunks for circular-ish vendor graphs, hence the TDZ crash.

### A. Rewrite `manualChunks` so React + every `react-*` peer ship in ONE chunk

Use precise package-name matching against the path segment after `node_modules/`. All React ecosystem packages (anything whose package name is `react`, `react-dom`, `scheduler`, or starts with `react-`) go into `vendor-react`. Leaflet (the non-React core) stays in `vendor-maps`. Same for `recharts` (it imports React → must be in `vendor-react` OR allow recharts to live with React; simpler: keep it in `vendor-charts` but it will work as long as React loads first — which it now will, because `vendor-react` is referenced by `index-*.js` first).

```ts
manualChunks(id) {
  if (!id.includes('node_modules')) return;
  // Extract the package name after the LAST node_modules/
  const after = id.split('node_modules/').pop()!;
  const pkg = after.startsWith('@')
    ? after.split('/').slice(0, 2).join('/')   // scoped: @scope/name
    : after.split('/')[0];                     // plain: name

  // React and every React-dependent peer in ONE chunk → guarantees
  // React is initialised before any consumer evaluates.
  if (
    pkg === 'react' ||
    pkg === 'react-dom' ||
    pkg === 'react/jsx-runtime' ||
    pkg === 'scheduler' ||
    pkg.startsWith('react-')          // react-router, react-leaflet, react-hook-form, react-day-picker, react-markdown, react-resizable-panels, react-dom, etc.
  ) return 'vendor-react';

  if (pkg.startsWith('@radix-ui') || pkg === 'lucide-react' || pkg === 'cmdk') return 'vendor-ui';
  if (pkg.startsWith('@supabase')) return 'vendor-supabase';
  if (pkg.startsWith('@tanstack')) return 'vendor-query';
  if (pkg === 'recharts' || pkg.startsWith('d3-')) return 'vendor-charts';
  if (pkg === 'pdfjs-dist' || pkg === 'jspdf' || pkg === 'html2canvas') return 'vendor-pdf';
  if (pkg === 'leaflet') return 'vendor-maps';   // pure leaflet only; react-leaflet now lives in vendor-react
  if (pkg === 'date-fns' || pkg === 'zod') return 'vendor-forms';
  return 'vendor-misc';
}
```

Note: `lucide-react` matches `pkg.startsWith('react-')`? No — its name is `lucide-react`, doesn't start with `react-`, so it correctly stays in `vendor-ui`. ✅

### B. Build & verify locally

1. Run `npx vite build` — confirm no warnings about cross-chunk circular deps and that `dist/assets/vendor-react-*.js` now contains both `react` and `react-leaflet` (grep output, or check chunk sizes — `vendor-react` will grow ~80 KB).
2. Confirm bundle still under publish limit (each chunk < 1 MB; total precache < 5 MB). With React ecosystem consolidated, `vendor-react` should be ~350-450 KB — well below the cap.
3. `npx vite preview` and load `/` — no `createContext` error in console.

### C. Publish & smoke-test

1. Click Publish → Update.
2. Visit `https://iamgood.lovable.app/` in a fresh incognito window → React app mounts, no white screen.
3. Open `/journey` (uses react-leaflet) → map renders.
4. Open `/dashboard` → existing kill-switch in `src/main.tsx` will unregister stale SWs and reload once, then the app works on the next load for users who had the broken build cached.

### What I will NOT change

- No DB / RLS / edge function / feature changes.
- No new dependencies.
- Service worker, kill-switch, base path, lazy routes — all untouched (already correct).
- Only `vite.config.ts` `build.rollupOptions.output.manualChunks` is modified.

