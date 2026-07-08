# Product Help Assistant — extend voice + add floating chat bubble

## Goal
Turn "Hey Check-iN" into a dual-purpose assistant that answers both **personal health data** questions (already works) and **product/how-to** questions (features, registration, guardian nomination, vault, medications, subscriptions, SOS, etc.), and expose it to logged-out visitors too via a floating chat bubble on every page.

## Deliverables

### 1. Curated Knowledge Base (repo-versioned markdown)
New folder `src/data/productKnowledge/` with focused topic files:
- `overview.md` — what Check-iN is, roles (user vs guardian), IST scheduling model
- `registration.md` — 4-step wizard, phone-first OTP, nomination-gated guardian signup
- `guardians.md` — nomination tokens, 72h expiry, 3-ward limit, accept/reject flow, guardian profile scope
- `check-ins.md` — 7 AM / 12 PM / 7 PM windows, missed-check-in escalation
- `medications.md` — schedules, adherence T+0…T+50, refills, Jan Aushadhi, batching
- `sos.md` — trigger, active banner, resolution, ambulance booking
- `vault.md` — categories, nominee claims, PIN escrow, release tokens
- `health-tools.md` — passport, face scan, vitals, symptom checker, nutrition
- `journey.md` — Map My Journey, geofencing, safe zones, journey reports
- `subscriptions.md` — Free / Basic ₹99 / Pro ₹199 / Premium+ tiers, what's included, payment via futurewave.in/pay
- `privacy-security.md` — RLS, encryption, offline profile, data control
- `troubleshooting.md` — common issues, how to contact support

A single `src/data/productKnowledge/index.ts` concatenates them into one exported `PRODUCT_KB` string (~10–20k tokens, well under Gemini's context window). Content is distilled from existing `src/data/faqData.ts`, `guardianFaqData.ts`, and `.lovable/memory/features/*` — no duplication of source of truth beyond markdown.

### 2. Backend — extend `voice-query` + add public `product-assistant`
- **Modify `supabase/functions/voice-query/index.ts`**: inject `PRODUCT_KB` into the system prompt and update rules so the assistant answers product/how-to questions from the KB in addition to personal data questions. Add explicit guidance: if question is about "how to use / where to find / what is X", answer from the KB; if about "my data", use the pre-fetched snapshot.
- **New `supabase/functions/product-assistant/index.ts`** with `verify_jwt = false` (public). Text-only (no TTS to keep it cheap and instant), streams via AI SDK using `google/gemini-2.5-flash-lite`. System prompt: KB + strict guardrails ("only answer from provided context; never invent features; if asked about personal data, tell the visitor to sign in and use the voice assistant"). Rate-limited by IP (in-memory token bucket).
- Both functions embed the same KB module by copying it into `supabase/functions/_shared/product-kb.ts` at build (or importing via relative path — Deno supports importing repo files under `../../../src/data/productKnowledge/index.ts` when included in the function bundle; if that fails, duplicate as a `_shared` copy kept in sync).

### 3. Frontend — Floating Chat Bubble (`ProductHelpChat.tsx`)
New global FAB rendered from `AppLayout.tsx`, positioned `bottom-4 right-4` (below SOS at `bottom-20` and voice mic at `bottom-40` — reserve `bottom-4` for logged-in users; for logged-out users on marketing/legal pages, it's the only FAB so `bottom-6` is fine).
- Icon: `MessageCircleQuestion` from lucide (help-flavored, distinct from voice mic and SOS).
- Tap → opens a bottom-sheet chat panel (max-width 430px per project constraint), title "Ask Check-iN".
- Message list with markdown rendering (`react-markdown`), user bubbles use `primary` / `primary-foreground`, assistant messages plain text on surface.
- Suggested-question chips shown on empty state: "How do I add a guardian?", "What's in the Pro plan?", "How does SOS work?", "How do I upload a document to the vault?".
- Composer: single-line input + send button; disabled while streaming; shows a "Thinking..." shimmer while waiting.
- Uses AI SDK `useChat` with `DefaultChatTransport` pointed at `/functions/v1/product-assistant`, no persistence (session-only, cleared on page reload — matches "casual help" intent).
- Hidden on `/admin/*` routes.

### 4. Guardrails and UX
- System prompt for both surfaces: answer only from KB; if unknown, direct to `/help` or `/contact`; never invent features; keep answers ≤3 sentences; use plain language suitable for elderly users.
- Voice assistant continues to answer personal data questions as today; product questions get short spoken answers (already suits Sarvam TTS 1500-char cap).
- Public chat cannot access any user data — no Supabase client, no auth header, KB-only.

## Files touched
**New:**
- `src/data/productKnowledge/*.md` (12 files)
- `src/data/productKnowledge/index.ts`
- `src/components/ProductHelpChat.tsx`
- `supabase/functions/product-assistant/index.ts`
- `supabase/functions/_shared/product-kb.ts` (mirror of KB for Deno)

**Edited:**
- `supabase/functions/voice-query/index.ts` — add KB to system prompt, update rules
- `src/components/AppLayout.tsx` — mount `<ProductHelpChat />` globally (hide on admin)
- `supabase/config.toml` — register new function with `verify_jwt = false`

## Out of scope for v1
- Embeddings / pgvector (revisit if KB grows past ~30k tokens)
- Persistent chat history for the product bot
- Voice input on the product chat bubble (text only)
- Multilingual (English only; matches Sarvam's current `en-IN` setup)

## Verification
1. Ask voice mic "How do I nominate a guardian?" → spoken answer sourced from KB, not hallucinated.
2. Ask voice mic "How many meds have I taken today?" → still works from personal data snapshot.
3. Logged out on `/`, tap the help bubble, ask "What's the Pro plan?" → streams a KB-grounded reply.
4. Ask bubble "What's my blood pressure?" → politely redirects to sign in.
5. Bubble hidden on `/admin`, visible on marketing, legal, dashboard, and guardian pages.
