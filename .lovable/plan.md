
## Plan — Fix SOS delivery reliability and stop false “sent” confirmations

### What is happening now

The current backend call to MSG91 is succeeding at the API level, but that only means MSG91 accepted the request for processing. It does not confirm that the guardian actually received the WhatsApp or SMS.

Two concrete issues are visible from the current SOS logs:

1. `send-sos-alert` is marking both WhatsApp and SMS as successful immediately after MSG91 accepts the request.
2. The resolved recipient phone in the latest SOS attempt is `917045868482`, which is also the hardcoded MSG91 integrated number being used as the sender. That means the system is currently attempting to send the SOS to the same number configured as the WhatsApp sender, which is very likely the wrong guardian destination.

### What to build

#### 1. Harden recipient validation in `send-sos-alert`
Update `supabase/functions/send-sos-alert/index.ts` so the function:
- logs both the sender number and final recipient numbers clearly
- rejects or warns when a recipient phone matches the configured integrated sender number
- returns a structured warning/error when all recipients are invalid or self-targeting
- distinguishes between:
  - request accepted by MSG91
  - actual delivery confirmed later
  - invalid recipient configuration

This prevents “successful” SOS sends that were never actually deliverable.

#### 2. Stop treating MSG91 acceptance as delivery success
Refine the function response so the app no longer interprets:
- `HTTP 200`
- `type: "success"`
- `request_id`

as “guardian definitely received the alert”.

Instead, return statuses more like:
- `whatsappAccepted`
- `smsAccepted`
- `whatsappRequestId`
- `smsRequestId`
- `deliveryPending: true`

Then update:
- `src/contexts/AppContext.tsx`
- `src/components/SOSDialog.tsx`
- `src/components/FallDetectionOverlay.tsx`

so the UI says “queued” / “submitted to provider” instead of “sent” unless delivery is actually confirmed.

#### 3. Add outbound SOS delivery tracking
Create a database-backed audit trail for SOS outbound messages, for example an `sos_message_attempts` table, storing:
- `sos_event_id`
- `user_id`
- channel (`whatsapp` / `sms`)
- recipient phone
- provider request ID
- provider status
- provider response body
- timestamps
- optional failure reason

Add RLS so only the owning user and accepted guardians tied to that SOS can view relevant records, and service-role/backend code can write them.

This gives a durable source of truth for each guardian notification attempt.

#### 4. Add delivery-status webhook handling for MSG91
Build a backend function to receive MSG91 delivery callbacks for SOS WhatsApp/SMS and update the delivery table when messages move from:
- accepted
- submitted
- delivered
- failed

The existing OTP delivery webhook pattern can be reused, but it should write into the SOS delivery tracking table instead of `otp_events`.

This enables actual delivery confirmation instead of guessing from the initial API response.

#### 5. Surface recipient problems in the app
Update the SOS UX so users can immediately see when guardian contact data is likely wrong:
- show the guardian phone numbers that will receive the SOS before send
- highlight invalid or suspicious numbers
- warn if a guardian phone matches the MSG91 integrated sender number
- show a clear fallback message if no valid recipients exist

This prevents silent misconfiguration.

#### 6. Improve fallback behavior
Keep WhatsApp web fallback only for real provider submission failures, but avoid opening fallback links when:
- the guardian number is invalid
- the number matches the sender number
- there are zero accepted guardians with usable phones

This avoids false backup attempts.

### Files to update

- `supabase/functions/send-sos-alert/index.ts`
- `src/contexts/AppContext.tsx`
- `src/components/SOSDialog.tsx`
- `src/components/FallDetectionOverlay.tsx`

### Backend work required

- Add a migration for an SOS delivery tracking table and RLS policies
- Add a new backend function/webhook endpoint for MSG91 delivery callbacks
- Optionally add a lightweight read query path for debugging recent SOS delivery attempts in the app

### Verification

1. Trigger SOS with an accepted guardian.
2. Confirm the queued recipient phone is the guardian’s real number, not the MSG91 integrated sender number.
3. Confirm the app says “queued” or “processing” immediately after MSG91 accepts the request.
4. Confirm the delivery tracking table records:
   - WhatsApp request ID
   - SMS request ID
   - recipient number
   - accepted timestamp
5. Send a delivery callback and confirm status updates to delivered or failed.
6. Verify the UI reflects real delivery outcomes and no longer reports false success.

### Expected outcome

After this change, the SOS system will:
- stop claiming delivery before it is confirmed
- expose when the guardian phone configuration is wrong
- prevent self-targeted sends to the MSG91 sender number
- provide auditable delivery status for both WhatsApp and SMS
