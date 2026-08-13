# Force redeploy firebase-auth Edge Function from latest main

## Current state

- `supabase/functions/firebase-auth/index.ts` already contains the corrected `header.kid` reference at line 32 and uses the modern `Deno.serve` entrypoint.
- The live function previously showed a stale revision (`deno.land/std@0.168.0/http/server.ts`) returning raw 400/401 responses, which caused `supabase.functions.invoke` to throw `FunctionsHttpError`.

## Plan

1. Sync the repo to the latest commit on `main` so the working tree matches the pushed fix.
2. Force redeploy the `firebase-auth` Edge Function from the current source.
3. Verify the deployment:
   - Call the endpoint with an empty body and expect **200** `{"success":false,"error":"Missing or invalid idToken"}`.
   - Call with a garbage token and expect **200** `{"success":false,"error":"JWT Verification Failed: ..."}`.
   - Check the function logs to confirm the boot trace uses the `Deno.serve` runtime and line numbers match the repo file.
4. Report back when the deploy is 100% finished and it is safe to test end-to-end phone login.

## Notes

- No client or function logic changes are needed; this is a forced redeploy to replace the stale cloud revision with the current repo source.
- After confirmation, the real-device test path is: enter phone → Firebase reCAPTCHA → SMS → OTP → session created.
