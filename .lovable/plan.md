

## Goal
Add a new "Urine Check" health tool with two modes:
1. **Color analysis** — photo of urine in a clear container → color category, hydration, possible indicators, red flags
2. **Dipstick reader** — photo of a 10-parameter urine test strip → per-pad readings (glucose, protein, blood, leukocytes, nitrites, ketones, bilirubin, urobilinogen, pH, specific gravity) with normal/abnormal flags

## Architecture (mirrors existing `face_analysis` / `document_analysis` pattern)

### Backend — `supabase/functions/health-tools/index.ts`
Add two new prompt types with strict JSON output:

**`urine_color_analysis`** returns:
```json
{
  "image_quality": "good" | "poor",
  "color_category": "pale" | "straw" | "yellow" | "amber" | "orange" | "pink_red" | "brown" | "cloudy" | "other",
  "hydration_status": "over" | "good" | "mild_dehydration" | "dehydrated",
  "possible_indicators": ["plain-language possibilities"],
  "red_flags": ["urgent concerns, empty if none"],
  "recommendations": ["actionable steps"],
  "see_doctor": "no" | "soon" | "urgent",
  "confidence": 0-100,
  "disclaimer": "..."
}
```

**`urine_dipstick_analysis`** returns:
```json
{
  "image_quality": "good" | "poor",
  "strip_detected": true,
  "pads": [
    { "name": "Glucose", "reading": "Negative", "status": "normal"|"borderline"|"abnormal", "notes": "..." },
    { "name": "Protein", "reading": "Trace", "status": "...", "notes": "..." },
    ... (Blood, Leukocytes, Nitrites, Ketones, Bilirubin, Urobilinogen, pH, Specific Gravity)
  ],
  "summary": "...",
  "red_flags": [...],
  "recommendations": [...],
  "see_doctor": "no" | "soon" | "urgent",
  "confidence": 0-100,
  "disclaimer": "..."
}
```

Both use `google/gemini-2.5-flash` (vision, same as `face_analysis`).

### Frontend — new `src/components/health-tools/UrineCheck.tsx`
- Mode toggle: **Color Check** vs **Dipstick Reader**
- Photo capture/upload (reuse pattern from `FaceScan` / `DocumentAnalyzer`)
- Clear photo guidance overlay per mode:
  - Color: "White/clear container, daylight, no toilet water, plain background"
  - Dipstick: "Lay strip flat on white surface, daylight, take photo within 60-120 sec of dipping, include the reference chart from the bottle if possible"
- Loading state with progress steps
- Results render:
  - Color mode → color swatch, hydration status pill, indicator list, red-flag alert banner if any
  - Dipstick mode → table of 10 pads with status badges (green/amber/red), summary, red-flag banner
- Red-flag banner (red, prominent) when `see_doctor === "urgent"`
- "Save to Medical Vault" button → inserts into `medical_records` (same pattern as DocumentAnalyzer)
- "Share" via existing `ReportShareButtons`
- Disclaimer at bottom

### Wire-up — `src/pages/MyHealth.tsx`
- Add `import UrineCheck from "@/components/health-tools/UrineCheck"`
- Add to `healthToolsSubItems`: `{ icon: TestTube, label: "Urine Check", desc: "Color & dipstick strip analysis" }`
- Add to `subToolComponents`: `"Urine Check": UrineCheck`

### Memory
- New file `mem://features/urine-check.md` documenting both flows, prompt types, and red-flag rules
- Update `mem://index.md` to reference it

## UX safeguards (mandatory)
- Disclaimer always visible: "Not a diagnostic test. Consult a doctor for symptoms."
- If `image_quality === "poor"` → show "Photo unclear, please retake" instead of unreliable results
- If `confidence < 50` → display low-confidence warning
- Red-flag colors (blood/brown/cola, or any abnormal dipstick pad) → red banner + "See a doctor today/now" CTA

## Files to create/edit
- `supabase/functions/health-tools/index.ts` — add 2 prompt types + task config
- `src/components/health-tools/UrineCheck.tsx` — new component
- `src/pages/MyHealth.tsx` — register new sub-tool
- `.lovable/memory/features/urine-check.md` — new memory
- `.lovable/memory/index.md` — add reference

## What I'm NOT doing in this phase
- Hydration trend chart (Phase 2)
- Guardian red-flag auto-alert (Phase 2)
- Daily hydration log (Phase 2)

These can come next once the analyzer is working.

