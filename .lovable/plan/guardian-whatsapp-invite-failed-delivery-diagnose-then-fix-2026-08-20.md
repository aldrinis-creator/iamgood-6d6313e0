# Guardian WhatsApp invite: "Failed" delivery — diagnose, then fix

MSG91 accepted every send (`status: success`, request IDs stored in the logs), so the problem is downstream of our code: WhatsApp itself rejected the message. Our system currently stores only the *submission* response, not the delivery outcome, so the exact reason is not yet known. This plan confirms the cause first, then applies the matching fix.

## What is confirmed today

- Three invites to Lira were submitted successfully (request IDs `e1bb30a4…`, `ed52c4ef…`, `c5ed0042…`) — MSG91 replied "Your request is in process, check delivery reports for status".
- Nothing in the app records the final delivery status, so the dashboard's "Failed" is the only signal we have.
- Two different templates are in play: the misspelled 4-body `guardian_invite_app_downlaod` (live path) and the 3-body + URL-button `guardian_app_downlaod` (test path). Both were accepted, both reportedly failed.

## Step 1 — Pull the real failure reason

Add a small diagnostic function `msg91-wa-report` that queries MSG91's WhatsApp delivery-report/analytics API for a given request ID (and for the integrated number over the last 48h) and returns the raw per-recipient rows, including the WhatsApp error code and description.

Typical codes and what each would mean here:

| Code | Meaning | Fix |
|---|---|---|
| 131026 / "message undeliverable" | Recipient number has no WhatsApp, or number is malformed | Correct the stored guardian phone; add a pre-send check |
| 132001 / template not found | Template name/language/namespace mismatch | Align name + `en` vs `en_US` and namespace |
| 132012 / param mismatch | Wrong number of body/button variables | Match the approved template exactly |
| 131047 / 131049 | Quality/marketing throttling | Re-register the template as UTILITY |
| 470 / no opt-in | Recipient not opted in on this WABA | Opt-in handling or use the SMS/email fallback |

## Step 2 — Cross-check whether it is the number or the template

Send one known-good template (`welcome_user`) to the same number through the existing diagnostic path. If that also fails, the issue is the recipient/WABA opt-in; if it lands, the issue is the invite template definition.

## Step 3 — Apply the fix indicated

Only one of these will be needed, chosen by Steps 1–2:

- Template mismatch: switch `send-guardian-invite` to the template shape MSG91 reports as approved (most likely the 3-body + dynamic URL button `guardian_app_downlaod`, with the token in the button) and drop the misspelled 4-body one.
- Language mismatch: change `languageCode` to whatever the approved template lists (`en` vs `en_US`).
- Recipient issue: validate the guardian's WhatsApp number at nomination time and show the user a clear "this number has no WhatsApp" warning.

## Step 4 — Stop flying blind (do this regardless of cause)

- Persist the MSG91 `request_id` on the invite row and record the final delivery status back into `notification_logs`, so "accepted" is never again mistaken for "delivered".
- In the ward's Guardian list, show the real state: Sent / Delivered / Not delivered.
- When WhatsApp is not delivered, surface a one-tap "Share invite link" fallback (WhatsApp composer / copy link) plus the existing email invite, so a nomination is never blocked by a template problem.

## Technical notes

- New function: `supabase/functions/msg91-wa-report/index.ts` (service-role/admin guarded, read-only against MSG91).
- Edits: `supabase/functions/send-guardian-invite/index.ts` (template shape + status persistence), `supabase/functions/_shared/msg91Whatsapp.ts` if the component shape changes.
- One migration to add delivery-status columns to `guardians` (or a small `guardian_invite_dispatches` record) — decided after Step 1.
- No new secrets; `MSG91_AUTH_KEY` already exists.
