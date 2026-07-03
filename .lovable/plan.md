# Fix: OTP login fails for Aldrin (and any user with formatted phone)

## Root cause

Edge function logs show:
```
[send-otp] get_email_by_phone(+919819576467): null undefined
```

Aldrin's OTP was sent and verified successfully, but the phone→email lookup returned `null`, so `send-otp` responded with `no_account: true` and the client never received a session.

Why: `profiles.phone` for Aldrin is stored as `"+91 9819576467"` (with a space), but the edge function normalizes the entered phone to `+919819576467` (no space) before calling `get_email_by_phone`. The RPC does an exact string match, so it misses the row.

A DB check confirms 1 of 4 profiles has whitespace/formatting in `phone` — this will hit any similarly formatted account.

## Fix (two-part, both needed)

### 1. Make `get_email_by_phone` format-tolerant (DB migration)

Update the RPC to compare normalized digits on both sides, so it matches whether the stored value is `+91 9819576467`, `+919819576467`, or `9819576467`.

```sql
CREATE OR REPLACE FUNCTION public.get_email_by_phone(_phone text)
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT au.email
  FROM auth.users au
  JOIN public.profiles p ON p.id = au.id
  WHERE regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g')
      = regexp_replace(COALESCE(_phone, ''), '\D', '', 'g')
    AND regexp_replace(COALESCE(p.phone, ''), '\D', '', 'g') <> ''
  LIMIT 1;
$$;
```

Apply the same normalization to `check_guardian_nomination`, `guardian_ward_count_by_phone`, and the phone-based branch of `link_guardian_user_id` so guardian lookups don't hit the same bug.

### 2. Backfill stored phones to canonical form

One-off update to strip whitespace/formatting so future exact-match code paths (realtime filters, direct `eq('phone', …)` queries) also work:

```sql
UPDATE public.profiles
SET phone = regexp_replace(phone, '[\s\-\(\)]', '', 'g')
WHERE phone ~ '[\s\-\(\)]';

UPDATE public.guardians
SET guardian_phone = regexp_replace(guardian_phone, '[\s\-\(\)]', '', 'g')
WHERE guardian_phone ~ '[\s\-\(\)]';
```

## Verification

After deploy, Aldrin re-attempts OTP login: verify edge function log shows `get_email_by_phone(+919819576467): aldrin@futurewave.in` and the client receives `token_hash` + `email`, completing sign-in.

No frontend changes required.
