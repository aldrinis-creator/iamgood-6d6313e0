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
