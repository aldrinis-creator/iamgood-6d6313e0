## Goal

Rewrite the Privacy Policy to be fully compliant with India's Digital Personal Data Protection Act, 2023 (DPDP Act), using the inputs you provided.

## Inputs captured

- **Grievance Officer:** Aldrin Alphonso — +91 70458 68482 — [checkin_support@futurewave.in](mailto:checkin_support@futurewave.in)
- **Cross-border transfer:** None (all data stored within India)
- **Retention:** 90 days after account deletion
- **Children's data:** Not applicable (app is not intended for users under 18)

## Files to update

1. `src/pages/PrivacyPolicy.tsx` — replace the `sections` array with the full DPDP-compliant content.
2. `src/pages/Help.tsx` — replace the inline Privacy section (the array inside the `activeTab === "privacy"` block) with the same content so both views stay in sync.

No new files, no schema/backend changes, no route changes.

## New section structure (16 sections)

1. **About This Policy & DPDP Act 2023 Compliance** — Check-iN by Future Wave; complies with DPDP Act 2023 and IT Rules 2011 (SPDI).
2. **Our Role as Data Fiduciary** — Future Wave is the Data Fiduciary; processors (Lovable Cloud, MSG91, Razorpay) act as Data Processors under contract.
3. **Information We Collect** — identity (name, phone), health (medications, vitals, vault documents, face/tongue/urine scans), location (SOS, journeys, geofencing), guardian/nominee details, device & usage data.
4. **Sensitive Personal Data** — explicit classification of health, biometric and location data as sensitive; handled with enhanced safeguards.
5. **Purpose & Legal Basis** — purposes (emergency response, medication reminders, guardian alerts, health insights); legal basis is your consent at registration and feature opt-in.
6. **How We Use Your Data** — operational uses; no sale to third parties; no advertising profiling.
7. **Data Sharing** — guardians you nominate, emergency services on SOS, processors (Lovable Cloud, MSG91 for SMS/WhatsApp/OTP, Razorpay for payments) — all under DPDP-aligned contracts.
8. **Data Storage & Location** — all personal data stored on servers located within India; no cross-border transfers.
9. **Data Security** — encryption in transit (TLS) and at rest, Row-Level Security, signed URLs for vault, OTP-based auth, role-based access.
10. **Data Retention** — active account: retained while account is active; after deletion request: erased within **90 days** except where law requires longer retention (e.g., financial/transaction records).
11. **Your Rights as Data Principal (DPDP §11–14)** — right to access, correction, erasure, grievance redressal, nomination (in case of death/incapacity), and withdrawal of consent.
12. **Withdrawing Consent** — how to withdraw via Settings → Account, and consequences (loss of emergency features).
13. **Cookies & Local Storage** — session, preferences, analytics; managed via in-app Cookie Settings.
14. **Children's Data** — service is not intended for users under 18; no knowing collection of children's data.
15. **Grievance Officer (DPDP §8(9))** — Aldrin Alphonso, +91 70458 68482, [checkin_support@futurewave.in](mailto:checkin_support@futurewave.in); response within 30 days.
16. **Changes to This Policy & Contact** — material changes notified in-app; contact Future Wave at [checkin_support@futurewave.in](mailto:checkin_support@futurewave.in).

## SEO

Keep existing `SeoMeta` ("DPDP Act compliant" already in description). No change.

## Out of scope

- No changes to Terms of Service, registration consent checkboxes, account deletion flow, or backend retention jobs. (Happy to follow up with: an explicit "I consent" checkbox at signup, a Settings → Account "Delete my data" action, and a scheduled 90-day purge job — say the word.)  
  
Can this also include GDPR compliance?
  &nbsp;