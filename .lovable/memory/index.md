# Memory: index.md
Updated: now

Design system: Navy Blue primary (213 53% 23%), Emerald Green success (160 84% 39%), Red SOS (0 84% 60%)
Mobile-first layout, max-width 430px centered
Two user roles: "user" (protected person) and "guardian" (family/responder)
Font sizes minimum 18px on User Dashboard for accessibility
App name: Check-iN — Personal Emergency Response System
Indian market: INR pricing, +91 phone codes, Razorpay payments
Subscription tiers: Basic ₹99/mo or ₹999/yr, Pro ₹199/mo or ₹1999/yr
Ambulance pricing: ₹1500 first 5km, ₹300/km after
Default check-in times: 7AM, 12PM, 7PM
"Prescription" renamed to "Doctor's Diagnosis" everywhere (record_type, UI labels, vault categories)
Reports use browser print-to-PDF via src/lib/reportPdf.ts with WhatsApp/Email sharing
ReportShareButtons component reusable across all report views
Services page lives at /services (user role) accessed from profile dropdown menu in AppHeader, not from My Health tiles
- [Urine Check](mem://features/urine-check) — Photo-based urine colour + 10-pad dipstick screening with red-flag escalation. Top-level tile in My Health.
- [Pill Identifier](mem://features/pill-identifier) — Photo-based pill ID with prescription cross-check, banned-drug detection, guardian alerts on mismatch
- [Tongue Analysis](mem://features/tongue-analysis) — Photo-based tongue screening with coating/colour/surface analysis and guardian alerts on red flags
- [MMJ Safety Net](mem://features/mmj-safety-net) — Map My Journey safety: low-battery guardian alert, auto-SOS escalation on unanswered route deviation, public live-tracking share link.
- [Guardian Settings & Help](mem://features/guardian-settings-help) — Dedicated /guardian-settings & /guardian-help pages; /help auto-routes by role; guardians table semantics (user_id=ward, guardian_user_id=guardian)
- [Guardian Invite Escalation](mem://features/guardian-invite-escalation) — Install-first invite links, accept/install confirmations to ward, 3 daily reminders then ward alert

