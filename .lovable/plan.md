

## Goals
1. Better-sounding female voice (clear, pleasant, consistent across devices)
2. Customizable question chips (add/delete sample prompts)
3. Recommendations to make the assistant feel polished and lovable

## 1. Female voice — recommended approach

The current `speechSynthesis` voice is whatever the OS provides. Quality varies wildly (great on iOS, robotic on Windows/Android Chrome). To get a **consistently clear, pleasant female voice**, we should switch to **server-side TTS via ElevenLabs** (the platform supports it natively).

**Recommended voice: "Sarah"** (`EXAVITQu4vr4xnSDxMaL`) — clear, warm, neutral American female. Alternatives the user can pick later: **Lily** (soft British), **Jessica** (younger, friendly), **Matilda** (calm, narrator).

**Implementation:**
- Add `ELEVENLABS_API_KEY` secret (one-time prompt to user)
- `voice-query` edge function: after generating the text answer, call ElevenLabs TTS (`eleven_turbo_v2_5` for low latency) → return `{ answer, audio: "data:audio/mpeg;base64,..." }`
- `VoiceQueryButton.tsx`: play `new Audio(data.audio)` instead of `speechSynthesis`. Falls back to current `speechSynthesis` if `audio` field is missing.
- Keeps "Tap to hear" button (now plays the high-quality MP3) and "Hear again" replay.

Why this is better than browser TTS: same voice on every device, much more natural prosody, no gesture-loss issues (HTMLAudioElement plays reliably post-fetch once audio is unlocked, which we already do).

## 2. Add/delete question chips

Currently the 4 sample prompts (`SAMPLES`) are hardcoded. We'll make them user-editable.

**Approach (simple, no new table needed):**
- Store custom prompts in existing `user_settings` (jsonb column already exists for misc preferences) under key `voice_query_prompts: string[]`.
- In `VoiceQueryButton.tsx`:
  - Show stored prompts (default to current 4 if empty)
  - Each chip gets a small `×` to delete
  - Below the list: a small "+ Add question" inline input (max 60 chars, max 8 prompts total)
- Persist via the existing `useUserSettings` 500ms debounce flow — no migration needed.

Optional later: a "Reset to defaults" link.

## 3. Recommendations to make it robust & lovable

**Quick wins (small effort, big delight):**
- **Visual waveform during listening** — animated bars (CSS only) instead of just pulse, signals "I'm hearing you"
- **Show interim transcript live** as user speaks (already captured in `interim`, just style it bigger)
- **"Listening… speak now" hint** with a subtle countdown (auto-stops at 8s of silence)
- **Haptic feedback** on mobile (`navigator.vibrate(50)`) when listening starts/stops
- **Greeting on first open** — "Hi, I'm your Check-iN assistant. What would you like to know?" (spoken once)
- **Conversation memory within session** — remember last 3 Q&A so user can ask follow-ups like "and tomorrow?" (in-memory only, cleared on close)

**Robustness:**
- **Network retry** — auto-retry once on 502/timeout before showing error
- **Offline detection** — show "You're offline" instead of cryptic error when `navigator.onLine === false`
- **Request cancellation** — abort in-flight request if user closes the card
- **Rate-limit UX** — friendly "Give me a sec…" with auto-retry after 3s on 429
- **Hindi support** — detect `navigator.language` and pass to ElevenLabs (`eleven_multilingual_v2` handles Hindi well); also set SpeechRecognition `lang` accordingly

**Lovable touches:**
- **Personality** — small variations in answer tone ("Looking good!", "Heads up —") per query type
- **Voice picker in Settings** — let user choose between 3-4 ElevenLabs voices (Sarah, Lily, Jessica, George for male)
- **Speed slider** — playback speed 0.8x–1.2x for elderly users who want slower speech
- **Recent questions history** — last 5 questions in a "Recently asked" section above samples

## What I propose to build now (Phase 1)

1. Add `ELEVENLABS_API_KEY` secret + ElevenLabs TTS in `voice-query` (Sarah voice, MP3 output)
2. Switch `VoiceQueryButton` to play returned `data:audio/mpeg;base64,...` via `new Audio()`
3. Editable question chips (add/delete, persisted in `user_settings`)
4. Live interim transcript + animated listening indicator
5. Network retry + offline handling

Phase 2 (later, if you like Phase 1): voice picker in Settings, speed control, Hindi auto-detect, conversation memory.

## Files to update

- `supabase/functions/voice-query/index.ts` — add ElevenLabs TTS step
- `src/components/VoiceQueryButton.tsx` — play MP3, editable chips, better listening UI, retry/offline
- `src/hooks/useUserSettings.ts` — add `voiceQueryPrompts` field (or store under existing misc bag)
- `.lovable/memory/features/voice-query.md` — update memory with new architecture

## One thing I need from you

I'll need to add the **ElevenLabs API key** as a secret. You can get it free from [elevenlabs.io](https://elevenlabs.io) (free tier = 10k characters/month, ~30 min of speech — plenty for testing). I'll prompt you for it once you approve.

