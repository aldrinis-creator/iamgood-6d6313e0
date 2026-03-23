

# Fix Battery Audio Alerts + Fix Audio Alerts Not Firing

## Two Issues Found

### Issue 1: Battery Warning has no audio
`BatteryWarning.tsx` only shows a visual overlay — it never calls `playChime()`, `playVoiceReminder()`, or `navigator.vibrate()`. Need to add audio/vibration alerts when battery warnings trigger.

### Issue 2: Audio alerts silently fail due to browser autoplay policy
Browsers block `AudioContext.resume()` and `speechSynthesis.speak()` unless they originate from a **user gesture**. The alarm hooks call these from `setInterval` callbacks, which have no gesture context — so `ctx.resume()` returns a rejected promise (silently caught) and audio never plays.

**Fix**: "Unlock" the AudioContext on the user's **first tap/click anywhere** in the app. Once unlocked, subsequent programmatic calls will work. This is the standard pattern used by web audio apps.

## Changes

### 1. Add audio unlock on first user interaction
**File:** `src/lib/audioAlerts.ts`

- Add an `unlockAudio()` function that creates/resumes the AudioContext and plays a silent buffer
- Register a one-time `click`/`touchstart` listener on `document` to call it
- Call `unlockAudio()` on module load so it auto-registers

### 2. Add audio + vibration to BatteryWarning
**File:** `src/components/BatteryWarning.tsx`

- Import `playChime`, `playVoiceReminder` from `audioAlerts`
- Import `useUserSettings` to check audio/voice/vibration preferences
- When `show()` fires, play voice ("Battery is getting low" / "Battery critically low") or chime based on settings
- Add vibration pattern for critical alerts

### 3. Add fallback: use HTML5 Audio element
**File:** `src/lib/audioAlerts.ts`

- If AudioContext is still suspended after resume attempt, fall back to playing a short generated audio blob via `new Audio(blobUrl)` which has slightly better autoplay support in some browsers

## Files Changed
- `src/lib/audioAlerts.ts` — add audio unlock + fallback
- `src/components/BatteryWarning.tsx` — add audio/voice/vibration alerts

