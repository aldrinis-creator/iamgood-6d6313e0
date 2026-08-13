# Go-live check for Firebase phone login

## What I found in the synced code

- `supabase/functions/firebase-auth/index.ts` matches the hardened version: pinned Firebase project `check-in-6b822`, cached Google public keys with rotation retry, deterministic `<phone>@phone.checkin.app` lookup with create-if-absent, and a magiclink `token_hash` returned to the client.
- Client wiring is in place: `src/integrations/firebase/client.ts` (project `check-in-6b822`) and `src/components/OtpVerification.tsx` (Firebase reCAPTCHA + `signInWithPhoneNumber`, then `supabase.functions.invoke("firebase-auth")`).
- One blocker: `supabase/config.toml` contains the `[functions.firebase-auth]` block **twice** (lines 66-69). A duplicate TOML table is invalid and can fail config parsing during deploy.

## Plan

1. Remove the duplicate `[functions.firebase-auth] verify_jwt = false` block from `supabase/config.toml`, keeping a single entry.
2. Deploy `firebase-auth` and confirm it is live.
3. Smoke-test the deployed endpoint directly:
   - no body -> `400 Missing or invalid idToken`
   - garbage token -> `401 Invalid token or missing phone number`
   Both confirm the function boots, verifies signatures, and never issues a session without a valid Firebase token.
4. Check the function logs for boot errors after the calls.
5. Report the exact end-to-end test steps for you to run on a real device (enter phone -> Firebase SMS -> OTP -> session created), since a real Firebase SMS OTP cannot be produced from here.

## Notes

- A full end-to-end pass also needs the app's domain authorised in the Firebase console for phone auth (reCAPTCHA) — worth confirming for both the preview and published domains before testing.
- No database or client code changes are required for this step.
