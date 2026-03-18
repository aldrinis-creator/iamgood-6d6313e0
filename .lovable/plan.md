

## Link Cookie Settings to Re-open Consent Banner

**Edit `src/components/CookieConsent.tsx`:**
- Export a way to force-show the banner: add a `forceShow` prop or use a global event
- Simplest approach: accept an optional `forceShow` boolean prop + an `onClose` callback
- When `forceShow` is true, show the banner regardless of localStorage

**Edit `src/components/AppLayout.tsx`:**
- Add state `showCookieSettings` 
- Wire the footer "Cookie Settings" button's `onClick` to set it true
- Pass `forceShow={showCookieSettings}` and `onClose` to `<CookieConsent />`

