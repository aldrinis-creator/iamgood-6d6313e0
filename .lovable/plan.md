## Problem

Orange Labs fired a test order (`OBLR348764`) but the `orange-webhook` edge function shows:
- No boot logs
- No request logs
- No gateway entry for `/orange-webhook` or the order ID

Root cause: `orange-webhook` is not declared in `supabase/config.toml`, so it inherits the default `verify_jwt = true`. Third-party callbacks from Orange Labs authenticate via the `api_key` / `Authorization: Bearer <ORANGE_WEBHOOK_SECRET>` header (a shared secret), not a Supabase JWT — the platform gateway rejects them with 401 before our function code runs. That's why there's no 200 and no log entry.

The function itself already validates the shared secret correctly (checks both `Authorization: Bearer` and `api_key` headers against `ORANGE_WEBHOOK_SECRET`, returns 401 on mismatch, 200 on success).

## Change

Add a per-function block to `supabase/config.toml`:

```toml
[functions.orange-webhook]
  verify_jwt = false
```

This lets Orange Labs' webhook reach our handler; the in-function secret check remains the authentication boundary.

## Verify

1. Ask Orange Labs to re-fire the `OBLR348764` test (or any test order).
2. Confirm in edge function logs that `orange-webhook` booted and returned `{"success": true, "message": "Webhook received"}` with status 200.
3. Confirm a bad/missing secret still returns 401 (unchanged behavior).

## Not in scope

No DB tables, no order persistence — matches your earlier direction to hold on the `diagnostic_orders` schema until finalized.
