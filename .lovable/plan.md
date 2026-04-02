

# Fix: Profile Data Not Appearing in SOS Flash

## Root Cause
Data mismatch between where profile fields are **saved** vs. where the SOS card **reads** them:

| Field | Saved to (MyProfile) | Read from (SOSDialog) |
|-------|----------------------|----------------------|
| Blood group | `nutrition_personas` | `health_profile` ← empty |
| Allergies | `nutrition_personas` | `health_profile` ← empty |
| Chronic conditions | `nutrition_personas` | `health_profile` ← empty |
| Doctor name/phone | `health_profile` | `health_profile` ✓ works |

The `handleSave` in MyProfile saves blood_group, allergies, and medical_conditions to `nutrition_personas`, but the SOS card queries `health_profile` for those fields — which are never populated.

## Fix Strategy
**Option A (chosen):** Update `SOSDialog.fetchData` and `FallDetectionOverlay.sendFallAlerts` to also query `nutrition_personas` and merge the data. This is the safest approach — no migration needed, no risk of data duplication.

Additionally, sync `health_profile` during save so both tables stay consistent (for other consumers like the emergency profile page).

## Changes

### 1. `src/pages/MyProfile.tsx` — Sync health_profile on save
Update `handleSave` to also write `blood_group`, `allergies`, `chronic_conditions` to `health_profile` alongside the existing doctor fields.

### 2. `src/components/SOSDialog.tsx` — Fallback to nutrition_personas
In `fetchData`, also query `nutrition_personas` and use its values as fallback when `health_profile` fields are empty.

### 3. `src/components/FallDetectionOverlay.tsx` — Same fallback
In `sendFallAlerts`, also query `nutrition_personas` for the same fallback logic.

## Files Changed

| File | Change |
|------|--------|
| `src/pages/MyProfile.tsx` | Add blood_group, allergies, chronic_conditions to the health_profile upsert |
| `src/components/SOSDialog.tsx` | Add nutrition_personas query as fallback data source |
| `src/components/FallDetectionOverlay.tsx` | Add nutrition_personas query as fallback data source |

