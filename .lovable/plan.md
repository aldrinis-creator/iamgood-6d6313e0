# Fix voice assistant hallucination on ambulance booking

## Problem
When a user asks "How do I book an ambulance?", the voice assistant replies "The app doesn't directly book ambulances…" — a hallucination. The product KB (`supabase/functions/_shared/product-kb.ts`) already documents ambulance booking under **Services → Ambulance**, with guardian-on-behalf support. The model is ignoring the KB and falling back on a generic safety disclaimer, likely because:

1. The system prompt buries the KB after ~10 lines of rules, and the "brief safe answer + see a doctor" rule for health advice bleeds into emergency-adjacent questions.
2. There's no explicit instruction that when a how-to answer *is* in the KB, the assistant MUST use it instead of defaulting to "call emergency services".
3. The ambulance section in the KB is short (one line) and easy for the model to miss when scanning.

## Fix (voice assistant only — same issue does not repro on the text `product-assistant` because its prompt is stricter)

### 1. `supabase/functions/voice-query/index.ts` — tighten the system prompt
- Reorder rules so the product-KB rule comes **before** the health-advice rule.
- Add an explicit instruction: *"If the knowledge base describes a feature that answers the question (e.g. ambulance booking, SOS, vault, refills), you MUST use it. Do not fall back to 'call emergency services' or 'the app doesn't do that' when the feature exists."*
- Add a short exemplar for the ambulance case so the model anchors correctly:
  *Example — Q: "How do I book an ambulance?" → A: "Open Services, tap Ambulance, pick a provider and confirm — guardians can also book on behalf of their ward."*
- Keep the existing off-topic / personal-data / spoken-tone rules unchanged.

### 2. `supabase/functions/_shared/product-kb.ts` — expand the Ambulance section
Promote ambulance from a one-liner to its own clear block so both the voice assistant and the text chat retrieve it reliably:

```
## Ambulance Booking
- Open Services (bottom nav) → Ambulance.
- Choose a provider, confirm pickup location, and tap Book.
- Available on all plans; pay-per-use tariff applies at the time of booking.
- Guardians can book on behalf of their ward from the Guardian → Services tab; the ward's emergency card (blood group, allergies, conditions, emergency contacts) is auto-attached.
- For life-threatening emergencies also press the red SOS button so all guardians are alerted with your live location.
```

## Out of scope
- No frontend changes.
- No changes to the `product-assistant` edge function (already answers this correctly from the same KB, but it will also benefit from the expanded ambulance section).
- No model swap or embeddings work.

## Verification
1. Redeploy `voice-query`, tap the mic, ask *"How do I book an ambulance?"* → spoken answer describes Services → Ambulance flow, not "call emergency services".
2. Ask *"Can my guardian book an ambulance for me?"* → mentions Guardian → Services and auto-attached emergency card.
3. Regression: ask *"How many meds have I taken today?"* → still answers from the personal-data snapshot.
4. Regression: ask *"What's the Pro plan?"* → still answers from the KB.
