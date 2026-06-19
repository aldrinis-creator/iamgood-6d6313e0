## Goal

In the Guardian app's Hospital Admission Kit:

1. Remove the Doctor Visit Report attachment (UI tile + PDF section + nudge).
2. Add a new **Ward Profile Snapshot** section to the PDF and the on-screen kit, pulling six groups from the Ward's My Profile.
3. Restrict the entire Hospital Admission Kit (card on dashboard + Hospital Visit tab actions) so only the **Primary Guardian** for that ward can see/use it.

## Profile Snapshot — fields per section

Mirrors the Ward's My Profile screen, sourced from the same tables MyProfile already reads.

1. **Personal Information** — `profiles`: full_name, date_of_birth (+ age), phone, gender
2. **Current Medications** — `medications`: name, dosage, frequency, remaining/total stock
3. **Body Metrics** — `health_profile` / persona: weight_kg, height_m, BMI (computed)
4. **Body & Health** — `health_profile` + `nutrition_personas`: blood_group, diet_type, allergies, medical_conditions, activity_level, smoking, alcohol, dietary_preferences, health_goals
5. **Past Medical History** — `medical_history`: hospitalizations + surgeries (reason, hospital, dates, treatment/advice)
6. **Family Doctor** — `health_profile`: doctor_name, doctor_phone

Empty fields render as `—`; empty whole sections still render with a "No data" note so the printed kit is self-documenting.

## Changes

### `src/lib/admissionKitPdf.ts`

- Remove `doctorVisitReport` field from `AdmissionKitInput` and its PDF section.
- Add `profileSnapshot?: ProfileSnapshot` field with the six grouped objects above.
- After the cover/documents pages, render a "Ward Profile Snapshot" section: navy header band, one A4 page per group (or grouped with auto-pagination), label/value rows reusing the existing layout helpers.

### `src/components/guardian/HospitalVisitTab.tsx`

- Drop `doctorReport` state, `fetchDoctorReport`, the "Latest Doctor Visit Report" card, the View Report dialog, and the nudge-for-report flow.
- In `buildKit`, replace the doctor-report fetch with parallel queries to `profiles`, `health_profile`, `nutrition_personas`, `medications` (active only), and `medical_history`, then assemble `profileSnapshot` and pass it to `buildAdmissionKitPdf`.
- Add an on-screen "Ward Profile Snapshot" card listing the six section names with a small status badge (filled vs. empty) so the guardian can see what will be in the PDF before downloading. Re-use the existing realtime channel to refresh when ward data changes (extend filter to the new tables).

### `src/components/guardian/HospitalKitCard.tsx`

- Remove the `hasDoctorReport` query and the "Doctor Visit Report: ready/missing" line.

### Primary-Guardian gating

- Add a small helper `useIsPrimaryGuardian(wardUserId)` (or inline check) that queries `guardians` for `guardian_user_id = auth.uid()`, `user_id = wardUserId`, `is_primary = true`, `status = 'accepted'`.
- In `GuardianDashboard.tsx`, only render `<HospitalKitCard>` when the check returns true.
- In `HospitalVisitTab.tsx`, if not primary, render a single card: "Only the Primary Guardian can access the Hospital Admission Kit for {wardName}." and skip all fetches.
- No backend RLS change required — all reads are already scoped by the existing accepted-guardian policies; the gate is a UX restriction so non-primary guardians don't see or trigger kit downloads.

## Out of scope

- No changes to the Ward's My Profile UI or schema.
- No changes to the WhatsApp share flow other than it now sends the new PDF contents.
- The Doctor Visit Report in Health Tools (Ward side) is untouched.

## Verification

- Sign in as Primary Guardian → Hospital Admission Kit card visible on dashboard; Hospital Visit tab shows the six-section snapshot card; downloaded PDF contains cover → ID/insurance images → Ward Profile Snapshot (6 sections); no Doctor Visit Report anywhere.
- Sign in as a non-primary accepted Guardian → kit card hidden on dashboard; visiting `/guardian/reports?section=hospital_visit` shows the restriction notice.
- Ward with sparse profile → snapshot still renders, empty fields show `—`.

Ensure that the PDF downlaod is clear and there is no garbled data. Same with the Share command as Guardians should be able to share the PDF with whoever they choose.