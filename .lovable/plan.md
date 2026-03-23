

# Fix Face Scan False Positives

## Problem

The face scan accepts any input (blank screen, objects, etc.) and always reports a valid result because:

1. **Line 138**: `heartRate = Math.max(50, Math.min(140, heartRate))` — clamps minimum to 50 BPM, so even zero signal gives "50 BPM"
2. **No signal quality check** — there's no validation that the green channel actually contains a pulsatile signal (variance check)
3. **No face detection** — any input is accepted without verifying a face is present
4. **Stress derived solely from HR** — so a fake 50 BPM always yields "Low Stress"

## Changes

### 1. Add signal quality validation in `analyzeSignal`
**File:** `src/components/FaceScan.tsx`

- Calculate signal variance (standard deviation of green channel samples)
- If variance is below a threshold (flat/no-face signal), reject the scan with a "No valid signal detected" error instead of returning fake results
- Calculate SNR (signal-to-noise ratio) from the smoothed signal — reject if too low
- Remove the `Math.max(50, ...)` floor that masks bad data — instead, if HR falls outside 45–180, mark as invalid

### 2. Add face detection heuristic
- During scanning, check that the green channel mean falls within a plausible skin-tone range (not too dark like a blank screen, not too bright)
- Track how many frames have valid skin-tone range; require at least 60% of frames to be valid
- If insufficient valid frames, abort with "No face detected — please position your face in the oval"

### 3. Add real-time feedback during scan
- Show a "Face detected" / "No face" indicator overlay on the camera view during scanning
- Use green/red dot indicator so the user knows to reposition

### 4. Update confidence scoring
- Map signal quality metrics (variance, SNR, valid-frame ratio) to confidence levels: "Good", "Fair", "Poor"
- If confidence is "Poor", don't save results — show warning and ask user to retry

## Technical Details

- Skin detection: green channel mean typically 80–200 for face under normal lighting; blank screen is ~0–20, bright objects are 240+
- Signal variance threshold: std deviation < 0.3 indicates no pulsatile signal
- No external face detection library needed — the green channel heuristic is sufficient for filtering obvious false positives
- The ECG tab in VitalsMonitor uses the same PPG technique but doesn't auto-save or report stress, so it's less affected

## Files Changed

- `src/components/FaceScan.tsx` — add validation, face detection heuristic, real-time feedback, remove HR floor clamping

