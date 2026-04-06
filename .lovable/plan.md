
Goal: make OTP delivery reliable instead of only “API accepted”, and remove blind spots so we can diagnose failures permanently.

What I found
- The current backend only logs MSG91 send acceptance (`type: "success"` with a request_id). That does not prove the SMS was actually delivered.
- The app has no delivery-status tracking, so when SMS is not received we cannot tell whether it was carrier failure, DLT scrub, throttling, or resend/session behavior.
- The current resend path uses a fresh `/otp` send instead of MSG91’s documented retry endpoint, which can hurt consistency.
- The current rate limit is in-memory inside the function, so it resets across cold starts and is not dependable.
- The current UI shows generic errors and does not surface delivery-specific states.
- Separately, `OrDivider` is causing the React ref warning because `Separator` likely uses `asChild`/ref expectations; this is not the SMS issue but should be cleaned up while touching auth screens.

Implementation plan

1. Harden the OTP backend function
- Update `supabase/functions/send-otp/index.ts`.
- Validate inputs strictly (`action`, `phone`, `otp`, `purpose`).
- Normalize phone formatting in one place.
- Keep `send` on MSG91 SendOTP.
- Change `resend` to use MSG91’s documented retry endpoint (`/otp/retry`) with `retrytype=text`, with fallback messaging if MSG91 rejects retry.
- Add a client-generated correlation id (`crqid`) when sending OTP if MSG91 supports it for webhook correlation.
- Improve logging so each request records: normalized phone, action, request id, verification outcome, and provider error text.
- Keep current login bridge behavior after successful verify (magic-link session generation), and keep registration verify as verification-only.

2. Replace fragile rate limiting with database-backed tracking
- Add a new backend table for OTP attempts/logs, e.g. `otp_events` or `otp_requests`.
- Store: phone hash or normalized phone, action, request id, status, failure_reason, created_at, delivery_time, verified flag.
- Add RLS so users cannot browse this table directly; it exists for backend-only tracking.
- Use backend queries in `send-otp` to enforce “max 3 sends/resends per phone per 10 minutes” durably.
- This fixes the current in-memory limiter that can silently reset.

3. Add MSG91 delivery-report webhook ingestion
- Create a backend function to receive MSG91 OTP delivery reports.
- Persist webhook payload fields such as `requestId`, `status`, `failureReason`, `deliveryTime`, `telNum`, `DLT_TE_ID`, `verified`.
- Match webhook events back to the original send using `requestId` (and `CRQID` if available).
- This gives us real proof of Delivered vs Failed instead of assuming success from the initial API response.

4. Improve client-side OTP UX
- Update `src/components/OtpVerification.tsx`.
- Show clearer states:
  - “Sending code…”
  - “Code sent”
  - “Couldn’t deliver SMS. Try resend in 30s”
  - “Too many attempts. Wait 10 minutes”
- Surface backend/provider error text when safe.
- Keep resend disabled until timer ends, but if backend returns a known delivery failure, explain next steps instead of generic “Failed”.
- Pass through correlation/request metadata only if needed for observability, not for security-sensitive auth.

5. Small auth-screen cleanup
- Update `src/pages/Login.tsx` and `src/pages/Register.tsx` divider usage to remove the ref warning around `OrDivider`/`Separator`.
- Keep this isolated from OTP logic, but it will clean noisy console output during testing.

6. Verification checklist after implementation
- Test registration OTP send, verify, resend, and completion.
- Test login OTP send, verify, session creation, and wrong-code handling.
- Trigger 4 send attempts inside 10 minutes and confirm the 4th is blocked consistently across refreshes.
- Confirm delivery webhook writes final status updates.
- Confirm we can distinguish these cases in logs/data:
  - API accepted but carrier failed
  - DLT/template issue
  - invalid phone
  - rate-limited
  - verified successfully

Technical details
```text
Current flow:
UI -> send-otp -> MSG91 SendOTP -> returns request_id -> UI says "OTP sent"

Planned flow:
UI -> send-otp -> DB log created -> MSG91 SendOTP/Retry
                        |                |
                        |                -> request_id saved
                        v
                 durable rate limit
                        
MSG91 delivery webhook -> otp delivery function -> DB status update
                                         |
                                         -> delivered / failed / reason

Verify:
UI -> send-otp verify -> MSG91 verify -> if login, create auth session
```

Files likely to change
- `supabase/functions/send-otp/index.ts`
- new backend function for OTP delivery webhook
- `src/components/OtpVerification.tsx`
- `src/pages/Login.tsx`
- `src/pages/Register.tsx`
- new SQL migration for OTP event tracking table/policies

Expected outcome
- You will no longer be stuck with “MSG91 said success but no SMS”.
- OTP sending will use proper resend semantics.
- Rate limiting will be durable.
- Delivery failures will become traceable with real reasons.
- The UI will guide users properly when SMS is delayed or blocked.
