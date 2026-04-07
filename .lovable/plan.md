## Enhance AI-Powered Safety and Wellness Features

This is a significant feature set spanning client-side detection, a new edge function for AI analysis, and voice interaction capabilities. Here's a practical plan given the browser-based constraints of the app.

### Important Constraints

- **This is a web/PWA app**, not a native app. Access to continuous background sensors, always-on microphone, and room-level location is limited.
- **Contextual fall detection** can be improved with accelerometer pattern buffering but cannot access ambient audio continuously in a browser.
- **Voice-activated SOS** requires the Web Speech API (SpeechRecognition), which works in Chrome/Edge but not Safari/Firefox reliably.
- **Abnormal pattern detection** can analyze stored activity/check-in data server-side but cannot do real-time room-level tracking.

---

### 1. Contextual Fall Detection — `src/hooks/useFallDetection.ts`

**Current**: Simple free-fall → impact two-phase detection with thresholds.

**Enhancement**: Buffer a rolling window of accelerometer readings and analyze the full motion signature (pre-fall, free-fall, impact, post-impact stillness) to reduce false positives.

- Add a circular buffer (last 3 seconds of motion data, ~150 samples at 50Hz)
- On impact detection, capture 2 more seconds of post-impact data
- Analyze the full pattern: gradual tilt → free-fall → sharp impact → stillness = likely fall; sudden spike alone = dropped phone
- Score the pattern locally (no AI needed for this — heuristic rules on jerk, orientation change, and post-impact stillness duration)
- Only trigger the alert if the confidence score exceeds a threshold
- Add a `fallConfidence` value to the hook's return for UI display

**Files**: `src/hooks/useFallDetection.ts`, `src/components/FallDetectionOverlay.tsx` (show confidence)

---

### 2. Abnormal Pattern Detection — New edge function + client hook

**Approach**: Analyze the user's historical data server-side to detect deviations from their baseline.

- **New edge function** `supabase/functions/detect-anomalous-patterns/index.ts`:
  - Accepts `user_id`, queries last 14 days of `activity_logs`, `check_ins`, `wellness_logs`
  - Builds a baseline (average steps, typical check-in response times, usual active hours)
  - Compares today's data against baseline
  - Flags anomalies: no movement for unusual duration, missed multiple check-ins, sudden vitals changes
  - Uses `google/gemini-2.5-flash-lite` (low effort) for natural language summary of findings
  - Returns anomaly flags + summary text
- **New hook** `src/hooks/useAbnormalPatternCheck.ts`:
  - Runs once per hour (or on app foreground)
  - Calls the edge function
  - If anomalies detected, creates a notification and optionally alerts guardians
- **Guardian Dashboard**: Show anomaly alerts in the notification feed (uses existing notification infrastructure)

**Files**: New edge function, new hook, wire hook into `AppLayout.tsx`

---

---

### 3. AI Wellness Voice Check-ins — Enhanced check-in flow

**Approach**: Add optional voice-prompted check-ins with sentiment analysis.

- **Enhance `CheckInDialog.tsx**`:
  - Add a "Voice Check-in" option alongside the existing tap-based flow
  - Use `window.speechSynthesis` to ask "How are you feeling this morning?"
  - Use `webkitSpeechRecognition` to capture the user's spoken response
  - Send transcript to the `health-tools` edge function with a new type `wellness_voice_checkin`
- **New system prompt in `health-tools/index.ts**`:
  - Type: `wellness_voice_checkin`
  - Model: `google/gemini-2.5-flash` with `low` effort
  - Analyzes sentiment, detects confusion/distress/weakness indicators
  - Returns `{ sentiment, mood_score, concerns, follow_up_needed }`
- **Store results**: Save sentiment data to `check_ins` table (may need a `sentiment_data` JSONB column)
- **Guardian alerts**: If `follow_up_needed` is true, notify guardians via existing notification system

**Files**: `src/components/CheckInDialog.tsx`, `supabase/functions/health-tools/index.ts`, database migration for `check_ins.sentiment_data`

---

### Summary of Changes


| Feature                   | New Files                                                          | Modified Files                                    | DB Changes                        | &nbsp; | &nbsp; |
| ------------------------- | ------------------------------------------------------------------ | ------------------------------------------------- | --------------------------------- | ------ | ------ |
| Contextual Fall Detection | —                                                                  | `useFallDetection.ts`, `FallDetectionOverlay.tsx` | None                              | &nbsp; | &nbsp; |
| Abnormal Patterns         | `detect-anomalous-patterns/index.ts`, `useAbnormalPatternCheck.ts` | `AppLayout.tsx`                                   | None                              | &nbsp; | &nbsp; |
| &nbsp;                    | &nbsp;                                                             | &nbsp;                                            | &nbsp;                            | &nbsp; | &nbsp; |
| Voice Check-ins           | —                                                                  | `CheckInDialog.tsx`, `health-tools/index.ts`      | `check_ins.sentiment_data` column | &nbsp; | &nbsp; |


### Implementation Order

1. Contextual fall detection (self-contained, no new dependencies)
2. Voice wellness check-ins (builds on existing check-in flow)
3. Abnormal pattern detection (requires historical data analysis)