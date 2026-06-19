## Part 1 — Doctor Visit Report in Hospital Admission Kit (Guardian app)

Today the Ward generates a "Doctor Visit Report" in Health Tools and saves it to the Medical Vault (`medical_records` with `record_type = "Doctor's Diagnosis"`, title `Doctor Visit Report — <date>`). The Guardian's Hospital Admission Kit (`HospitalVisitTab.tsx`) currently shows only ID/insurance/photo slots — the doctor report is invisible there and is omitted from the PDF.

### Changes

1. `**src/components/guardian/HospitalVisitTab.tsx**`
  - Fetch the **latest** doctor visit report alongside the existing slot query:
   `medical_records` where `user_id = wardUserId` AND `record_type = "Doctor's Diagnosis"`, order by `record_date desc`, limit 1.
  - Render a new card above the ID slots: "Latest Doctor Visit Report" with date, View button (opens existing Dialog rendering the markdown `description`), and a Missing badge + "Nudge ward to generate report" action when none exists (uses `insert_notification_deduped`, type `doctor_report_missing`).
  - Realtime: existing channel already listens to `medical_records` for this ward — reuse it.
2. `**src/lib/admissionKitPdf.ts**` (and the kit builder in `HospitalVisitTab.buildKit`)
  - Add an optional `doctorVisitReport?: { dateISO: string; markdown: string }` field to the builder input.
  - When present, append a final section to the PDF titled "Doctor Visit Report — &nbsp;" rendering the markdown as plain text (existing jsPDF text flow; no images).
  - `buildKit()` passes the latest report fetched in step 1.
3. `**src/components/guardian/HospitalKitCard.tsx**` (dashboard summary card)
  - Include doctor-report presence in the ready/missing copy (e.g. "Missing: Insurance, Doctor Report") so the guardian sees it at a glance. No new count semantics — keep the existing `n/5 ready` for ID slots and add a single-line "Doctor report: ready / missing" below.

No DB schema, no edge function, no new RLS — guardian already has SELECT on the ward's `medical_records` via existing policy.

## Part 2 — One-tap "Call Guardian" for the Ward

Add a prominent call button on the Ward's dashboard that dials the primary guardian's phone via the device's native dialer (`tel:` href, same pattern used in `WardEmergencyCard` and SOS flows).

Add the Call button in the bottom menu in place of Messages. Move messages to the drop-down profile list. 

### Changes

1. **New `src/components/CallGuardianButton.tsx**`
  - Queries `guardians` for the current user: `is_primary = true`, `status = 'accepted'`, returns `guardian_name`, `guardian_phone`.
  - Fallback: if no primary, pick the first accepted guardian.
  - Renders a large green pill button: icon `Phone` + "Call &nbsp;".
  - On tap → `window.location.href = "tel:<E.164 normalized phone>"`.
  - Hidden when no accepted guardian exists (with a soft hint to nominate one).
  - Logs the action into `activity_logs` (`type: "guardian_call"`) for the Guardian's activity feed — best-effort, non-blocking.
2. **Place on Ward dashboard** (`src/pages/Index.tsx` or the user dashboard component, just below the SOS / check-in heart block per the established Alert → Act → Monitor hierarchy). Restricted to `role = 'user'` accounts only — guardians don't see it.  
the Call button in the bottom menu in place of Messages. Move messages to the drop-down profile list.
3. **No backend changes.** Phone is already on `guardians.guardian_phone`. No WhatsApp/MSG91 involved — pure native dialer.

### Optional follow-up (not in this plan unless you ask)

- Long-press to switch between multiple guardians. Ok
- Mirror the call event as a push notification to the guardian ("Ward is calling you now"). Ok

## Out of scope

- No changes to the Doctor Visit Report generator itself.
- No new PDF branding work; we reuse the existing admission-kit template.