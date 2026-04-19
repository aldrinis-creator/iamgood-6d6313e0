---
name: Pill Identifier
description: Photo-based pill identification with prescription cross-check, banned-drug detection, and guardian alerts on mismatch
type: feature
---

# Pill Identifier

User photographs a pill → AI identifies it → cross-checks against active prescriptions and India's banned-drug list → warns on wrong pill.

## Backend
- Edge function: `health-tools` with `type: "pill_identification"`
- Model: `google/gemini-2.5-flash` (vision), effort: medium
- Payload: `{ image, active_medications: [{name, dosage}], banned_substances: string[] }`
- Returns strict JSON with `visual_features`, `likely_medications[]`, `match_against_prescriptions { matched, matched_med_name, warning }`, `safety_notes`, `recommendations`, `confidence`, `disclaimer`

## Frontend
- Component: `src/components/health-tools/PillIdentifier.tsx`
- Available in TWO places:
  1. Health Tools sub-menu (`MyHealth.tsx` → "Pill Identifier")
  2. Medication Manager → "Identify" tab (between Refill and Banned)
- Active meds fetched from `medications` table where `end_date` is null or future
- Banned substances list passed from `src/data/bannedDrugs.ts` → `bannedSingleSubstances`

## Match warnings (priority order)
1. `banned/restricted in India` → red "DO NOT TAKE" banner (highest)
2. `wrong pill` → red "DO NOT TAKE" banner — pill doesn't match any active prescription
3. `unknown pill` → amber banner — user has no prescriptions on record
4. `no warning` + matched=true → green success banner

## Guardian alerts
On `wrong pill` or `banned/restricted in India` warnings → `notifications` inserted (deduped) for all accepted guardians with type `pill_warning`.

## UX safeguards
- "Not sure about your tablet?" intro card on capture view
- Disclaimer always visible
- If `pill_detected=false` or `image_quality=poor` → "Photo unclear, retake"
- If `confidence < 50` → low-confidence notice
- Save to Medical Vault as `record_type: "Lab Reports"` with original photo to `medical-documents` storage
- Share via `ReportShareButtons`
