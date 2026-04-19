---
name: Voice Query Assistant
description: "Hey Check-iN" voice assistant — tap-to-talk mic FAB, browser STT, edge function with ElevenLabs TTS (Sarah voice), editable prompt chips persisted in user_settings
type: feature
---
Voice Query Assistant ("Hey Check-iN"):

- **UI**: `src/components/VoiceQueryButton.tsx` — floating mic FAB on UserDashboard at `bottom-40 right-4` (above SOS at `bottom-20`). Phases: idle / listening (animated bars + interim transcript) / thinking / ready / speaking. Tap-to-cancel.
- **Speech input (STT)**: browser Web Speech API via `src/hooks/useVoiceRecognition.ts` — on-device, no API key, no network. Hides FAB if unsupported.
- **Speech output (TTS)**: server-side via **ElevenLabs** (`eleven_turbo_v2_5`, voice **Sarah** `EXAVITQu4vr4xnSDxMaL` — clear warm female). Edge function returns `{ answer, audio: "data:audio/mpeg;base64,..." }`. Client plays via `new Audio(dataUrl)`. **Browser `speechSynthesis` kept only as fallback** when `audio` is null.
- **Audio gesture unlock**: mic tap calls `ensureAudioReady()` AND plays a silent `<audio>` buffer to unlock `HTMLAudioElement.play()` on iOS/Android — required for post-fetch auto-play.
- **Backend**: `supabase/functions/voice-query/index.ts` (verify_jwt=true). Pre-fetches all health context (refills, nutrition, meds today, check-ins, passport score, appointments) in parallel using JWT-bound supabase client — simpler & more reliable than tool calling. Then calls Lovable AI (`google/gemini-2.5-flash`) for the natural-language answer, then ElevenLabs for MP3 (returns `null` audio on TTS failure — client falls back to browser TTS).
- **Editable prompt chips**: stored in `user_settings.settings.voiceQueryPrompts: string[]` (defaults from `DEFAULT_VOICE_QUERY_PROMPTS` in `src/hooks/useUserSettings.ts`). Max 8 prompts, 70 chars each. Add via inline input, delete via `×` button. Persisted via existing 500ms debounce.
- **Robustness**: auto-retry once on 502/503/504, 3-second backoff retry on 429, offline detection (`navigator.onLine`), in-flight request cancellation via AbortController on close.
- **Secrets**: `LOVABLE_API_KEY` (existing), `ELEVENLABS_API_KEY` (added Phase 1).
- **Privacy**: STT happens on-device; only the final text query crosses the network. TTS audio is generated server-side and streamed back as base64 MP3.
- **v1 free for all users**; Pro gating can be added later via `useFeatureGate("Voice Assistant")`.
- **Phase 2 (not built)**: voice picker in Settings (Sarah/Lily/Jessica/George), playback speed slider, Hindi auto-detect via `navigator.language` + `eleven_multilingual_v2`, in-session conversation memory for follow-ups.
