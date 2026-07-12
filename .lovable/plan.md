## Goal
Expand the "Ask Check-iN" assistant's knowledge by folding the existing user + guardian FAQs into its knowledge base, so it can answer more questions accurately without duplicating content.

## Approach
Keep a single source of truth for FAQs (the `src/data/*.ts` files the app already renders on the Help pages) and generate the assistant's KB text from them at build/deploy time — so any future FAQ edit automatically reaches the bot.

## Changes

1. **Shared FAQ source, usable by both app and edge function**
   - Move the FAQ arrays from `src/data/faqData.ts` and `src/data/guardianFaqData.ts` into plain TS modules under `supabase/functions/_shared/` (e.g. `faq-user.ts`, `faq-guardian.ts`) exporting the same typed arrays.
   - Re-export them from `src/data/faqData.ts` / `src/data/guardianFaqData.ts` so the existing Help pages keep working unchanged.

2. **Compose the KB from curated content + FAQs**
   - In `supabase/functions/_shared/product-kb.ts`, keep the current curated `PRODUCT_KB` markdown (features, pricing, ambulance section, etc.) as the authoritative core.
   - Append two auto-generated sections built from the FAQ arrays:
     - `## User FAQs` — each entry rendered as `### Q: …` / `A: …`.
     - `## Guardian FAQs` — same shape, clearly labelled as guardian-specific.
   - Tag each block with its audience so the model can pick the right variant for the asker.

3. **Prompt tweaks in `product-assistant/index.ts`**
   - Update the system prompt to state that curated sections take precedence over FAQ entries when they conflict (curated content is the newer, authoritative source).
   - Add a rule: if the question is guardian-specific, prefer the Guardian FAQ section; otherwise prefer User FAQ.
   - Keep the existing guardrails (personal-data redirect, off-topic redirect, no invented features).

4. **Size / token safety**
   - FAQs are large; measure the combined KB length. If it exceeds a safe budget for `gemini-2.5-flash-lite`, switch the edge function to a lightweight retrieval step: keyword-match the top ~8 FAQ entries for the user's question and only inline those, alongside the full curated KB. No embeddings/vector DB needed for this volume.

5. **Suggested-question pills**
   - Optionally surface 2–3 rotating suggestions sourced from FAQ titles (client-side only, in `ProductHelpChat.tsx`) so users discover newly-answerable topics. No backend change required.

## Verification
- Deploy `product-assistant`, then ask several questions that previously failed but exist in the FAQs (e.g. "How do I nominate a guardian?", "What happens if I miss a check-in?", guardian-side "How do I accept a nomination?").
- Confirm curated answers still win where they overlap (e.g. ambulance booking).
- Confirm Help pages still render identically.

## Out of scope
- No vector search / embeddings.
- No changes to the voice agent (`voice-agent` / `voice-query`) — this plan is scoped to the text "Ask Check-iN" bot. Happy to mirror it there in a follow-up if you want.
