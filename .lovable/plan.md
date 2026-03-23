# Vitals Monitor — Combined ECG Waveform, Vitals Dashboard & Device Report Upload

## What

A new "Vitals Monitor" tool in the My Health grid with three tabs:

1. **Dashboard** — Aggregated vitals (HR, SpO2, stress, steps, calories) with trend charts and AI-powered insights
2. **ECG Waveform** — Animated real-time PPG-derived heart rate waveform rendered as an ECG-style line using camera (reuses FaceScan PPG logic)
3. **Device Reports** — Upload ECG/medical device PDFs or images for AI-powered analysis and summary

## Changes

### 1. New component: `src/components/VitalsMonitor.tsx`

Three-tab layout using existing `Tabs` component.

**Dashboard tab:**

- Fetch latest data from `face_scans`, `activity_logs`, `wellness_logs` for the current user
- However, check face scans as the data is not reliable since it gives incorrect data as it also scans any object and displays that as hearrate of 50 BPM and Low Stress. 
- Display metric cards: HR, SpO2, stress score, steps, calories, sleep hours
- Trend chart (recharts `LineChart`) for HR and SpO2 over last 7 days
- "Get AI Insights" button → calls `health-tools` edge function with a new `vitals_insights` type, passing aggregated data; renders markdown response

**ECG Waveform tab:**

- Uses camera PPG sampling (same green-channel technique as FaceScan)
- Renders samples in real-time on a `<canvas>` element as a scrolling ECG-style waveform (green line on dark background)
- Shows live estimated HR value
- Start/Stop controls

**Device Reports tab:**

- File upload (PDF/image) for ECG reports, Holter monitor printouts, etc.
- Calls `health-tools` edge function with type `document_analysis` (already exists) with a medical device context
- Renders AI summary as markdown
- "Save to Medical Vault" button (same pattern as DocumentAnalyzer)

### 2. Add `vitals_insights` prompt to edge function

**File:** `supabase/functions/health-tools/index.ts`

- Add a new `vitals_insights` system prompt that analyzes aggregated vitals data (HR trends, SpO2, stress, activity) and provides health insights, anomaly detection, and recommendations in the Indian healthcare context

### 3. Wire into My Health grid

**File:** `src/pages/MyHealth.tsx`

- Add new grid item: `{ icon: HeartPulse, label: "Vitals", color: "bg-sos/10 text-sos" }` (replace existing "Wellness" entry or add alongside)
- Map `"Vitals"` to `VitalsMonitor` in `toolComponents`

### 4. Add route for direct navigation

**File:** `src/App.tsx`

- No new route needed; accessed via MyHealth tool selection

## Technical Details

- ECG waveform canvas: 60fps `requestAnimationFrame` loop, ring buffer of ~300 samples, green line (#00ff00) on #111 background, auto-scaling Y axis
- AI insights reuse the existing `health-tools` edge function pattern (non-streaming invoke)
- No new database tables required — reads from existing `face_scans`, `activity_logs`, `wellness_logs`
- Device report upload reuses `document_analysis` type already in the edge function

## Files Changed

- `src/components/VitalsMonitor.tsx` — new (~400 lines)
- `supabase/functions/health-tools/index.ts` — add `vitals_insights` prompt
- `src/pages/MyHealth.tsx` — add grid entry + tool mapping