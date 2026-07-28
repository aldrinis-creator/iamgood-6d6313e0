## Graceful AI-unavailable fallback for health tools

When the AI Gateway returns 402 (credits exhausted), 403 (`credit_limit_reached`), or 429 (rate limited), the affected tools currently fail silently or show a generic "AI error". Users can't tell whether it's their photo, their network, or a workspace-level block.

### What to change

**1. Shared helper**
Add `src/lib/aiErrorMessage.ts` exporting `getAiErrorMessage(status, body?)` that maps:
- 402 → "AI analysis is temporarily unavailable — workspace credits exhausted. Please contact your admin."
- 403 + `credit_limit_reached` → "AI analysis is paused — workspace credit limit reached. An admin can raise the limit in workspace settings."
- 429 → "Too many requests right now. Please try again in a minute."
- other → "AI service unavailable. Please try again shortly."

**2. Edge functions — propagate structured error**
Update these functions so they forward the upstream status and a machine-readable `code` (`credits_exhausted` | `credit_limit_reached` | `rate_limited` | `ai_error`) with the same HTTP status back to the client, instead of collapsing everything to 500:
- `nutrition-advisor`
- `tongue-analysis`
- `urine-analysis`
- `pill-identifier`
- `doctor-visit-analysis`
- `product-assistant`
- `voice-agent` (if it calls the gateway)
- `health-tools-analysis` (any sibling analyzers)

Each already has partial 402/429 handling; standardize the response shape: `{ error, code, message }`.

**3. Frontend — surface the message**
In each caller (primarily `NutritionAdvisor.tsx`, the health-tools components under `src/components/health-tools/`, `ProductHelpChat.tsx`), when `supabase.functions.invoke` returns a non-2xx, read the structured error and toast (or inline-render) the friendly message from `getAiErrorMessage`. For image-analysis screens, also render an inline banner in the results panel so retries are obvious.

**4. No changes to**
- Business logic, prompts, or model selection.
- The credit balance itself (that's a workspace-settings action, not code).

### Notes
- Purely presentational — no schema, RLS, or cron changes.
- Once the workspace credit limit is raised, tools resume automatically; this change only makes the failure legible.
