# Deploy and harden the firebase-auth login function

## Situation

The `firebase-auth` function is already present in the project at `supabase/functions/firebase-auth/index.ts`, and the login screen already calls it (`src/components/OtpVerification.tsx` sends the Firebase ID token, `src/pages/Login.tsx` exchanges the returned `token_hash` for a session). Edge functions in this project deploy automatically — there is no separate manual deploy step or GitHub sync action needed. What is worth doing is confirming it is live and fixing two real problems in the current code before you rely on it for SMS login.

## Issues found in the current function

1. **User lookup does not scale.** It calls `auth.admin.listUsers()` with no paging, which only returns the first page of accounts. Any existing user beyond that page is treated as new, and the create call then fails with "user already exists" — so returning users can be locked out.
2. **No input validation and unpinned project id.** `projectId` is taken from the request body, so a caller could pass another Firebase project's id and have its tokens accepted. It should be fixed server-side to `check-in-6b822`.

## Changes

- Replace the `listUsers()` scan with a direct lookup by the derived email (`<digits>@phone.checkin.app`), falling back to create-on-conflict handling so a race can't produce a duplicate.
- Ignore the client-supplied `projectId`; verify tokens against the app's own Firebase project id only. Validate that `idToken` is a non-empty string and return 400 otherwise.
- Cache the Google public signing keys for the life of the isolate instead of fetching them on every request.
- Keep the existing response shape (`{ success, token_hash, email }`) so no frontend change is needed.
- Add a `[functions.firebase-auth]` block with `verify_jwt = false` to `supabase/config.toml`, matching the other public auth functions.

## Verification

- Deploy the function and call it once with an invalid token to confirm a clean 401 with CORS headers.
- Run an end-to-end phone login in the preview: request the SMS code, verify it, and confirm a session is created and the dashboard loads.
- Check the function logs for errors after the run.
