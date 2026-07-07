# Hybrid Speech-to-Text: Browser + Sarvam Fallback

Keep the current free, on-device Web Speech API as the fast path. Automatically fall back to server-side Sarvam STT (`saarika:v2`) whenever Web Speech is unavailable or errors out — so the mic works inside the Lovable preview iframe, on iOS Safari, and in any webview.

## Behaviour

1. Tap mic → try browser Web Speech first (unchanged fast path).
2. If Web Speech is unsupported, OR it errors with `service-not-allowed` / `not-allowed` / `network` / `audio-capture`, silently switch to Sarvam recording mode for that tap.
3. Sarvam mode: record mic audio with `MediaRecorder`, stop on second tap (or after 20s auto-cutoff / silence), upload to the new `sarvam-stt` edge function, feed the returned transcript into the same `sendTurn()` path as before.
4. UI stays identical — user just sees "Listening…" then the transcript appears. No mode toggle exposed.
5. Sarvam is only called when needed, so cost stays near zero on Android Chrome and the installed PWA/Capacitor app.

## New edge function: `supabase/functions/sarvam-stt/index.ts`

- `verify_jwt = true` (JWT-bound user client, matches `voice-query` and `transcribe-voice`).
- Accepts `multipart/form-data` with an `audio` file part (webm/opus, mp4, or wav) and optional `language` field (default `en-IN`).
- Forwards to `POST https://api.sarvam.ai/speech-to-text` with header `api-subscription-key: ${SARVAM_API_KEY}` and body fields `model=saarika:v2`, `language_code=<lang>`, `file=<audio>`.
- Returns `{ transcript: string, language?: string }`.
- Standard CORS, 401 on missing auth, surfaces 402/429 from Sarvam, logs errors.
- Uses the existing `SARVAM_API_KEY` secret — no new secrets needed.

## New client hook: `src/hooks/useMediaRecorderStt.ts`

- Wraps `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`.
- Picks the best supported mime type (`audio/webm;codecs=opus` → `audio/mp4` → `audio/webm`).
- Exposes `{ recording, start, stop, error, supported }` with the same shape-ish surface as `useVoiceRecognition` so `VoiceAgentButton` can swap between them cleanly.
- On `stop()`: builds a Blob, POSTs to `sarvam-stt` via `supabase.functions.invoke`, returns transcript through an `onFinal` callback.
- 20s hard cap auto-stop; rejects blobs < 2KB (empty/silent) with a "didn't catch that" error.

## Edits to `src/components/VoiceAgentButton.tsx`

- Import the new hook alongside `useVoiceRecognition`.
- Track `sttMode: "browser" | "sarvam"` in state, default `"browser"`. If `isSpeechRecognitionSupported()` is false at mount, initialise to `"sarvam"`.
- In the existing `onerror` handler for browser STT, when `error ∈ {service-not-allowed, not-allowed, network, audio-capture}`, set `sttMode = "sarvam"`, show a one-time toast "Switching to cloud voice…", and immediately re-invoke `start()` on the Sarvam hook.
- `handleMicTap()` calls either hook's `start` / `stop` based on `sttMode`.
- Interim transcript UI only shows for browser mode (Sarvam has no interim); replace it with a subtle "Recording…" indicator when Sarvam is active.
- Remove the `if (!isSpeechRecognitionSupported()) return null;` early return so the FAB renders on iOS too.

## Files touched

- Create `supabase/functions/sarvam-stt/index.ts`
- Create `src/hooks/useMediaRecorderStt.ts`
- Edit `src/components/VoiceAgentButton.tsx` (also apply the same pattern in `src/components/VoiceQueryButton.tsx` if it still ships — will verify during build)

## Out of scope

- No changes to `voice-query` TTS pipeline (Sarvam bulbul stays).
- No language picker UI — Sarvam defaults to `en-IN`; Hindi auto-detect can come later.
- No streaming STT — one-shot per utterance keeps it simple.
