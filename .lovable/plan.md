

## Fix: Phone Number Not Saved During Registration

### Root Cause

The users **are** being created in the database — two registrations from today exist (`58c32f86...` and `cc7f5b85...`) with name "Al" — but their **phone numbers are null**.

Here's why: After `signUp()`, the code tries to update the profile:

```typescript
await supabase.from("profiles").update({
  phone: phone.replace(/\s/g, ""),
  date_of_birth: dob || null,
}).eq("id", userId);
```

But since **email confirmation is enabled**, the user has no active session after signup. Without a session, `auth.uid()` is null, so the RLS policy (`auth.uid() = id`) silently blocks the update. The phone and DOB are never saved.

The Cloud UI search for "+919819576467" finds nothing because it searches `auth.users` which doesn't store phone — and the `profiles` table has `phone = null` for these users.

### Fix

Pass `phone` and `date_of_birth` in the signup metadata, and update the `handle_new_user` database trigger to save them when creating the profile. This way phone is stored at creation time (inside the trigger, which runs as SECURITY DEFINER), bypassing the RLS issue entirely.

### Changes

**1. Database migration — Update `handle_new_user()` trigger function**

Add phone and date_of_birth extraction from metadata:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _role public.app_role;
BEGIN
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'app_role')::public.app_role,
    'user'::public.app_role
  );
  
  INSERT INTO public.profiles (id, full_name, role, phone, date_of_birth)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    _role,
    NULLIF(NEW.raw_user_meta_data->>'phone', ''),
    NULLIF(NEW.raw_user_meta_data->>'date_of_birth', '')::date
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role);
  
  RETURN NEW;
END;
$$;
```

**2. `src/pages/Register.tsx` — Pass phone and DOB in signup metadata**

Update the `signUp` call to include phone and DOB:

```typescript
const { data, error } = await signUp(email, password, { 
  full_name: fullName,
  app_role: selectedRole || "user",
  phone: phone.replace(/\s/g, ""),
  date_of_birth: dob || "",
});
```

Remove the separate `profiles.update()` call for phone/DOB since the trigger now handles it.

**3. Fix existing records — backfill today's registrations**

Run a one-time migration to update the two profiles created today that have null phones (if the user provides the correct phone for each).

### Impact

- New registrations will have phone and DOB saved immediately via the trigger
- No dependency on having an active session after signup
- Cloud UI search by email will find users (phone search searches `auth.users`, not profiles — this is a platform limitation)
- Guardian insertion also happens post-signup without a session, which may also be failing silently — same RLS issue. The guardian insert uses `auth.uid() = user_id` check. This should also be moved to the trigger or handled via a service-role call.

