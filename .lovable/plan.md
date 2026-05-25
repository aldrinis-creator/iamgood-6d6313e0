# Build `join-waitlist` public endpoint

A hardened public edge function that futurewave.in (or any external site) can POST to, so Pre-register submissions can no longer silently break.

## Endpoint

```
POST https://magnrdegcegxdtgapyez.supabase.co/functions/v1/join-waitlist
Content-Type: application/json

{
  "email": "user@example.com",
  "full_name": "Optional Name",
  "phone": "+91...",
  "source": "web-landing-page"   // optional, defaults to web-landing-page
}
```

No anon key, no Authorization header required from the client.

## Responses

- `200 { ok: true, alreadyJoined: false }` — new signup
- `200 { ok: true, alreadyJoined: true }` — email already on list (idempotent)
- `400 { error: "..." }` — invalid payload (Zod field errors)
- `429 { error: "Too many requests" }` — rate-limit hit
- `500 { error: "..." }` — server error

## Function behavior

1. CORS: `Access-Control-Allow-Origin: *`, handle OPTIONS preflight.
2. Validate body with Zod:
   - `email`: required, valid email, ≤255 chars
   - `full_name`: optional, ≤120 chars
   - `phone`: optional, ≤20 chars
   - `source`: optional, ≤60 chars, default `web-landing-page`
3. Light in-memory rate limit (5 requests / IP / minute) using `x-forwarded-for`.
4. Insert into `premium_plus_waitlist` using **service role key** (bypasses RLS). On unique-email conflict → return `alreadyJoined: true`.
5. Fire-and-forget call to `send-transactional-email` with template `premium-plus-waitlist-confirmation` and `idempotencyKey = pp-waitlist-<email>` so the user gets the existing branded confirmation email.
6. Log failures with `console.error` (visible in edge function logs).

## Config

- `supabase/config.toml`: add block for `join-waitlist` with `verify_jwt = false` (public endpoint).
- Uses existing secrets `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — nothing new needed.

## No other changes

- `premium_plus_waitlist` table, RLS, and the admin Pre-register tab stay exactly as they are.
- Existing in-app `/subscription` signup path is untouched.
- Existing `admin-waitlist` function is untouched.

## What you need to do on futurewave.in

After deploy, change the Pre-register form's submit handler to a single fetch:

```js
await fetch("https://magnrdegcegxdtgapyez.supabase.co/functions/v1/join-waitlist", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, full_name, phone })
});
```

No Supabase SDK, no anon key, no table name in client code — so the form can't silently break again if keys rotate or schema changes.
