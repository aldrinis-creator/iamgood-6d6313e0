
## Plan — Fix SOS delivery so WhatsApp targets the right guardian and add real SMS support

### What the codebase shows now
- The SOS backend **is being triggered**. Existing logs show the backend calling MSG91 WhatsApp and receiving accepted responses with `request_id`s.
- The current SOS backend does **not send SMS at all**. It only does:
  1. email queue
  2. in-app notifications
  3. push notifications
  4. WhatsApp via MSG91
- The current SOS backend also has a delivery risk: it re-queries `guardians` by `user_id` **without filtering to `status = "accepted"`** and ignores the caller’s `guardian_phones`. That can send WhatsApp to stale or pending guardian numbers.

### What to build

#### 1. Make SOS recipient selection reliable
Update `supabase/functions/send-sos-alert/index.ts` so SOS uses a single clean recipient set:
- normalize + dedupe phone numbers
- prefer accepted guardians only
- if caller passes `guardian_phones`, use them as the primary list or validate against accepted guardians
- use the same resolved recipient set for:
  - WhatsApp
  - push lookup
  - notification text/logging

This removes the current mismatch where the client and backend may target different guardian rows.

#### 2. Add actual SMS sending for SOS
Extend `send-sos-alert` with a true SMS channel using MSG91 Flow API:
- use a dedicated SOS SMS template secret, e.g. `MSG91_SOS_SMS_TEMPLATE_ID`
- send SMS to the same normalized guardian recipient list
- include compact variables such as:
  - user name
  - IST timestamp
  - location link or “Location unavailable”
  - short health summary
- return whether SMS was queued successfully, separate from WhatsApp

Important: this is new functionality. Right now SMS is not implemented anywhere in the SOS function.

#### 3. Improve backend result reporting
Have `send-sos-alert` return a structured channel result instead of only `msg91Sent`, for example:
```text
{
  emailQueued: 1,
  pushSent: 0,
  whatsappQueued: 1,
  smsQueued: 1,
  whatsappRequestId: "...",
  smsRequestId: "...",
  recipientCount: 1,
  errors: { whatsapp: null, sms: null }
}
```
Also add clearer logs for:
- final normalized phone list
- accepted guardian count
- WhatsApp request/result
- SMS request/result

This makes future debugging much faster.

#### 4. Update the client to react to channel failures properly
Update these callers:
- `src/components/SOSDialog.tsx`
- `src/contexts/AppContext.tsx`
- `src/components/FallDetectionOverlay.tsx`

So they:
- read the new structured response
- only use `wa.me` fallback if backend WhatsApp failed
- show a clear error toast when neither WhatsApp nor SMS was queued
- stop implying that SMS exists when it does not

#### 5. Keep current non-SMS channels intact
Do not change the existing:
- push flow
- in-app notification insertion
- email queueing

Those can stay as parallel channels while SOS SMS is added.

### Files to modify
- `supabase/functions/send-sos-alert/index.ts`
- `src/components/SOSDialog.tsx`
- `src/contexts/AppContext.tsx`
- `src/components/FallDetectionOverlay.tsx`

### Required setup before implementation
To send SOS SMS, the project needs a dedicated MSG91 SOS SMS template and its template ID stored as a runtime secret:
- `MSG91_SOS_SMS_TEMPLATE_ID`

### Expected outcome
After this change:
- WhatsApp will target the correct accepted guardian numbers consistently
- SOS will also send a real SMS, not just WhatsApp/push/email
- the app will clearly indicate whether WhatsApp and SMS were actually queued
- backend logs will show exactly which channel succeeded or failed

### Technical notes
- No database schema change is required for this fix
- The current logs already prove the backend is reaching MSG91 for WhatsApp; the main app-side fix is recipient correctness and adding the missing SMS channel
- Email is currently failing for a separate sender-domain reason, but that is independent of the WhatsApp/SMS issue
