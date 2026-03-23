

# Face Scan: Add Photo Upload + Video Upload Modes

## Overview
Add two new input modes alongside the existing live camera scan:
- **Upload Photo / Take Photo**: Sends image to AI for facial wellness analysis (skin tone, fatigue, stress signs). Clearly informs user that heart rate cannot be measured from a single photo.
- **Upload Video (30s)**: Processes the video frame-by-frame for PPG heart rate estimation, same algorithm as live scan.

## Changes

### 1. Edge Function: Add `face_analysis` prompt
**File:** `supabase/functions/health-tools/index.ts`

Add a new `face_analysis` system prompt that instructs the AI to analyze a face photo for:
- Face detection confirmation
- Skin tone / complexion observations
- Signs of fatigue (dark circles, pallor, puffiness)
- Apparent stress indicators (tension, expression)
- General wellness observations
- Return structured JSON with `face_detected`, `fatigue_level`, `stress_indicators`, `skin_observations`, `wellness_notes`

### 2. Update FaceScan Component
**File:** `src/components/FaceScan.tsx`

**New idle state UI** — three mode buttons:
- 🎥 **Live Scan** (existing behavior)
- 📷 **Upload Photo** — file input with `capture="user"` for mobile camera + gallery upload
- 🎬 **Upload Video** — file input accepting video (max 30s)

**Photo flow:**
1. User uploads/takes photo
2. Show preview with "Analyzing…" state
3. Send base64 image to `health-tools` edge function with `type: "face_analysis"`
4. Display AI results: face detected ✓/✗, fatigue level, stress indicators, skin observations
5. Show banner: "Photo analysis provides wellness indicators only. For heart rate estimation, use Live Scan or upload a 30-second video."
6. Save to `face_scans` table with `heart_rate: null`, stress from AI analysis

**Video flow:**
1. User uploads video file (validate ≤ 60s duration, common formats)
2. Draw video frames to canvas at ~15fps using `requestAnimationFrame` + `video.currentTime` stepping
3. Extract green channel samples from forehead ROI (same as live scan)
4. Run existing `analyzeSignal()` on collected samples
5. Show results same as live scan

### 3. Database — No schema changes needed
The existing `face_scans` table already has nullable `heart_rate` and `stress_level`/`stress_score` fields, which works for photo-only results where HR is null.

## Files Changed
- `supabase/functions/health-tools/index.ts` — add `face_analysis` prompt
- `src/components/FaceScan.tsx` — add photo upload, video upload modes, AI analysis UI

