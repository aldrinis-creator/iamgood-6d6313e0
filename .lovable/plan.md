

## Restrict Guardian Registration to Nominated-Only + Fix 3-Ward Limit

### Problem Summary
1. Anyone can register as a guardian without a nomination — this should be blocked
2. The 3-ward limit only checks by email, not phone — phone-only guardians bypass it
3. Nomination acceptance is "auto-accept after 24h" — confirming this is the intended rule

### Changes

**1. Block un-nominated guardian registration (`src/pages/Register.tsx`)**
- After OTP verification for guardian role, before calling `handleSubmit()`, query the `guardians` table to check if any record exists matching the registering phone number
- If no nomination exists: show an error screen — "You haven't been nominated as a guardian yet. Ask your ward to add you from their Settings page."
- If nomination(s) exist: proceed with registration and auto-link
- Remove the "I'm a Guardian" role selection button from step 1 entirely — instead, guardians arrive via the invite link (`/register?nomination=accept&token=...`) which auto-selects the guardian role

**2. Fix 3-ward limit to check by phone (`guardian_ward_count` DB function)**
- Create a new RPC function `guardian_ward_count_by_phone(_phone text)` that counts accepted guardian records by phone
- Update `Register.tsx` and `Settings.tsx` to also check by phone when no email is provided
- Alternatively, modify existing `guardian_ward_count` to accept both email and phone parameters

**3. Registration flow for guardians (revised)**
- Guardian registration is ONLY accessible via nomination invite link
- When a guardian clicks the invite link (`/register?nomination=accept&token=...`), pre-fill their name from the nomination record and skip role selection
- After phone verification + signup, call `link_guardian_user_id()` to connect all matching nominations
- Show success screen with ward name(s)

**4. Nomination acceptance rule (no change needed)**
- Current rule stays: default `pending`, auto-accept after 24h window, guardian can reject within 24h
- This is documented and working correctly

### Technical Details

**Migration: New DB function**
```sql
CREATE OR REPLACE FUNCTION public.guardian_ward_count_by_phone(_phone text)
RETURNS integer
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT COUNT(*)::integer
  FROM public.guardians
  WHERE guardian_phone = _phone
    AND status = 'accepted';
$$;
```

**Migration: Public lookup function for nomination validation**
```sql
CREATE OR REPLACE FUNCTION public.check_guardian_nomination(_phone text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.guardians
    WHERE guardian_phone = _phone
  );
$$;
```

**Register.tsx changes**
- Parse `nomination` and `token` URL params on mount
- If `nomination=accept` + `token`: auto-select guardian role, fetch nomination details via edge function, pre-fill name
- If user manually selects "I'm a Guardian" without a token: after phone entry, call `check_guardian_nomination(phone)` — block if false
- Before signup, call both `guardian_ward_count` (email) and `guardian_ward_count_by_phone` (phone) to enforce 3-ward cap

**Settings.tsx / GuardianTab.tsx changes**
- When a user adds a new guardian, also check `guardian_ward_count_by_phone` for phone-only guardians

### Files to modify
- `src/pages/Register.tsx` — nomination gate + invite link handling
- `src/components/GuardianTab.tsx` — 3-ward check by phone
- `src/pages/Settings.tsx` — same 3-ward check
- New migration — `guardian_ward_count_by_phone` + `check_guardian_nomination` functions

