# Apply uploaded phone-normalisation and Install-page fixes

Two targeted file changes, exactly as supplied in the uploads.

## 1. `toE164` in `src/lib/countryCodes.ts`

Replace only the `toE164` function body (lines 222-228). Everything else in the file — the country list, `findCountryByPhone`, `isValidE164`, `DEFAULT_DIAL` — stays byte-identical.

New behaviour:
- Input already starting with `+` → sanitise digits, return as-is.
- Digits-only string of 12 digits starting with `91` → return `+<digits>` (no double prefix). This is the bug fix: phones stored as `919876543210` previously became `+91919876543210`.
- Bare national number → prepend the fallback dial code.

## 2. `src/pages/Install.tsx`

Replace the whole file with the uploaded version. The only functional difference from the current page:

- The in-app-browser (WhatsApp/Instagram/Facebook webview) redirect now fires automatically on mount after a 600 ms delay, instead of waiting for a tap.
- The warning card copy changes to "Opening in Safari/Chrome…" with an explanatory line, and the button becomes a manual fallback ("Open in Safari/Chrome now").

Everything else — guardian token stashing, auto-accept for signed-in guardians, SEO meta, iOS/Android install instructions — is unchanged.

## Notes

No backend, routing, or dependency changes. After the edits I will run a TypeScript check to confirm the build is clean.
