# Fix: no audio when using the voice mic

## Root cause

Sarvam TTS is fine — I called the API directly and it returns a valid base64 WAV. The audio never reaches the speaker because of how we play it on the client.

In `src/components/VoiceAgentButton.tsx`:

```ts
const audio = new Audio(dataUrl);
audio.play().catch(() => onEnd?.());
```

By the time this runs, **3–8 seconds** have passed since the mic tap (STT upload → LLM → TTS). The browser no longer considers this a user gesture, so `HTMLMediaElement.play()` is blocked by autoplay policy — silently, because we swallow the rejection in `.catch(() => onEnd?.())`. This is why:

- Nothing plays in the Lovable preview iframe (iframes are strictest)
- Nothing plays on iOS Safari
- The UI just flips back to "idle" with no error toast

`ensureAudioReady()` **does** resume the shared `AudioContext` on tap, but that unlock only benefits Web Audio playback — not `<audio>` elements or `SpeechSynthesis`. So the fallback `speakFallback()` path has the same problem.

## Fix

Route TTS playback through the already-unlocked `AudioContext` in `src/lib/audioAlerts.ts` instead of `new Audio()`. Web Audio doesn't need a fresh gesture once the context is running — and our existing tap on the mic guarantees it is.

### Changes

**1. `src/lib/audioAlerts.ts` — add a helper**

Add `playBase64Audio(dataUrl: string, onEnd?: () => void): Promise<void>`:
- Call `ensureAudioReady()`.
- Strip the `data:audio/…;base64,` prefix, base64-decode into an `ArrayBuffer`.
- `audioContext.decodeAudioData(...)` → `AudioBufferSourceNode` → `connect(destination)` → `start(0)`.
- `source.onended = onEnd`.
- Keep a module-level `currentSource` so a new call cancels the previous one (mirrors current `stopAudio` behavior).
- Export `stopBase64Audio()` that calls `currentSource?.stop()` and clears the ref.
- On any error (decode failure, still-suspended context), log to console and fall back once to `new Audio(dataUrl).play()` — plus call `onEnd` if that also throws, so the UI never gets stuck.

**2. `src/components/VoiceAgentButton.tsx` — use it**

- Replace the `HTMLAudioElement`-based `playAudio` with a call to `playBase64Audio(dataUrl, onEnd)`.
- Replace `audioRef.current?.pause()` in `stopAudio` with `stopBase64Audio()`.
- Remove the now-unused `audioRef`.
- Add a `console.error` in the existing `onerror` path so the next failure is visible in logs, not silent.

**3. Keep `speakFallback` as a last resort**

Only used when the server returned no `audio` blob at all (Sarvam outage). Leave it untouched — that path already works when it works, and there's nothing we can do about `speechSynthesis` autoplay in an iframe from client code.

## Out of scope

- No changes to `supabase/functions/voice-agent/index.ts` — TTS is confirmed working.
- No changes to the STT path (`useMediaRecorderStt`, `useVoiceRecognition`, `sarvam-stt` edge function).
- No changes to the mic UI, modes, quota, or system prompts.

## Verification

After the change, tapping the mic in the preview iframe should:
1. Play the Sarvam TTS reply audibly through the speaker.
2. Log a clear console error if playback ever fails again (no more silent failures).
