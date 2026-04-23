
## Plan — Fix SOS so backend delivery actually fires and expose why WhatsApp/SMS are failing

### What the current code and data show
- SOS button presses are reaching the database: recent `sos_events` rows are being created successfully.
- The delivery backend is not showing recent `send-sos-alert` execution logs for those SOS tests.
- Client code has two weak points:
  1. `triggerSOS()` inserts the SOS row, then calls `invokeSosAlertOnce(data.id)` without awaiting the result or checking for invoke errors.
  2. `SOSDialog` and `FallDetectionOverlay` call `supabase.functions.invoke("send-sos-alert")` but only read `data`; they do not inspect `error`, so backend failures can be swallowed.
- Recipient selection is inconsistent:
  - client fetches all guardians
  - backend only sends to `status = "accepted"`
  This can produce a real SOS event with `recipientCount = 0`, which looks like “messaging did not fire”.

### What to build

#### 1. Make SOS delivery invocation reliable
Update `src/contexts/AppContext.tsx` so `triggerSOS()`:
- awaits the backend invoke
- captures both `{ data, error }`
- logs and toasts real invoke failures
- returns the created `sosId` plus delivery result to callers

Also keep deduplication, but move it to a deterministic keyed flow so the same SOS event is not inserted or delivered twice.

#### 2. Stop silent client-side failures
Update:
- `src/components/SOSDialog.tsx`
- `src/components/FallDetectionOverlay.tsx`

So they:
- read both `data` and `error` from `supabase.functions.invoke`
- surface backend failures clearly
- show exact channel status from `errors.whatsapp` / `errors.sms`
- only open manual `wa.me` fallback when backend delivery truly failed

#### 3. Align recipients with accepted guardians only
Update the client guardian queries to use only accepted guardians for SOS delivery input:
- filter guardians with `status = "accepted"`
- show a clear message if there are zero accepted guardians
- keep the backend as final source of truth, but stop passing stale/pending numbers from the UI

This removes the current mismatch between what the UI thinks is a recipient and what the backend actually sends to.

#### 4. Add delivery diagnostics inside the backend
Update `supabase/functions/send-sos-alert/index.ts` to improve observability:
- log when the function starts, with `user_id` and resolved recipient count
- log the final normalized recipient list count
- log whether WhatsApp request was attempted
- log whether SMS request was attempted
- return a structured failure reason when recipient count is zero

Example response shape:
```text
{
  recipientCount: 0,
  whatsappQueued: 0,
  smsQueued: 0,
  errors: {
    invoke: null,
    recipients: "No accepted guardians with valid phone numbers",
    whatsapp: null,
    sms: null
  }
}
```

#### 5. Verify the deployed path end-to-end
After implementation:
- trigger SOS from the app
- confirm `send-sos-alert` appears in backend logs
- confirm the response shows either queued channels or an explicit reason
- if the function executes but MSG91 still rejects delivery, use the logged request/response bodies to correct template payload details

### Files to modify
- `src/contexts/AppContext.tsx`
- `src/components/SOSDialog.tsx`
- `src/components/FallDetectionOverlay.tsx`
- `supabase/functions/send-sos-alert/index.ts`

### Expected outcome
After this change:
- every SOS press that creates an event will also produce a traceable backend delivery attempt
- the app will no longer fail silently when function invocation breaks
- only accepted guardians will be treated as valid SOS recipients
- if WhatsApp or SMS still fail, the app and backend logs will show exactly whether the issue is:
  - no accepted guardians
  - invoke failure
  - MSG91 rejection
  - missing/invalid payload values

### Technical details
- No database schema change is required.
- The most important fix is to stop fire-and-forget invocation in `triggerSOS()` and stop ignoring the `error` field from `supabase.functions.invoke(...)`.
- Current evidence suggests the SOS UI path can create `sos_events` successfully while still not producing a confirmed backend delivery attempt.
