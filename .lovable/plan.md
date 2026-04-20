

## Plan — Finish parked issues 1, 2, 3

Three approved-but-not-yet-implemented fixes, executed in one batch.

---

### Issue 1 — Reminder overlay re-fires after user taps action button

**Root cause:** `handleAction` in `ReminderOverlay.tsx` uses `window.location.href` → full page reload → in-memory acknowledgement state (`acknowledgedRef`, `showCountRef`) and alarm-hook throttling state (`postGraceRef`, `missedSentRef`, `firedRef`) are wiped → next 30s tick re-fires the same popup.

**Fix:**
- `src/components/ReminderOverlay.tsx`
  - Replace `window.location.href = "/path"` with `useNavigate()` from `react-router-dom` so the React tree (and in-memory refs) survives the action.
  - Before navigating, persist the slot acknowledgement to `sessionStorage` via the existing `saveAckSet()` helper using the `slotKey` passed in by the firing hook. Also write a 2-minute "post-action suppression" entry via `saveSuppressMap()` so even hooks that re-mount won't re-fire immediately.
  - Export `isReminderAcknowledged(slotKey)` and `isReminderSuppressed(slotKey)` helpers (acknowledgement helper already exists per file summary — confirm and add suppression helper if missing).
  - On `handleDismiss` keep current behavior (does NOT acknowledge — only acknowledgement-via-action stops the cadence).

- `src/hooks/useMedicationAlarms.ts`
  - Pass `slotKey: \`med-${dateKey}-${timeSlot}\`` into every `showReminderOverlay()` call.
  - Before firing the T+5 / T+15 / T+25 popup, skip if `isReminderAcknowledged(slotKey)` is true.

- `src/hooks/useCheckInAudio.ts`
  - Already passes `slotKey: \`checkin-${dateKey}-${h}\`` and already checks `isReminderAcknowledged` (per file content). Verify the same `slotKey` shape is used inside `ReminderOverlay`'s `handleAction` when persisting.

- `src/hooks/useExerciseReminder.ts` and `src/hooks/useAppointmentAlarms.ts`
  - Add `slotKey` to their `showReminderOverlay` calls (e.g. `exercise-${dateKey}-${h}`, `appt-${appointmentId}-${alertLabel}`) and check `isReminderAcknowledged` before re-firing — for consistency, even though the bug was reported on med + check-in.

**Out of scope:** Changing the T-5 / T+5 / T+15 / T+25 cadence; server-side missed-checkin guardian cron.

---

### Issue 2 — Guardian AQI widget shows "--" because it asks for guardian's own location

Already shipped per prior summary (`src/components/AQIWidget.tsx` updated to use ward's `lastLocation` from `user_settings`). **Verification step only:**

- Re-read `src/components/AQIWidget.tsx` to confirm:
  - `role === "guardian"` branch skips `navigator.geolocation`.
  - Reads `wardUserId` from `useGuardianWard()` and queries `user_settings.settings.lastLocation`.
  - Re-fetches when `wardUserId` changes (effect dep).
  - Shows "Ward location not shared yet" fallback inside the popover.
  - Search box and 10-min revert timer are disabled for guardians.
- If any of the above are missing, patch them. If all present, no code changes — just confirm in the response.

---

### Issue 3 — FAQ refresh, Smart Ring visual, downloadable FAQ document

Already shipped per prior summary (`smart-ring.png` created; `Subscription.tsx`, `faqData.ts`, `Help.tsx` updated). **Verification step only:**

- Re-read the four files to confirm:
  - `src/assets/smart-ring.png` exists and is non-empty (the diff at the top of this turn shows the binary was actually written — good).
  - `src/data/faqData.ts` has `FAQ_VERSION = "2026-04-20"` and the two new sections (`Quick Visual Checks`, `Premium Plus & Smart Ring`).
  - `src/pages/Subscription.tsx` renders the Smart Ring hero block in the Premium Plus card with "Coming Soon" badge + caption, and the `Quick Visual Checks` feature with sub-line.
  - `src/pages/Help.tsx` `handleDownloadFaq` builds Markdown from `faqSections` and triggers download as `Check-iN-FAQ-2026-04-20.md`; `Crown` icon is in `iconMap`.
- Patch any gaps; otherwise just confirm.

---

### Files to edit (Issue 1, definitely)

- `src/components/ReminderOverlay.tsx` — `useNavigate` instead of `window.location.href`; persist ack + suppression on action; export suppression helper.
- `src/hooks/useMedicationAlarms.ts` — pass `slotKey`, check ack before re-firing.
- `src/hooks/useExerciseReminder.ts` — pass `slotKey`, check ack.
- `src/hooks/useAppointmentAlarms.ts` — pass `slotKey`, check ack.
- `src/hooks/useCheckInAudio.ts` — verify slotKey shape matches what overlay persists.

### Files to verify (Issues 2 & 3) — patch only if gaps found

- `src/components/AQIWidget.tsx`
- `src/data/faqData.ts`
- `src/pages/Subscription.tsx`
- `src/pages/Help.tsx`
- `src/assets/smart-ring.png`

### Out of scope

- International rollout (parked).
- Per-user timezone refactor.
- PDF (vs. Markdown) FAQ export.

