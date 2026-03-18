

## Add Google OAuth Sign-in to Check-iN

### What changes

1. **Configure Social Auth** — Use the Configure Social Login tool to generate the `src/integrations/lovable/` module and install `@lovable.dev/cloud-auth-js`

2. **Update Login page** — Add a "Sign in with Google" button below the email/password form:
   ```tsx
   import { lovable } from "@/integrations/lovable/index";
   
   const handleGoogleSignIn = async () => {
     const { error } = await lovable.auth.signInWithOAuth("google", {
       redirect_uri: window.location.origin,
     });
   };
   ```

3. **Update Register page** — Add the same Google button as an alternative to the full registration form. After Google sign-in, the user's profile is auto-created by the existing `handle_new_user` trigger (name pulled from Google metadata). They can fill in phone/guardians later from Settings.

4. **Visual layout** — Add an "OR" divider between the email form and the Google button, matching the existing design system (navy primary, mobile-first max-w-md).

### No database changes needed
The existing `handle_new_user` trigger already creates a profile row with `full_name` from `raw_user_meta_data`, so Google users get a profile automatically.

### Files modified
- `src/pages/Login.tsx` — add Google button to both Login and Register components

### Files generated (by tool)
- `src/integrations/lovable/` — auto-generated auth module

