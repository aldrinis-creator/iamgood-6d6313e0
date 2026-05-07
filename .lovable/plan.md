# Shared Appointments for Guardian + Ward

Guardians can already create appointments on behalf of their ward (via Services → Book Appointment), and RLS already lets both sides read the same row set. Today the guardian has nowhere to *view* the combined list, and neither side can tell who added what. This plan closes both gaps.

## 1. Database (one migration)

- Add `created_by uuid` (nullable) to `public.appointments`. Backfill existing rows with `user_id`.
- Add two RLS policies on `appointments`:
  - **Guardians can update ward appointments** — `UPDATE` where an accepted `guardians` row links `auth.uid()` to `appointments.user_id`.
  - **Guardians can delete ward appointments** — same condition for `DELETE`.
- Existing policies (ward owns/insert/update/delete; guardian select/insert) stay untouched.

## 2. AddAppointmentDialog

- Accept an optional `wardUserId` prop. When set, insert with `user_id = wardUserId` and `created_by = session.user.id`; otherwise `user_id = created_by = session.user.id` (current behaviour).
- On update, leave `created_by` unchanged.
- Suppress the appointment-confirmation email when the actor is a guardian (the ward will get system notifications via the existing channels).

## 3. New page: `/guardian/appointments`

- Reuses the `Appointments.tsx` layout but scoped to `selectedWard.userId` from `GuardianWardContext`.
- Top of page: `WardPicker` so the guardian can switch wards.
- Each card shows an "Added by you" / "Added by {ward name}" chip driven by `created_by`.
- Edit and delete buttons available on every row (full parity); delete uses the standard `AlertDialog` confirmation.
- "Add Appointment" button opens `AddAppointmentDialog` with `wardUserId={selectedWard.userId}`.
- Route registered in `App.tsx` behind `ProtectedRoute`.

## 4. Guardian Dashboard strip

- New compact "Today's Appointments" card placed in the Monitor band (between Today's Check-iNs and Medications Summary, slot 8.5 in the existing layout).
- Shows count badge + next appointment title/time for the selected ward; tap routes to `/guardian/appointments`.
- Renders nothing if zero appointments today (no empty footprint).
- Uses the existing `useTodayAppointments` pattern adapted for a ward id (new hook `useWardTodayAppointments(wardUserId)`).

## 5. Ward-side update (`Appointments.tsx`)

- No structural change. Render the same "Added by {guardian name}" chip when `created_by !== user_id`. Resolve the guardian name via the `guardians` table (one lookup per page load, cached).

## 6. Memory updates

- `mem://features/guardian-dashboard` — add the new "Today's Appointments" strip to the layout list.
- `mem://style/navigation-hierarchy` — add `/guardian/appointments` route entry.

## Out of scope

- Recurring-appointment expansion logic (already handled by existing field).
- Push notifications to the ward when a guardian adds an appointment (separate enhancement).
- Cross-ward "all my wards" combined view — single ward at a time via `WardPicker`.

## Verification

- Guardian adds appointment from new page → ward sees it in their Appointments page tagged "Added by {guardian name}".
- Ward adds appointment → guardian sees it in `/guardian/appointments` tagged "Added by {ward name}".
- Either side can edit/delete; delete prompts `AlertDialog`.
- Dashboard strip appears only when ward has appointments today; count matches list.
- Switching wards in `WardPicker` updates list and dashboard strip.
