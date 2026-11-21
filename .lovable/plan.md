# Use the uploaded Privacy Policy PDF

The uploaded document (CheckiN-Privacy-Policy_3_June_2026.pdf) already includes the Grievance Officer section (Aldrin Alphonso, 30-day resolution).

## What changes
- Host the uploaded PDF with the app instead of the Google Docs export link.
- The Privacy Policy link (sign-in, sign-up, Settings, Terms) opens this new PDF, same as today.
- The fallback page with the Download button and Grievance Officer card stays.

## Technical details
- Upload the PDF with `lovable-assets` to `src/assets/CheckiN-Privacy-Policy_3_June_2026.pdf.asset.json`.
- In `src/lib/legal.ts`, set `PRIVACY_POLICY_PDF_URL` to the asset's URL. No other files need changes.
