## Problem
The full data-sharing pipeline (My Profile uploads → `medical_records` → Guardian Admission Kit) is built and RLS works. But guardians can't actually find or see the uploads because:

1. **Hidden entry point** — Hospital Visit is the 7th sub-tab inside *Reports*, with no surfacing on the Guardian Dashboard.
2. **No live refresh** — `HospitalVisitTab` fetches once on mount. If the guardian has the screen open while the ward uploads, nothing updates.
3. **No "what to do next" signal** — guardians never see a hint that docs are ready or missing.

## Fix (UI/UX only — no schema, no RLS changes)

### 1. New `HospitalKitCard` on Guardian Dashboard
A compact card placed in the Monitor section of `GuardianDashboard`:
- Icon + "Hospital Admission Kit"
- Badge: `X/5 docs ready`
- One primary button: **Open Kit** → routes to `/guardian/reports?section=hospital_visit`
- If `X < 5`: secondary ghost button **Nudge {wardName}** (reuses existing `insert_notification_deduped` RPC)
- If `X = 0`: muted helper text "Ask {wardName} to upload Aadhaar, PAN, Insurance & Photo in My Profile"

Counts pulled with a single `select count(record_slot)` query filtered by `wardUserId` and `record_slot is not null`.

### 2. Deep-link support in `GuardianReports`
Read `?section=` from `useSearchParams` on mount and set `activeSection` accordingly. Today it always defaults to `medications`.

### 3. Realtime subscription in `HospitalVisitTab` and `HospitalKitCard`
Subscribe to `postgres_changes` on `medical_records` filtered by `user_id=eq.{wardUserId}` (per Core memory: must include `filter`). On any INSERT/UPDATE/DELETE for that ward, re-run `fetchRecords()`. Unsubscribe on unmount.

### 4. Tiny copy nudge in `IdInsuranceSection` (My Profile)
Update the existing subheading from "Your guardian can share them with the hospital in one tap" to make it explicit: "Your guardians instantly see these in their app under Reports → Hospital Visit." No layout change.

## Files

**Edit**
- `src/pages/GuardianDashboard.tsx` — mount new `<HospitalKitCard wardUserId={...} wardName={...} />` in Monitor section
- `src/pages/GuardianReports.tsx` — parse `?section=` query param to seed `activeSection`
- `src/components/guardian/HospitalVisitTab.tsx` — add realtime subscription with `filter: user_id=eq.${wardUserId}`
- `src/components/profile/IdInsuranceSection.tsx` — copy tweak in the CardHeader subtext

**Create**
- `src/components/guardian/HospitalKitCard.tsx` — dashboard summary card + nudge action + realtime live counter

## Out of scope
- No DB migration, no new RLS, no new storage buckets, no edge function
- No new guardian-initiated upload flow (you rejected that earlier — only ward uploads in My Profile)
- No change to `HospitalVisitTab` core layout, Admission Kit PDF builder, or WhatsApp share
