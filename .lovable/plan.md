

## Plan — Fix the "function never reached" issue

### Diagnosis

Your screenshot proves the MSG91 template `e1e205a8_3b76_4c20_bde4_9f124a35c8c4` works perfectly when called directly. But in our app:

- **Zero edge function logs** exist for `send-pharmacy-order` — across all attempts.
- **Zero edge HTTP request logs** exist either.
- This means the request is being **rejected by Supabase before it reaches the function code**, or the function was never successfully deployed.

The smoking gun: in `supabase/config.toml` the function is set to **`verify_jwt = true`**, while every other MSG91 function (`msg91-send`, `send-otp`, `send-sos-alert`, `notify-guardian-medication`) is set to `verify_jwt = false`. With JWT verification on, any request from an unauthenticated context (or a stale token, or a token sent with the wrong header) is rejected with `401` at the Supabase edge gateway — **before** the function executes, so nothing is logged. That matches the symptom exactly.

### What I'll change

**1. `supabase/config.toml`** — flip `send-pharmacy-order` to `verify_jwt = false`, matching every other outbound MSG91 function.

**2. Force a redeploy of `send-pharmacy-order`** so logs start flowing and we can confirm MSG91 is actually being called.

**3. Add one safety log line** at the very top of the function (before any other code) so we can prove invocation even if a later parse step fails.

**4. Test the function directly** via curl after deploy to verify MSG91 returns success with the same payload our app sends, confirming nothing else is wrong.

**5. Re-test from the app** — the MSG91 success branch should now fire instead of always falling through to the `wa.me` fallback. Toast will show **"Order sent to pharmacy via MSG91 WhatsApp ✓"**, and the popup will close automatically (no second WhatsApp tab).

### Files modified

- `supabase/config.toml` — single line change
- `supabase/functions/send-pharmacy-order/index.ts` — add one early log line

### Why this isn't a template / payload issue

Your screenshot confirms the template renders correctly with the exact variable names we're sending (`patient_name`, `doctor_name`, `hospital_name`, `order_date`, `items_list`). No template change is needed.

### Why this isn't a phone-format issue

MSG91 accepts the `91XXXXXXXXXX` format we already normalize to. The screenshot proves it.

### What to expect after the fix

- Edge function logs will start appearing for every send.
- App will route through MSG91 (no manual WhatsApp tap needed by the User/Guardian).
- The `wa.me` fallback stays as a safety net in case MSG91 ever rejects a future payload.

