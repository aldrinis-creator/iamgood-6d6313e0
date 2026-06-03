## Goal

Make every "Privacy Policy" link in the app open the latest Privacy Policy as a PDF, sourced from your Google Doc, instead of the in-app `/privacy-policy` page.

## External URL used

The Google Doc ID is `1Rp2aUGX1MF-p3w9vVD5_rzXPMzt6ChpM`. We'll use Google Docs' built-in PDF export endpoint (no Drive/Docs connector needed — works for any "Anyone with the link" doc):

```
https://docs.google.com/document/d/1Rp2aUGX1MF-p3w9vVD5_rzXPMzt6ChpM/export?format=pdf
```

This downloads/opens the PDF directly. **You must set the doc sharing to "Anyone with the link → Viewer"** in Google Docs for it to work for end users — otherwise they'll see a sign-in screen.

## Files to update

1. **`src/components/AppLayout.tsx`** (line 96) — footer "Privacy Policy" link → change `<Link to="/privacy-policy">` to `<a href="…export?format=pdf" target="_blank" rel="noopener noreferrer">`.
2. **`src/components/CookieConsent.tsx`** (line 35) — cookie banner Privacy Policy link → same swap.
3. **`src/pages/Settings.tsx`** (lines 257, 272) — two links ("View Privacy Policy" button + "View your rights…" link) → both point to the external PDF.
4. **`src/pages/Help.tsx`** — the Privacy tab currently renders 16 inline sections. Replace with a short notice + a single "Download Privacy Policy (PDF)" button that opens the external URL. Removes ~30 lines of duplicated policy text.
5. **`src/pages/PrivacyPolicy.tsx`** — convert to a lightweight redirect page: on mount, `window.location.replace(externalUrl)` and show a "Opening Privacy Policy…" fallback with a manual link. This keeps the `/privacy-policy` route working (in case the URL is shared/bookmarked, in emails, or hit by crawlers) but immediately hands users the PDF.
6. **`src/App.tsx`** — no change; route stays mapped to the (now-redirecting) `PrivacyPolicy` page.

## Centralisation

Add a small constant in `src/lib/utils.ts` (or a new `src/lib/legal.ts`):
```ts
export const PRIVACY_POLICY_PDF_URL =
  "https://docs.google.com/document/d/1Rp2aUGX1MF-p3w9vVD5_rzXPMzt6ChpM/export?format=pdf";
```
All five call sites import from this constant so future updates are one-line.

## SEO note

The standalone `/privacy-policy` page currently has `SeoMeta` for crawlers. After the redirect change, crawlers will still index the route but the visible content will be a "Opening…" stub. That's acceptable since the canonical policy now lives in the Google Doc PDF. If you want stronger SEO, we can keep the in-app HTML version visible for crawlers and only show the download button to users — let me know and I'll adjust.

## Out of scope

- The pre-generated `CheckiN-Privacy-Policy.pdf` artifact stays as-is; the app will not use it (the Google Doc export is the live source of truth).
- No backend, RLS, or auth changes.
- `TermsOfService.tsx` is untouched (it only mentions "Privacy Policy" in body text, no link).
