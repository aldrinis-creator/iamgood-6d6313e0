

## Audio Alert Settings and In-App Reminders

### What We're Building
1. An "Audio Alerts" settings card on the Settings page with three modes: Off, Chime, Voice
2. A `useCheckInAudio` hook that monitors the clock and plays the selected sound when a check-in time arrives
3. Audio stored as synthesized tones (Web Audio API for chime) and SpeechSynthesis API for voice prompts

### Changes

#### 1. New file: `src/hooks/useCheckInAudio.ts`
- Reads alert preference from localStorage (`checkin-audio-mode`: `"off"` | `"chime"` | `"voice"`)
- Runs a `setInterval` (every 30s) comparing current time against CHECK_IN_HOURS
- Tracks which hours have already fired today to avoid repeats
- **Chime mode**: Uses Web Audio API to play a pleasant two-tone chime (OscillatorNode with gain envelope)
- **Voice mode**: Uses `window.speechSynthesis.speak()` with message like "It's time for your Check-iN"
- Exports the hook; no database needed since this is a local preference

#### 2. New file: `src/lib/audioAlerts.ts`
- `playChime()`: Creates AudioContext, plays a brief ascending two-note chime
- `playVoiceReminder(message: string)`: Uses SpeechSynthesis API
- `testAlert(mode: string)`: Plays a preview for the Settings page "Test" button

#### 3. Edit: `src/pages/Settings.tsx`
- Add new card "Audio Alerts" (Volume2 icon) between Check-In Schedule and Inactivity Detection
- Three radio-style options: Off / Chime / Voice — stored in localStorage
- "Test Sound" button to preview the selected mode
- Helper text explaining browser limitations (app must be open)

#### 4. Edit: `src/pages/UserDashboard.tsx`
- Import and call `useCheckInAudio()` so the timer runs while the user is on the dashboard
- Alternatively, place it in `AppLayout.tsx` so it runs on any page (better coverage)

### Technical Notes
- **No database migration needed** — preference stored in localStorage for simplicity
- Web Audio API requires a prior user interaction to unlock; the "Test Sound" button serves this purpose
- SpeechSynthesis works on all modern mobile browsers
- The hook is passive — it only fires when the app is open in the foreground

