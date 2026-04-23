

## Plan — Fix "build failed with exit status 1: limit error" on Publish

The publish error is a **bundle/precache size guard** failing on the publish pipeline. Local `vite build` succeeds, but the main JS chunk is **3.18 MB** (one single file), which trips the publisher's per-file limit even though our PWA precache cap is set to 5 MB.

The fix is to code-split the giant main chunk into smaller, route-based chunks. No feature changes, no DB changes.

### A. Add `manualChunks` to `vite.config.ts`

Inside the existing `defineConfig`, add a `build.rollupOptions.output.manualChunks` function that groups vendor and feature code into separate files. Target: no chunk over ~800 KB.

```ts
build: {
  chunkSizeWarningLimit: 1000,
  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes('node_modules')) {
          if (id.includes('react-dom') || id.includes('react/') || id.includes('react-router')) return 'vendor-react';
          if (id.includes('@radix-ui') || id.includes('lucide-react') || id.includes('cmdk')) return 'vendor-ui';
          if (id.includes('@supabase')) return 'vendor-supabase';
          if (id.includes('@tanstack')) return 'vendor-query';
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('pdfjs-dist') || id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-pdf';
          if (id.includes('leaflet')) return 'vendor-maps';
          if (id.includes('date-fns') || id.includes('zod') || id.includes('react-hook-form')) return 'vendor-forms';
          return 'vendor-misc';
        }
      },
    },
  },
},
```

### B. Fix the broken dynamic-import warnings

The build log shows 4 modules dynamically imported in one place but statically imported in another, which **prevents code-splitting**. Standardise to static imports (since they're loaded by app shell anyway):

- `src/pages/Settings.tsx` → change dynamic `import("@/hooks/useFallDetection")`, `import("@/hooks/useSubscription")`, `import("@/lib/featureGating")` to top-level static imports.
- `src/contexts/AppContext.tsx` → change dynamic `import("@/lib/offlineQueue")` to a static import.

This silences the warnings and lets Rollup put each vendor/feature in the correct chunk we defined above.

### C. Lazy-load heavy admin & legal pages via `React.lazy`

In `src/App.tsx`, wrap the admin and rarely-used routes with `React.lazy()` + `<Suspense>` so they ship as separate chunks instead of bloating the main one:

- `AdminLogin`, `AdminVerify`, `AdminContacts`, `AdminCoupons`, `AdminWaitlist`, `AdminVaultClaims`
- `VaultClaim`, `PublicJourneyView`, `Unsubscribe`, `PrivacyPolicy`, `TermsOfService`, `Help`, `Install`, `ResetPassword`

Keep `UserDashboard`, `GuardianDashboard`, `Login`, `Register`, `Index` eager (hot path).

### D. Verification

1. Run `npx vite build` locally → confirm the main chunk drops from 3.18 MB to under 1 MB and total precache stays under 5 MB.
2. Confirm no new warnings about "dynamic import will not move module into another chunk".
3. Click **Publish → Update** in the editor → success, no "limit error".
4. Smoke-test the live site: `/`, `/login`, `/register`, `/dashboard`, `/medical-vault`, `/admin/vault-claims`, `/vault-claim/<token>` all load (chunks fetched on demand are fine).

### What I will NOT change

- No feature, UI, DB, or edge-function changes.
- PWA precache cap stays at 5 MB; we just stop producing one giant chunk.
- No package additions or removals.

