

## Plan — Verify PWA icon files exist

### What I'll do

1. Check `/public` for `pwa-192x192.png` and `pwa-512x512.png` (the two icons referenced by the manifest in `vite.config.ts` and the `apple-touch-icon` in `index.html`).
2. If both exist → confirm install works on iOS and Android, no changes needed.
3. If either is missing → generate proper PNG icons from the existing app branding (Check-iN navy `#1a3a5c`) at 192×192 and 512×512, save to `/public`, and ask you to re-publish so Android's install prompt and iOS's home-screen icon both render correctly.

### What I will NOT change

- No edits to `vite.config.ts`, `index.html`, manifest, or service worker — all already correct.
- No new dependencies, no DB / edge function / feature changes.

### Action

Approve and I'll check the files and (only if needed) generate and save the missing icons.

