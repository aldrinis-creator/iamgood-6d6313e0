

# Fix Intermittent Audio Alerts

## Root Cause

The audio fires inconsistently because of three issues:

1. **AudioContext re-suspends**: After a period of inactivity (tab backgrounded, no interaction), Chrome automatically suspends the AudioContext again. The current unlock only runs once (guarded by `audioUnlocked` flag), so subsequent alerts find it suspended with no recovery.

2. **speechSynthesis requires recent gesture**: Chrome cancels `speechSynthesis.speak()` if there hasn't been a user gesture within ~5-10 seconds. Timer-based alarm hooks (30s intervals) always miss this window.

3. **Fallback beep also blocked**: `new Audio().play()` has the same autoplay restrictions, so the fallback path fails too.

## Fix

### File: `src/lib/audioAlerts.ts`

**A. Keep re-unlocking on every interaction** — remove the `audioUnlocked` early-return so every click/touch re-resumes the AudioContext. This is cheap and ensures the context stays alive.

**B. Pre-cache an Audio element on user gesture** — on first interaction, create a reusable `Audio` element and call `.play()` with a silent data URI. Once an Audio element has played from a gesture, it can be reused programmatically. Store it for fallback use.

**C. `playChime`: try AudioContext → fallback to pre-cached Audio → fallback to generated WAV blob** — three tiers of fallback.

**D. `playVoiceReminder`: queue a silent utterance on user gesture** — this "primes" the speech synthesis engine. On subsequent programmatic calls, first play a silent utterance, then the real message (workaround for Chrome's gesture requirement fading).

**E. Add `ensureAudioReady()`** — exported function that alarm hooks call before attempting audio. It re-resumes the context and returns whether audio is likely to work, so hooks can prioritize fallback paths.

### File: `src/components/ReminderOverlay.tsx`

**F. Play audio when overlay appears** — since the overlay is visible and interactive, trigger audio playback from the overlay's mount/show effect as a secondary attempt. The overlay's action buttons (Check-In Now, etc.) also call `ensureAudioReady()` on click, re-priming for future alerts.

### File: `src/components/BatteryWarning.tsx`

**G. Same pattern** — call `ensureAudioReady()` before playing battery alerts.

## Summary of Changes
- `src/lib/audioAlerts.ts` — remove single-fire guard, add pre-cached Audio element, add `ensureAudioReady()`, prime speechSynthesis on gesture
- `src/components/ReminderOverlay.tsx` — retry audio on overlay show, re-prime on button clicks
- `src/components/BatteryWarning.tsx` — call `ensureAudioReady()` before alerts

