

## Cookie Consent Banner

Add a dismissible cookie consent banner that appears on first visit, persisted via `localStorage`.

### Implementation

**New file: `src/components/CookieConsent.tsx`**
- Fixed banner at bottom of screen (above nav tabs), z-50
- Text: "We use cookies to improve your experience. By continuing, you agree to our use of cookies."
- Two buttons: "Accept" (primary/emerald) and "Reject" (outline)
- On either action, save choice to `localStorage` key `cookie-consent` (`accepted` | `rejected`) and hide banner
- On mount, check `localStorage` — if key exists, don't render

**Edit: `src/components/AppLayout.tsx`**
- Import and render `<CookieConsent />` inside the layout, before the closing `</div>`

Compact, mobile-friendly styling matching the existing design system. No other files affected.

