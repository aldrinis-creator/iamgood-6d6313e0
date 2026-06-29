# Plan: Conversational Voice Agents + Customer Services

Extend the existing "Hey Check-iN" voice assistant into a real **conversational agent** (multi-turn, with companion mode) for both Users and Guardians, and add a unified **Customer Services** hub (WhatsApp + tel call + extended FAQ).

## Part A — Conversational Voice Agent

### 1. Backend: upgrade `voice-query` → `voice-agent`

- New edge function `supabase/functions/voice-agent/index.ts` (keep old `voice-query` for back-compat one-shots).
- Accepts `{ messages: [{role, content}], mode: "health" | "companion", persona: "user" | "guardian" }`.
- Pre-fetches context based on persona:
  - **User**: today's meds/check-ins/nutrition/appointments/passport (as today).
  - **Guardian**: active ward summary — missed check-ins, ward meds adherence today, last vitals, last known location safe-zone status, pending alerts.
- Mode-aware system prompt:
  - `health` → factual, concise (current behavior).
  - `companion` → warm small-talk, mindfulness nudges, gentle reminders, emotional check-ins. Never gives medical diagnoses.
- Same Gemini → ElevenLabs (Sarah) pipeline; returns `{ answer, audio }`.
- Multi-turn: client sends rolling last 10 messages; server trims to fit.

### 2. Frontend: upgrade `VoiceQueryButton.tsx` → `VoiceAgentButton.tsx`

- Replace single tap-to-talk with a **conversation sheet** (slide-up `Sheet`):
  - Transcript bubbles (user + AI), auto-scroll.
  - Mic button at bottom (tap to talk, tap to stop).
  - Mode toggle pills at top: **Ask** (health Q&A) / **Chat** (companion).
  - "End conversation" button clears history.
- Conversation state held in component (no DB persistence — privacy by default).
- Reuses `useVoiceRecognition` (STT) + audio unlock from current implementation.
- Available on **UserDashboard** (existing FAB position) and added to **GuardianDashboard** with guardian context.

### 3. Settings

- New section in Settings → "Voice Assistant":
  - Default mode (Ask / Chat).
  - Voice picker (Sarah / Lily / George) — Phase 2 from existing memory.
  - Persisted in `user_settings.settings.voiceAgent`.

### 4. Free for all

- No gating. Uses existing `LOVABLE_API_KEY` + `ELEVENLABS_API_KEY` secrets (already configured).
- Soft per-user daily cap (e.g. 50 turns/day) tracked in memory map in edge function to prevent runaway costs; surfaces friendly "you've reached today's chat limit" message.

## Part B — Customer Services Hub

### 1. New page: `src/pages/CustomerService.tsx`

Three primary actions, each a big tappable card:

1. **💬 WhatsApp us** — opens `https://wa.me/<SUPPORT_NUMBER>?text=<prefilled context>` with user name + plan + app version pre-filled.
2. **📞 Call support** — `tel:<SUPPORT_NUMBER>` (Mon–Sat 9–6 IST hours displayed).
3. **✉️ Email a ticket** — reuses existing `ContactUsForm`.

Below: searchable FAQ (reuses `faqData` / `guardianFaqData` based on role).

### 2. Routing & nav entry

- Route: `/support` (and `/guardian/support`).
- Added to:
  - User: Settings → "Help & Support" tile (replaces current `Help` link, which becomes FAQ-only inside this page).
  - Guardian: Settings → same.
  - Bottom of `Help.tsx` / `GuardianHelp.tsx` → "Still need help? Contact us" → links here.

### 3. Support number config

- Stored as `VITE_SUPPORT_WHATSAPP` and `VITE_SUPPORT_PHONE` in `.env` (public, non-secret).
- Defaults to existing Futurewave support number — confirm with you before publishing.

### 4. WhatsApp template (optional Phase 2)

- If you want **inbound** WhatsApp messages routed to a CRM/inbox, that needs MSG91 Inbound Webhook setup — flagging as out-of-scope for v1 since `wa.me` deep link is sufficient for outbound conversation.

## Out of scope (call out)

- Real-time WebRTC voice (ElevenLabs Conversational AI) — keeping STT→LLM→TTS as agreed.
- Voice agent actions (logging meds, triggering SOS by voice) — read-only Q&A + companion only.
- AI chatbot for customer service triage — using human-routed WhatsApp/phone/email; can add later.
- Twilio phone hotline — using `tel:` deep link only.

## Files touched

**New**: `supabase/functions/voice-agent/index.ts`, `src/components/VoiceAgentButton.tsx` (replaces VoiceQueryButton), `src/components/voice/ConversationSheet.tsx`, `src/pages/CustomerService.tsx`.
**Modified**: `src/pages/UserDashboard.tsx`, `src/pages/GuardianDashboard.tsx`, `src/pages/Settings.tsx`, `src/pages/GuardianSettings.tsx`, `src/pages/Help.tsx`, `src/pages/GuardianHelp.tsx`, `src/App.tsx` (routes), `src/hooks/useUserSettings.ts` (voiceAgent defaults).

## Questions before build

1. **Support phone / WhatsApp number** to wire into the Customer Service page? (I'll use `+91-7045868482` placeholder otherwise.)
2. **Daily voice-agent turn cap per user** — OK with 25/day, or different?