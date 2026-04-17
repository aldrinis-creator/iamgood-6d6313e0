---
name: Voice Query Assistant
description: "Hey Check-iN" voice assistant — tap-to-talk mic FAB, browser SpeechRecognition, edge function with AI tool calling, speechSynthesis output
type: feature
---
Voice Query Assistant ("Hey Check-iN"):

- **UI**: `src/components/VoiceQueryButton.tsx` — floating mic FAB on UserDashboard, positioned bottom-right at `bottom-40` (above SOS at bottom-20). States: idle (primary) / listening (destructive pulse) / thinking (accent spin) / speaking (success). Tapping mic again cancels.
- **Speech input**: browser Web Speech API via `src/hooks/useVoiceRecognition.ts` (no API key). Hides FAB if unsupported.
- **Speech output**: `speak(text)` and `stopSpeaking()` exported from `src/lib/audioAlerts.ts`, reuses primed `speechSynthesis`.
- **Backend**: `supabase/functions/voice-query/index.ts` (verify_jwt=true). Uses Lovable AI `google/gemini-3-flash-preview` with tool calling. Tools: `get_refills_due`, `get_nutrition_metrics`, `get_calorie_progress`, `get_medications_today`, `get_check_in_status`, `get_health_passport_score`, `get_appointments_today`. All queries scoped to user via JWT-bound supabase client. IST-aware day bounds.
- **Flow**: client transcribes → POST text to `voice-query` → AI picks tool → server runs tool with user context → AI composes 1–2 sentence spoken answer → client `speak()`s reply.
- **No new secrets** — uses existing `LOVABLE_API_KEY`.
- **Privacy**: transcription on-device; only text query crosses the network.
- **v1 free for all users**; Pro gating can be added later via `useFeatureGate("Voice Assistant")`.
- **Phase 2 (not built)**: continuous wake-word detection matching `/hey check[\-\s]?in/i`, behind a Settings toggle.
