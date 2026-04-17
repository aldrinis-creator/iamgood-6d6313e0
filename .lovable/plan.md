
## What that message means

The mic flow is probably reaching the Voice Assistant endpoint, but the endpoint is rejecting the request before it returns a normal answer. In plain English: the voice feature is not answering your question yet because the backend is failing first.

## Most likely cause I found

`voice-query` is configured differently from the project’s other working functions:

- `supabase/config.toml` has `voice-query` set to `verify_jwt = true`
- the function code also does its own auth check with `auth.getUser()`
- the function uses a smaller CORS header list than other working functions

That combination can cause the platform to reject the request early, which is why the app only shows the generic “Edge Function returned a non-2xx status code” message instead of a useful explanation.

## Fix plan

1. **Align `voice-query` with the project’s working function pattern**
   - Change `voice-query` to the same auth model used by other web-called functions
   - Keep auth validation inside the function code
   - Remove the config mismatch that can block the request before logs appear

2. **Harden CORS on `voice-query`**
   - Expand `Access-Control-Allow-Headers` to the full standard header set already used elsewhere in the app
   - Make sure `OPTIONS`, success, and error responses all return the same CORS headers

3. **Improve error reporting in `VoiceQueryButton.tsx`**
   - Parse the function response more defensively
   - Show user-friendly errors like:
     - “Please sign in again”
     - “Voice assistant is temporarily unavailable”
     - “AI service returned an error”
   - Avoid the vague non-2xx fallback when the server actually sent a reason

4. **Deploy and verify**
   - Redeploy `voice-query`
   - Test it directly with an authenticated function call
   - Check function logs immediately after a test query
   - Confirm one real prompt works end-to-end:
     - refills due
     - nutrition metrics
     - calorie goal progress

5. **Fallback if tool-calling is the real issue**
   - If auth/CORS are fixed but the AI call still fails, simplify the function:
     - fetch the user’s data first
     - send that context to AI in one plain request
     - return a spoken answer without tool-calling
   - This is less elegant, but more reliable for v1

## Files to update

- `supabase/config.toml`
- `supabase/functions/voice-query/index.ts`
- `src/components/VoiceQueryButton.tsx`

## Expected result after the fix

Instead of the generic failure message, the voice assistant should either:
- answer the question normally, or
- show a clear reason if something is still wrong

## Recommendation

Do not drop it yet. This looks like an integration/config issue, not a bad feature idea. The fastest next step is to fix auth/CORS alignment first, because that is the most likely blocker.
