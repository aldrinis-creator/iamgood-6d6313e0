# firebase-auth: what the logs actually say, and the fix

## What I checked just now

Live logs for `firebase-auth`:

```text
13:04:52Z LOG   booted (time: 40ms)
13:04:52Z INFO  Listening on http://localhost:9999/
13:04:52Z ERROR Firebase token verification failed:
                TypeError: Cannot read properties of undefined (reading 'kid')
                  at verifyFirebaseToken (.../firebase-auth/index.ts:27:17)
                  at async Server.<anonymous> (.../firebase-auth/index.ts:65:26)
                  at async Server.#respond (https://deno.land/std@0.168.0/http/server.ts:221:18)
13:05:58Z LOG   shutdown
```

Direct calls to the deployed endpoint:

- empty body -> **HTTP 400**, body `{"error":"Missing or invalid idToken"}`
- garbage token -> **HTTP 401**, body `{"error":"Invalid token or missing phone number"}`

## Diagnosis

It is **not** a deploy failure and **not** a boot crash — the function boots in ~40ms and answers every request. Your Deno imports are fine.

The problem is that **the code running in the cloud is not the code in the repo**. Three independent signals:

1. The repo version returns `status: 200` with `{ success:false, error }` on every failure path. The live version returns raw **400 / 401** with `{ error }` — a different response shape.
2. The stack trace shows `verifyFirebaseToken` at **line 27** and the request handler at **line 65**; in the repo file those are line 31 and line 69.
3. The trace shows the request served by `deno.land/std@0.168.0/http/server.ts`, i.e. an old `serve()` entrypoint. The repo file uses `Deno.serve`.

So an older revision is live. And because that older revision replies with 400/401, the client's `supabase.functions.invoke("firebase-auth")` throws `FunctionsHttpError: Edge Function returned a non-2xx status code` — exactly the message you see — before your code can read the `error` field. The GitHub sync did not reach the deployed function.

The `reading 'kid'` TypeError is the old revision's key-lookup path, not a runtime bug in the current source.

## Plan

1. Redeploy `firebase-auth` from the current repo source so the hardened `Deno.serve` version is what actually runs.
2. Re-run the two probes and confirm the shape changes to **HTTP 200** with `{"success":false,"error":"..."}` for both the empty body and the garbage-token case, and that the stack line numbers in any new log entry match the repo file.
3. Make the client resilient regardless of status: in `src/components/OtpVerification.tsx`, when `invoke` returns a `FunctionsHttpError`, read the JSON body from `error.context` and surface the real server message instead of the generic "non-2xx" string. This way a future stale deploy shows a diagnosable message rather than a dead end.
4. Check logs once more after a real device login attempt to confirm the token verifies and a `token_hash` is issued.

## Technical notes

- No change to the function's logic or imports is needed; the source is already correct.
- Step 3 is the only source-code edit, and it is confined to error handling in the OTP component. The success path and response contract (`{ success, token_hash, email }`) stay identical.
