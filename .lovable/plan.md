# Weekly medication day + WhatsApp invite template test

Two independent pieces of work.

## 1. "Once a Week" — pick the day

Today a medication only stores times of day, so a weekly medicine still shows up (and alarms) every day.

What changes for the user:
- In Add/Edit Medication, when Frequency is **Once a Week**, a day picker appears (Mon-Sun, single choice, defaults to today's weekday).
- The medicine then appears in Today's Schedule, the My Health due badge, alarms and guardian views **only on that weekday**.
- All other frequencies behave exactly as now (every day).

Technical notes:
- New nullable column `schedule_days smallint[]` on `medications` (0=Sun … 6=Sat). `null`/empty = every day, so existing rows are unaffected.
- Save/load the value in `MedicationList.tsx`; only set it when frequency is `once_weekly`, clear it otherwise.
- Add one shared helper (e.g. `isMedScheduledToday(med, istDate)`) and apply it everywhere a day's doses are computed, using IST weekday:
  - `src/components/medications/TodaySchedule.tsx`
  - `src/hooks/useMedicationAlarms.ts`, `src/hooks/useMedicationDue.ts`, `src/hooks/useLiveDashboardStats.ts`
  - `src/lib/mcp/tools/list-medications-today.ts`
  - guardian views: `WardMedicationStatus.tsx`, `WardMedicationAdherence.tsx`
  - edge functions: `check-missed-medications`, `send-medication-push` (so no false "missed medication" alerts on off-days)

## 2. Test the `guardian_app_downlaod` WhatsApp template

The invite currently uses `guardian_invite_app_downlaod` with 4 body variables. The new template has **3 body variables + a URL button**, so the payload shape differs.

Plan:
1. Add a small diagnostic edge function `msg91-wa-invite-test` that sends the new template exactly as in your curl: namespace `e67e5302_b6d0_403e_b3cc_8fa6e8accb01`, language `en`, `body_1 = guardian_name`, `body_2 = user_name`, `body_3 = relation`, `button_1 = {subtype:"url", type:"text", value: <token suffix>}`.
2. Send one live test to the nominated guardian's number and read back the full MSG91 response (request id, any error code) from the function logs.
3. If MSG91 accepts it and the message lands with a working button, switch `send-guardian-invite` over to `guardian_app_downlaod` (3 body vars + button) and retire the 4-body-variable call.

Open point I will confirm during the test: WhatsApp URL buttons carry only the **dynamic suffix** appended to the base URL registered in the template. If the template's button base URL is `https://iamgood.lovable.app/install?g=`, the button value must be just the nomination token. I will try the token first; if MSG91 rejects it, I will retry with the full link and report which one the template expects.

Needed from you: the phone number to send the live test to (e.g. Lira's +91 99671 34652, or another test number).
