## Goal

Add a "Pill Identifier" health tool: user photographs any pill → AI identifies it by shape/color/imprint/score-line → cross-checks against their active medications → warns if it doesn't match anything they're prescribed (potential wrong-pill safety alert).  
Add the feature in Manage Medication next to Refill tab.

## Architecture (mirrors `urine_color_analysis` / `face_analysis` pattern)

### 1. Backend — `supabase/functions/health-tools/index.ts`

Add new prompt type `pill_identification` (vision, `google/gemini-2.5-flash`):

**Input:** photo + list of user's active medications (name + dosage from `medications` table)

**Returns strict JSON:**

```json
{
  "image_quality": "good" | "poor",
  "pill_detected": true,
  "visual_features": {
    "shape": "round | oval | capsule | oblong | other",
    "color": "primary color(s)",
    "imprint": "text/numbers visible, or 'none'",
    "score_line": true | false,
    "size_estimate": "small | medium | large",
    "coating": "film | sugar | uncoated | gel"
  },
  "likely_medications": [
    { "name": "...", "salt": "...", "common_brands": ["..."], "typical_use": "...", "confidence": 0-100 }
  ],
  "match_against_prescriptions": {
    "matched": true | false,
    "matched_med_name": "name from user's list, or null",
    "warning": "no warning | wrong pill | unknown pill | banned/restricted in India"
  },
  "safety_notes": ["..."],
  "recommendations": ["..."],
  "confidence": 0-100,
  "disclaimer": "Visual identification only. Always verify with pharmacist before consuming an unfamiliar pill."
}
```

### 2. Frontend — new `src/components/health-tools/PillIdentifier.tsx`

- Photo upload / camera capture (reuse `FaceScan`/`UrineCheck` pattern)
- Photo guidance: "Place pill on white surface, daylight, both sides if possible, fill frame"
- On analyze: fetch user's active meds from `medications` table → send photo + med list to edge function
- Render results:
  - **Visual features card** (shape, color, imprint, score line)
  - **Likely medications list** with confidence badges
  - **Prescription match banner**:
    - 🟢 Green if matches an active prescription
    - 🟡 Amber if unknown/OTC
    - 🔴 Red "WRONG PILL — DO NOT TAKE" if conflicts with prescriptions or banned
  - Safety notes + recommendations
- &nbsp;
- Display result to User when the Pill Identifies tab is invoked and Save to Medical Vault (same `medical_records` pattern) with a message to User.
- Share via `ReportShareButtons`
- Disclaimer footer

### 3. Wire-up — `src/pages/MyHealth.tsx`

- Import `PillIdentifier`
- Add `{ icon: Pill, label: "Pill Identifier", desc: "Photograph any pill to identify it & check against your prescriptions" }` to `healthToolsSubItems`
- Map `"Pill Identifier": PillIdentifier` in `subToolComponents`

### 4. Memory

- Create `mem://features/pill-identifier.md` (prompt type, match logic, red-flag rules)
- Update `mem://index.md` to reference it

## UX safeguards (mandatory)

- Disclaimer always visible
- If `image_quality === "poor"` or `pill_detected === false` → "Photo unclear, retake" instead of unreliable result
- If `confidence < 50` → low-confidence warning + "Verify with pharmacist before consuming"
- **Wrong-pill red banner** is the headline feature — must be unmissable (full-width red alert with icon, "DO NOT TAKE" CTA)
- If user has no active medications → skip match check, show identification-only result

## Files to create/edit

- `supabase/functions/health-tools/index.ts` — add `pill_identification` prompt + task config
- `src/components/health-tools/PillIdentifier.tsx` — new component
- `src/pages/MyHealth.tsx` — register new sub-tool
- `.lovable/memory/features/pill-identifier.md` — new memory
- `.lovable/memory/index.md` — add reference

## Include the following

- When Pill Identifier tab is invoked, ask the question, "Not sure about your tablet? and then begin with process  
Cross-reference against banned drug list (could add by passing `bannedSingleSubstances` to prompt)
- Notify guardian on wrong-pill detection
- Save pill photos to a "known pills" library for faster future ID
- OCR of imprint codes against an external pill database (DailyMed/MedlinePlus)