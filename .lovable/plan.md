

# Fix Face Scan — Too Strict, All Scans Failing

## Problem
After fixing false positives, the thresholds are now too aggressive. Real face scans fail because:
- `MIN_SIGNAL_STDDEV = 0.3` may be too high for subtle PPG signals in normal lighting
- `MIN_SNR = 1.5` is hard to achieve with phone cameras
- `MIN_VALID_FRAME_RATIO = 0.6` rejects scans where the user repositions during the 30s window
- The fixed skin-tone range (60–210) doesn't account for all lighting conditions

## Changes

### 1. Relax thresholds
**File:** `src/components/FaceScan.tsx`

- Lower `MIN_SIGNAL_STDDEV` from 0.3 → 0.1
- Lower `MIN_SNR` from 1.5 → 0.8
- Lower `MIN_VALID_FRAME_RATIO` from 0.6 → 0.4
- Widen skin-tone range: `SKIN_GREEN_MIN` from 60 → 30, `SKIN_GREEN_MAX` from 210 → 230

### 2. Add 3-second calibration phase
- First 3 seconds: collect baseline green channel values, don't count toward valid/invalid frames
- Use the baseline mean ± 40% as the dynamic skin-tone range for the rest of the scan
- This adapts to actual lighting and skin tone automatically

### 3. Allow "Fair" confidence results through
- Currently "Poor" confidence triggers failure. Keep that.
- But ensure "Fair" confidence scans are saved and shown — don't over-reject.

### 4. Better failure guidance
- Show which specific check failed (not enough face frames vs. weak signal vs. implausible HR)
- Add tips: "Try in brighter lighting", "Hold phone 30cm from face", "Stay very still"

## Files Changed
- `src/components/FaceScan.tsx`

