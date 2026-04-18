
## Diagnosis

The audio still doesn't fire because the current implementation has a fatal flaw: the `SpeechSynthesisUtterance` is created in `prepareUtterance()` during the mic tap, but then **the speech recognition runs** (another async gesture-breaker), THEN we hit the network, THEN we try to speak. By that time the gesture context is long gone — even the pre-created utterance won't play on Chrome/Safari mobile because `speak()` itself must be called close to a gesture.

Also, the current code has competing speech paths (`utterance` race + `speak()` fallback + `cancel()` calls) that can cancel each other out. And `ensureAudioReady()` resumes the AudioContext — irrelevant to `speechSynthesis`, which is a separate API.

## Root cause
`speechSynthesis.speak()` is being called after: tap → STT listening → STT result → network call → speak. Every modern browser treats this as "no user gesture" and silently drops it. The pre-created utterance trick only works if the `speak()` call itself happens very close to the gesture — not minutes later after STT + network.

## Fix plan

### 1. Switch TTS from browser `speechSynthesis` to server-generated audio
Use Lovable AI's TTS (or a simple inline approach): have the `voice-query` edge function return both `answer` (text) AND `audio` (base64 MP3) generated via a TTS call. Then the client plays it via `new Audio(dataUrl)`, which **is allowed** post-gesture as long as the AudioContext was unlocked once (it already is, via `audioAlerts.ts`).

This bypasses the entire `speechSynthesis` gesture-loss problem.

### 2. Backend changes (`supabase/functions/voice-query/index.ts`)
- After getting the AI text answer, call OpenAI TTS via Lovable AI Gateway (`openai/gpt-4o-mini-tts` or similar) to generate MP3.
- Return `{ answer, audio: "data:audio/mpeg;base64,..." }`.
- Keep existing context-gathering logic intact.

### 3. Client changes (`src/components/VoiceQueryButton.tsx`)
- Remove all `speechSynthesis` / `SpeechSynthesisUtterance` / `prepareUtterance` / `waitForVoices` code.
- On receiving response: `const audio = new Audio(data.audio); audio.play();`
- Update phase to "speaking" while playing, "idle" on `ended`.
- Keep text display in the card as visual fallback.
- Tap-to-cancel during "speaking" calls `audio.pause()`.

### 4. Fallback
If TTS generation fails server-side, return `audio: null` and the client just shows the text answer (no broken audio attempt).

## Files to update
- `supabase/functions/voice-query/index.ts` — add TTS step, return audio
- `src/components/VoiceQueryButton.tsx` — replace speechSynthesis with `new Audio()`

## Why this will actually work
`HTMLAudioElement.play()` after gesture unlock is reliable on iOS Safari, Chrome Android, and desktop. We've already unlocked audio in `audioAlerts.ts` on the first tap. `speechSynthesis` is the unreliable one — we drop it.

## Recommendation
Do this fix. It's the only path that reliably produces audio on mobile after an async network call.
