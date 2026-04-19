---
name: Urine Check
description: Two-mode urine screening tool — colour analysis and 10-pad dipstick reader, both photo-based via Lovable AI
type: feature
---

Urine Check tool lives at `src/components/health-tools/UrineCheck.tsx`, registered as a sub-tool under My Health → Health Tools in `src/pages/MyHealth.tsx`.

Backend: `supabase/functions/health-tools/index.ts` exposes two new types:
- `urine_color_analysis` → JSON: image_quality, color_category (pale/straw/yellow/amber/orange/pink_red/brown/cloudy/other), hydration_status, possible_indicators, red_flags, recommendations, see_doctor (no/soon/urgent), confidence, disclaimer
- `urine_dipstick_analysis` → JSON: image_quality, strip_detected, pads[10] (Glucose, Protein, Blood, Leukocytes, Nitrites, Ketones, Bilirubin, Urobilinogen, pH, Specific Gravity) each with reading + status (normal/borderline/abnormal), summary, red_flags, recommendations, see_doctor, confidence, disclaimer

Both use `google/gemini-2.5-flash` vision (same pattern as `face_analysis`).

UX safeguards (mandatory):
- Photo tips banner per mode before capture
- `see_doctor === "urgent"` → red destructive Alert "See a doctor today"
- `see_doctor === "soon"` → amber warning Alert
- `image_quality === "poor"` OR `confidence < 50` → low-confidence Info Alert
- Disclaimer always rendered at bottom
- Save to Medical Vault uses `record_type: "Lab Reports"`, uploads original image to `medical-documents` bucket
- Share via existing `ReportShareButtons` (markdown formatted via `formatColorReport` / `formatDipstickReport`)

Phase 2 (not yet built): hydration trend chart, daily hydration log entry, guardian red-flag auto-alert.
