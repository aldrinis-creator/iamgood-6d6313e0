
## Plan — Show which pending guardians were included or skipped, and why

Today the SOS confirmation already lists every guardian and tags them `(pending)`, but the included/skipped reason is inferred client-side from the phone number. That breaks down for cases the client can't see (e.g. a backend-side dedupe, an invalid normalization, or a guardian row whose status changed between the dialog opening and the SOS firing). I'll make the backend the source of truth and surface its decision per recipient in the UI.

### Backend — `supabase/functions/send-sos-alert/index.ts`

Add an explicit `recipients` array to the response so the UI shows exactly what the function decided for each guardian:

```ts
recipients: [
  {
    guardian_id: string,
    name: string,
    phone_raw: string,         // as stored in guardians table
    phone_normalized: string,  // E.164 form, or null if invalid
    status: "accepted" | "pending",
    included: boolean,
    skip_reason: null
      | "self_targeted"        // matches MSG91 sender 917045868482
      | "invalid_phone"        // failed normalization
      | "duplicate_phone",     // same number as another guardian, deduped
    channels: {
      whatsapp: "accepted" | "rejected" | "not_attempted",
      sms:      "accepted" | "rejected" | "not_attempted",
    },
  },
]
```

Build this list during the recipient-resolution pass (where `phoneMeta` is already built). Tag each row with `status` from the guardians table (so pending vs accepted is preserved), and stamp the per-channel outcome from the existing `whatsappAccepted` / `smsAccepted` / `whatsappError` / `smsError` results once the WA + SMS calls return.

No DB schema changes. The existing `sos_message_attempts` insert is unchanged.

### Frontend — `src/components/SOSDialog.tsx`

Replace the current ad-hoc per-guardian row with a structured "Recipients" section in the confirmation banner, driven by the backend `recipients` array (with a graceful fallback to the existing local-inference behavior if the backend doesn't return it yet, e.g. during deploy lag).

Layout (rendered inside the existing delivery summary card):

```text
Recipients (2)

✓ Don Carlos · +91 98xxxxxx12   [accepted]    WA submitted · SMS submitted
✓ Aisha M.   · +91 99xxxxxx34   [pending]     WA submitted · SMS submitted
                                              Pending acceptance — alerted anyway

✗ Skipped (1)
  Test Guardian · +91 70 4586 8482  [pending]
  Reason: phone matches the WhatsApp sender number — MSG91 cannot
          deliver from sender to itself. Update in My Profile.
```

Rules:
- Included guardians get a green check, an `accepted` or `pending` badge (amber for pending), and a per-channel status line.
- Pending-included guardians get a one-line note: *"Pending acceptance — alerted anyway."*
- Skipped guardians are grouped under a red "Skipped" header with a plain-English reason mapped from `skip_reason` (`self_targeted` → "matches sender number", `invalid_phone` → "phone number is invalid", `duplicate_phone` → "duplicate of another guardian — deduped").
- Top-of-card summary updates accordingly: `Submitted via WhatsApp + SMS for N guardian(s) · M skipped`.

### Type updates

- Extend `SOSDeliveryResult` in `src/contexts/AppContext.tsx` with the new `recipients` array (optional, so older backends don't break the build).
- Pass it through unchanged from `triggerSOS` to the dialog.

### Verification (after deploy)

1. Trigger SOS with a mix of accepted + pending guardians, including one whose phone matches `917045868482` and one with a malformed number.
2. Edge logs show the new `recipients` array in the response.
3. The SOS confirmation card renders:
   - Included accepted + pending guardians with per-channel "submitted" tags.
   - A "Skipped" group listing the self-targeted and invalid-phone guardians with the right reason.
4. Refreshing the dialog while a pending guardian's status flips to accepted in another tab still shows the correct per-recipient state on the next SOS.

### What I will NOT change

- No DB migration.
- No change to MSG91 templates or secrets.
- No change to the existing 24h auto-accept rule for pending guardians.
- Resolved/closed SOS history view is unchanged in this pass.
