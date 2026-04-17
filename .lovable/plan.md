

## Voice Query Assistant — "Hey Check-iN"

### What it does
A floating mic button on the User Dashboard. User taps mic → speaks question → app transcribes → AI interprets intent → fetches data → speaks answer back. Wake-word ("Hey Check-iN") optional via continuous listening toggle in Settings.

### Approach

**Speech input** — Use Web Speech API (`webkitSpeechRecognition`) for free, on-device transcription. Falls back gracefully on unsupported browsers. No new API keys needed for v1.

**Speech output** — Reuse existing `playVoiceReminder` from `src/lib/audioAlerts.ts` (already-primed `speechSynthesis`).

**Intent + answer** — One edge function `voice-query` calls Lovable AI (`google/gemini-3-flash-preview`) with **tool calling** to pick the right query handler. Tools:
- `get_refills_due` — meds where `remaining_quantity <= low_stock_threshold`
- `get_nutrition_metrics` — today's `meal_logs` totals (cal/protein/fiber/sodium/potassium) vs `nutrition_personas` goal
- `get_calorie_progress` — today's calories vs daily goal + % + remaining
- `get_medications_today` — today's `medication_logs` status (taken/pending/missed)
- `get_check_in_status` — today's `check_ins` rows
- `get_health_passport_score` — latest `health_passport_scores` row
- `get_appointments_today` — today's appointments

The function executes the chosen tool server-side (using user's JWT), then calls AI again to compose a natural spoken answer (1–2 sentences, IST-aware).

### UI

**`src/components/VoiceQueryButton.tsx`** (new)
- Floating mic FAB above SOS button on `/dashboard` (bottom-right, offset)
- States: idle → listening (pulse) → thinking → speaking
- Tap to start, tap to cancel
- Shows transcript + answer in a small dismissible Sheet/Card
- Sample prompts shown on first open

**Wake-word (Phase 2, behind setting)** — Continuous `SpeechRecognition` loop matching `/hey check[\-\s]?in/i`; off by default (battery cost).

### Files

| File | Action |
|------|--------|
| `supabase/functions/voice-query/index.ts` | New — AI tool-calling + data fetch + spoken answer |
| `src/components/VoiceQueryButton.tsx` | New — mic FAB + transcript/answer UI |
| `src/hooks/useVoiceRecognition.ts` | New — Web Speech API wrapper |
| `src/pages/UserDashboard.tsx` | Mount `<VoiceQueryButton />` |
| `src/lib/audioAlerts.ts` | Export reusable `speak(text)` helper |
| `mem://features/voice-query` | New memory file documenting the system |

### Notes / decisions
- **No new secrets** — uses existing `LOVABLE_API_KEY`
- **Privacy** — transcription happens in browser; only the text query goes to the edge function
- **User-only** — gated to `role === "user"` (guardians get a future variant for ward queries)
- **Freemium** — gate behind Pro tier via existing `useFeatureGate` (consistent with other AI features)
- **Phase 1 = tap-to-talk**. Wake-word added later behind a Settings toggle.

### Open question
Should I add a Pro-tier gate (`useFeatureGate("Voice Assistant")`) or make it free for all users in v1?

