# DPDP consent notice and Grievance Officer

## 1. Consent notice on sign-in and sign-up
- **Sign-in screen:** under the "Send OTP" button, add: "By continuing, you agree to our Terms of Service and Privacy Policy." Both phrases are tappable links (open in the same app, Back returns to sign-in).
- **Sign-up screen:** the same line under the "Next — Verify phone" button, so it shows before any code is sent.
- Also shown on the main sign-in screen near the Google / Apple buttons, since those also create accounts.
- Text stays readable (matches the existing note style, links underlined in green).

## 2. Grievance Redressal Officer
- **Terms of Service:** new section "Grievance Redressal Officer" — Name: Aldrin Alphonso; Organisation: Future Wave Technologies; Email: checkin_support@futurewave.in; complaints acknowledged and resolved within 30 days, as the DPDP Act requires.
- **Privacy Policy page:** the same officer details shown as a card below the "Download Privacy Policy (PDF)" button.
- **Settings > Privacy:** one line, "Grievance Officer: Aldrin Alphonso", with the email link.

## Not changed
- The Privacy Policy PDF itself — please update the PDF file with the officer's name separately (I can't edit it).
- Sign-in logic, OTP sending, and all existing behaviour.

## Technical details
- Files: `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/pages/TermsOfService.tsx`, `src/pages/PrivacyPolicy.tsx`, Settings privacy section.
- Links use react-router `Link` to `/terms-of-service` and `/privacy-policy`.
- Officer details kept in one shared constant so all three places stay in sync.
