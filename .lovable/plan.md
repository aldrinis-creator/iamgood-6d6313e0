## Guardian Appointment Alert Toggle

The toggle you're asking for is already built and shipping — no code change needed.

**Where it lives:** Settings → Notifications → "Ward Appointment Alarms"

- Description shown: *"Loud audio popup at each appointment's alert time for every ward you guard."*
- Backed by the `guardianAppointmentAlarms` setting in `useUserSettings.ts`
- **Default: ON** (`guardianAppointmentAlarms: true` in defaults)
- Only visible on Guardian accounts (inside the Guardian-only section of Settings)
- Wired to `useGuardianAppointmentAlarms.ts`, which suppresses T-5 push + T-0 loud audio popup when the switch is off

If you'd like anything changed about it (label, description, position, or default), tell me and I'll adjust.

## Does the Guardian get a pre-alert when nominated?

Yes — the nominee is notified the moment the Ward nominates them, both at Registration and when added later from Settings/Guardians. Delivery is handled by the `send-guardian-invite` edge function.

**Channels used (in this order, whichever the Ward supplied):**

1. **SMS via MSG91** — sent to `guardian_phone` using the `MSG91_INVITE_TEMPLATE_ID` DLT template. This is the primary pre-alert and is always sent when a phone number is on file.
2. **Branded Email via Resend** — sent to `guardian_email` using the `guardian-invitation.tsx` template (Check-iN navy branding, circular logo) when an email is provided.
3. **WhatsApp fallback link** — the function also logs a `wa.me` deep-link containing the invite text so the Ward can forward it manually if needed.

**What the pre-alert contains:**

- Ward's name and the fact they've nominated this person as a guardian
- A unique nomination link with a 72-hour expiry token
- Accept / Decline actions that route to `guardian-nomination-response`

**Not currently sent as a native WhatsApp template message.** SMS is the phone channel today. If you want the nomination invite to go out over WhatsApp as a proper approved template (like we did for `safe_zone` / `safe_zone_return`), that would need a new DLT template name and a small edge-function change — say the word and I'll plan it. Hold on to this. Will decide later after WhatsApp is fixed.

&nbsp;