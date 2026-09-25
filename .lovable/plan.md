# Vitals: "Your Health Vitals" trend report + 1-month retention + paid storage; hide 4 Health Tools

## 1. Replace "Get AI Insights" with "Your Health Vitals"
- In the Vitals Monitor (Ward) and the Guardian's ward vitals card, the "Get AI Insights" button becomes "Your Health Vitals". No AI call is made any more.
- Tapping it opens a trend report built only from the ward's own readings (last 30 days):
  - Charts for heart rate, SpO2, blood pressure, sugar, temperature, steps, sleep, stress.
  - For each: latest, average, lowest, highest, and a simple "going up / steady / going down" arrow versus the previous week.
  - Readings outside normal ranges highlighted in red/amber (fixed ranges, not AI).
- Under the report: the usual PDF / Print, WhatsApp and Email buttons, plus "Save to Secure Vault", which stores the report under the Vault's Reports area in a new "Vitals" tab.

## 2. Keep vitals data for 1 month only
- A daily check deletes vitals readings (activity/vitals logs, face scans, pulse sessions) older than 30 days, for users without paid extra storage. Saved Vault reports are not deleted.
- Warnings before deletion (in-app notification + push):
  - 7 days before, 2 days before, and 1 hour before on the day of deletion.
  - Message: "Vitals data older than a month will be deleted on [date]. Keep it by adding Extra Storage for ₹99/month." with a button to buy.
- Because data rolls daily, warnings are sent per upcoming batch at most once per stage (no repeats).

## 3. Extra Storage — ₹99/month
- New "Extra Vitals Storage" add-on on the Subscription page and from the warning button.
- Uses the app's existing payment route (futurewave.in/pay with Razorpay confirmation), recorded as its own subscription line so it works alongside Basic/Pro/Premium Plus.
- While active, no vitals data is deleted and no warnings are sent. If it lapses, the 30-day rule resumes with the warnings first.

## 4. Hide 4 Health Tools
- Remove Document Analyzer, Symptom Checker, Medication Info and Tele-Consult from the Health Tools list. Their code stays in place; old links to them open the Health Tools list instead.

## Technical details
- VitalsMonitor.tsx / WardVitalsSummary.tsx: drop `vitals_insights` invoke; new `VitalsTrendReport` component (recharts) + ReportShareButtons + insert into `medical_records` with record_type "Vitals Report"; add "Vitals" tab mapping in vaultCategories.
- Migration: `vitals_retention_notices` (user_id, purge_date, stage, sent_at, unique) with GRANTs + RLS; storage add-on as `subscriptions.plan_type = 'vitals-storage'` (monthly, 9900 paise) — useSubscription ignores it for tier.
- Edge function `vitals-retention` (cron hourly via invoke_edge_fn): sends 7d/2d/1h notices via insert_notification_deduped + push, then deletes rows older than 30 days IST for non-storage users.
- Razorpay webhook: accept plan `vitals-storage`.
- MyHealth.tsx: filter the four labels out of the tool list; redirect `?tool=` for them to Health Tools.
