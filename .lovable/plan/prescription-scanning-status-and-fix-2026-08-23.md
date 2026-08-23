# Prescription Scanning: status and fix

## What I confirmed

There are two prescription-scanning paths in the app, and only one of them is blocked:

1. **Diagnosis / Prescription Scanner** (My Health → Tablets → scanner card)
   Calls the `health-tools` backend function, which uses the managed Lovable AI key. **Working — no key needed.**

2. **Quick camera scan inside "Add Medication"** (auto-fills the medicine name from a photo)
   Calls the `extract-prescription` backend function, which is hard-wired to OpenAI and reads an `OPENAI_API_KEY` secret. That secret is **not configured** in this project (checked the secret list — it is absent). So this path currently returns the error "OpenAI API key not configured" on every scan.

So yes: the new quick-scan feature is in the app but blocked on a missing OpenAI key.

## Recommendation

Don't buy/add an OpenAI key. Rewrite `extract-prescription` to use the same managed Lovable AI Gateway the rest of the app already uses (nutrition analysis, health tools, voice). It has vision support, needs no new secret, and bills through existing credits.

## Technical change

- `supabase/functions/extract-prescription/index.ts`
  - Replace the OpenAI call with a Lovable AI Gateway chat request using `LOVABLE_API_KEY` and a Gemini vision model (same model choice as other vision calls in the project).
  - Keep the same request contract (`{ imageBase64 }`) and response contract (`{ drugName }`) so `MedicationList.tsx` needs no change.
  - Send the image as an `image_url` data URL, keep the existing "name + dosage only, else Unknown" system prompt.
  - Add gateway error handling consistent with the rest of the app (402 credits / 429 rate limit surfaced as readable messages), and CORS on every response.
- No database, UI, or client changes.

## Alternative

If you specifically want OpenAI for this scan, I can leave the function as-is and you supply an OpenAI API key to store as a secret instead.
