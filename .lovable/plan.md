
## Plan — Fix SOS so guardian UI still updates, but WhatsApp/SMS also fire reliably

### What the evidence shows
- The guardian app receiving the SOS banner and emergency card confirms the `sos_events` record is being created and guardian-side SOS display is working.
- The messaging path is the failing part.
- The current code still has **multiple SOS delivery entry points**:
  - `AppContext.triggerSOS()` inserts the SOS event and invokes `send-sos-alert`
  - `SOSDialog.sendAlerts()` then invokes `send-sos-alert` again
  - `FallDetectionOverlay` also invokes `send-sos-alert` separately
- The current backend log snapshot for `send-sos-alert` shows only shutdown events, unlike healthy functions that show boot/listen logs. That points to an unhealthy or unverified function path, not just a guardian UI issue.

### What to build

#### 1. Centralize SOS delivery into one reliable path
Refactor SOS so only `AppContext.triggerSOS()` is responsible for:
- inserting the `sos_events` row
- resolving accepted guardians
- invoking `send-sos-alert`
- returning a structured result to callers

Update `SOSDialog` and `FallDetectionOverlay` to:
- call `triggerSOS()` only
- stop invoking `send-sos-alert` directly
- use the returned delivery result for toasts and fallback behavior

This removes duplicate or racing sends and makes one place responsible for delivery.

#### 2. Make the client expose the real failure reason
Strengthen `src/contexts/AppContext.tsx` so `triggerSOS()`:
- returns `{ sosId, deliveryResult, error }`
- distinguishes:
  - event created but function invoke failed
  - no accepted guardians
  - provider rejected WhatsApp
  - provider rejected SMS
- shows exact channel errors in the UI instead of a generic “sent” state

Update `SOSDialog.tsx` and `FallDetectionOverlay.tsx` to:
- show success only when `whatsappQueued > 0` or `smsQueued > 0`
- open manual `wa.me` fallback only when backend delivery really failed
- stop making the UI appear complete when only the guardian realtime/dashboard updated

#### 3. Harden the `send-sos-alert` edge function boot path
Refactor `supabase/functions/send-sos-alert/index.ts` to match the project’s healthier function patterns:
- switch the Supabase import to a stable `npm:@supabase/supabase-js@2` import
- use the SDK CORS helper or the full expected header set consistently on all responses
- add request validation up front
- log at function start before any external/network work
- log the resolved accepted guardians, final normalized phones, and exact WA/SMS payload attempts

Because current logs do not show normal boot/request output for this function, this step is aimed at making the function deploy and execute observably.

#### 4. Keep recipient resolution strict and consistent
Use one shared recipient-resolution rule in the backend:
- accepted guardians only
- normalized phone numbers only
- deduplicated final list
- explicit structured error when the final recipient list is empty

The client should no longer assemble its own delivery list independently from the backend.

#### 5. Verify the backend in isolation before trusting the app flow
After implementation, verify in this order:
1. invoke `send-sos-alert` directly with a known affected user and accepted guardian phone
2. confirm the function now shows normal boot/request logs
3. confirm logs include:
   - function start
   - recipient resolution
   - WhatsApp request/response
   - SMS request/response
4. trigger SOS from the app and confirm the same function logs appear for the real user flow

This isolates whether the failure is:
- client never calling the function
- function not booting correctly
- MSG91 rejecting WhatsApp
- MSG91 rejecting SMS
- no valid accepted recipient numbers

### Files to modify
- `src/contexts/AppContext.tsx`
- `src/components/SOSDialog.tsx`
- `src/components/FallDetectionOverlay.tsx`
- `supabase/functions/send-sos-alert/index.ts`

### Expected outcome
After this change:
- guardian SOS UI will still update as it does now
- WhatsApp and SMS delivery will run from a single reliable backend path
- the app will clearly state whether delivery failed at invoke-time, recipient-resolution time, or provider-response time
- backend logs will finally show a traceable execution for every real SOS test

### Technical notes
- No database schema change is required.
- The most important architecture fix is removing duplicate `send-sos-alert` invocations from UI components and making `triggerSOS()` the single source of truth.
- The strongest current signal is that the SOS event path works, while the messaging edge function path is either not being reached consistently or is not booting/executing cleanly in its deployed form.
