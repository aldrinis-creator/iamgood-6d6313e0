# Symptom Checker not responding — root cause & fix

## Root cause

Recent `health-tools` edge function calls are all returning **HTTP 402 — "AI credits exhausted. Please add funds."** (confirmed in edge logs for function id `2e6364bc…`, last 3 POSTs all 402).

The function works correctly. The Lovable AI Gateway workspace credit balance is depleted, so Gemini calls are being rejected.

A secondary issue masks this: `SymptomChecker.tsx` swallows the gateway's 402 message into a generic `"Failed to get response"` toast, so the user can't tell why nothing comes back.

## Fix — two parts

### 1. Top up Lovable AI credits (required, user action)

Open **Workspace → Settings → Usage / AI Credits** and add credits (or upgrade plan). Once balance is restored, the Symptom Checker will respond immediately — no code change needed for that.

### 2. Surface real backend errors in the chat (code change)

In `src/components/health-tools/SymptomChecker.tsx`, `send()`:

- When `supabase.functions.invoke` returns an `error` (non-2xx like 402/429), read the JSON body from `error.context.response` (or fallback) and toast that message instead of the generic "Failed to get response".
- Specifically map:
  - 402 → "AI credits exhausted. Please top up in Workspace settings."
  - 429 → "AI is busy, please try again in a moment."
- Append an assistant message like *"⚠️ I couldn't respond: <reason>"* so the failure is visible inline, not just as a fleeting toast.

No edge function, schema, or other component changes required.

## Verification

After topping up credits:
1. Open Health Tools → Symptom Checker.
2. Send "Headache and fever".
3. Expect a streamed Gemini response within ~3s and no toast.
4. Check edge function logs — POSTs return 200.
