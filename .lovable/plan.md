

## Fix Voice Assistant — deploy + harden error handling

### Diagnosis
- The `voice-query` edge function has **zero logs**, meaning the request never reached it. Most likely cause: function not deployed yet (it was created in the previous turn but deployment may have failed silently).
- The client's catch-all error message ("Sorry, something went wrong.") hides the real cause, so we can't distinguish between deploy failure, model rejection, or auth issue.

### Fix

1. **Redeploy `voice-query`** explicitly via `supabase--deploy_edge_functions` and confirm with `curl_edge_functions`.

2. **Improve error surfacing in `VoiceQueryButton.tsx`** — show the actual error message from the edge function (e.g. "AI gateway error", "Unauthorized") instead of a generic toast. Log the full `error` object to console.

3. **Harden `voice-query/index.ts`**:
   - Log every step (received query, chosen tool, tool result size, AI status codes) so we can debug from edge logs.
   - Handle the case where the model returns no `tool_calls` AND no content (fallback message).
   - Validate model name — switch default to `google/gemini-2.5-flash` (more stable than `gemini-3-flash-preview` for tool calling) with `gemini-3-flash-preview` retained as fallback.
   - Return a more specific error body so the client can surface it.

4. **Verify end-to-end** by curling the deployed function with a test query and reading the new logs.

### Files
| File | Action |
|------|--------|
| `supabase/functions/voice-query/index.ts` | Add logging, switch default model to `google/gemini-2.5-flash`, fallback for empty responses |
| `src/components/VoiceQueryButton.tsx` | Surface real error message; log full error to console |

### If still broken after the fix
If logs reveal the AI gateway rejects tool-calling on Gemini for our payload shape, I'll fall back to a simpler approach: a single non-tool-calling AI call where the model is given a JSON of pre-fetched user context (refills, today's meals, today's meds, score) and asked to answer — slower but bulletproof. We'll decide based on the first round of logs.

### Drop vs fix recommendation
**Fix.** The infra is in place; we just need deployment confirmation and better diagnostics. Voice is a high-value differentiator and we're <30 min from working.

