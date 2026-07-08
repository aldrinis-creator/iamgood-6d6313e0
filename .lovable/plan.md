Three focused fixes.

## 1. Voice assistant hallucination — "any meds due?" wrongly says all taken

**Root cause:** `gatherContext` in `supabase/functions/voice-query/index.ts` derives medication counts from `medication_logs` only. Newly scheduled doses that haven't been logged yet (the normal case for upcoming times) never appear, so `taken=0, pending=0, missed=0`, and the model concludes "all taken."

**Fix (`supabase/functions/voice-query/index.ts`):**
- In `gatherContext`, also fetch `medications` with `id, name, dosage, schedule_times, start_date, end_date` (active for today).
- Build the day's dose slots from `schedule_times` (one per time) in IST, mark each as `taken` / `taken_late` / `missed` / `pending` by matching against `medication_logs` (same medication_id + hour+minute) and comparing scheduled time to "now IST" with the existing 60-minute grace rule used by `WardMedicationStatus`.
- Replace `medications_today` with `{ total, taken, missed, pending, upcoming: [{name, dosage, time}], overdue: [{name, dosage, time}] }` derived from those slots.
- Tighten the system prompt: add an explicit rule + example — when asked "any meds due / pending / left today", answer from `medications_today.upcoming` (and `overdue` if any). If both are empty AND `total > 0`, then say all taken; if `total == 0`, say no medications are scheduled.

Guardian/product-assistant edge functions are unchanged.

## 2. Dashboard score display

`src/hooks/useLiveDashboardStats.ts`
- Change `medsTotal` from `medication_logs.length` to the sum of `schedule_times.length` across the user's active medications (start_date ≤ today, end_date null or ≥ today). This makes MEDS render as e.g. `2/5` reflecting the medication list, and it will fluctuate correctly as doses get logged.
- `medsCompleted` stays as logs with `status ∈ {taken, taken_late}`.

`src/pages/UserDashboard.tsx` (line 317)
- Render Health tile as `{stats.healthScore}<span class="text-[12px] text-white font-normal">/100</span>` to match the Check-ins / Meds `x/y` format.

No other score screens change.

## 3. Delete Nap timings

`src/pages/Settings.tsx` (Auto-Nap Schedule card, lines 722-744)
- Under the "Scheduled daily from … to …" row, add a small destructive-ghost "Clear nap schedule" button, visible only when `settings.napSchedule` is set.
- On click: show an `AlertDialog` confirmation ("Delete nap schedule? Auto-Nap will be turned off."). On confirm, call `updateSetting("napSchedule", null)` and `updateSetting("autoNapMode", false)`.
- Hide the "Scheduled daily…" row after clear (already conditional on `settings.napSchedule`).

`NapModeDialog` and `useAutoPauseModes` need no changes — both already treat a null `napSchedule` as "no nap window."

## Verification
- Voice assistant: ask "any medications due today?" for a user with 5 scheduled doses and 2 taken → answer names the pending ones. Ask again after logging all 5 → says all taken.
- Dashboard: with 5 schedule slots and 2 taken, Meds tile shows `2/5`; Health tile shows `<score>/100`.
- Settings: clear nap → schedule row disappears, `autoNapMode` toggles off, no auto-nap transition in `useAutoPauseModes`.
