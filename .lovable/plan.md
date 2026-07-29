## Progress

Good news: requests now reach the function (config.toml fix worked — no more gateway 401). The edge function logs show repeated `Unauthorized request attempt` — the 401 is now coming from **our own secret check inside the function**, not the Supabase gateway.

## Likely causes

The function only accepts the secret in two places:
- `Authorization: Bearer <secret>`
- `api_key: <secret>` (exact lowercase custom header)

It will 401 if Orange Labs sends any of:
- `x-api-key: <secret>` (common convention)
- `apikey: <secret>` (Supabase-style, no underscore)
- `Authorization: <secret>` (no `Bearer ` prefix)
- The right header but a **different secret value** than the one saved in `ORANGE_WEBHOOK_SECRET`

The existing "Headers received" log line isn't visible in the log tail we have, so we can't yet see what Orange actually sent.

## Plan

1. **Temporarily widen accepted auth headers and improve diagnostics** in `supabase/functions/orange-webhook/index.ts`:
   - Accept the shared secret from any of: `Authorization: Bearer …`, `Authorization: …` (raw), `api_key`, `apikey`, `x-api-key`.
   - On 401, log:
     - The full list of header names received (names only, no values).
     - For each auth-ish header, whether it was present and whether its length matched the stored secret's length (never log the raw value).
     - A short SHA-256 prefix (first 8 hex chars) of the received value vs. the stored secret — enough to confirm value match/mismatch without exposing either.
2. **Ask Orange Labs to re-fire** the `OBLR348764` test.
3. **Read the new logs** to determine one of:
   - Which header name they use → keep just that one, drop the others.
   - Value mismatch → rotate `ORANGE_WEBHOOK_SECRET` to whatever value they hold (or ask them to update to ours).
4. **Tighten back down**: once confirmed, remove the extra accepted headers and the diagnostic logging so only the exact contract Orange uses remains.

## Not in scope

- No DB persistence yet.
- No change to `supabase/config.toml` (already correct).
- No change to the 200-OK success path.

## Technical notes

- All diagnostic logs will be safe: header **names** only, plus **length** and **hashed prefix** of secrets. Raw secret values are never logged.
- Hash comparison uses `crypto.subtle.digest('SHA-256', …)` on both the received header and `Deno.env.get('ORANGE_WEBHOOK_SECRET')`, then compares the first 8 hex chars in the log.
- Step 4 (tighten-down) is a follow-up edit after we see one successful 200 from Orange.