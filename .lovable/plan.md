## Standardize MSG91 templates to use `user_name`

Goal: Make every MSG91 Flow template use the same variable key — **`user_name`** — for the ward/patient's name. This simplifies template management in MSG91 and the codebase.

### Edge function changes

1. **`send-sos-alert`** (SMS path) — change recipients payload key from `name` → `user_name`.
2. **`send-sos-alert`** (WhatsApp path) — change `body_1` → `user_name`.
3. **`send-pharmacy-order`** — change `body_1` (patient_name) → `user_name`.
4. **`send-ambulance-request`** — change `body_1` (patient_name) → `user_name`.
5. Already correct (no change): `check-missed-checkins`, `notify-guardian-medication`, `send-guardian-invite`.
6. `send-otp` — no name variable, untouched.

### MSG91 dashboard changes (user action)

You'll need to update the variable name in each affected Flow template on MSG91:
- `MSG91_SOS_SMS_TEMPLATE_ID` — rename `name` → `user_name`
- `MSG91_SOS_TEMPLATE_ID` (WhatsApp) — rename `body_1` → `user_name`
- `MSG91_PHARMACY_TEMPLATE_ID` — rename `body_1` → `user_name`
- Ambulance WhatsApp template — rename `body_1` → `user_name`

The other templates (`MSG91_CHECKIN_TEMPLATE_ID`, `MSG91_MED_TEMPLATE_ID`, `MSG91_INVITE_TEMPLATE_ID`) already use `user_name` and don't need MSG91-side changes.

### Coordination

Edge function and template renames must happen together — if the code is deployed before MSG91 templates are updated, SMS will go out with blank names (and vice versa). Recommended order:
1. Update MSG91 templates first (variable name only — template body stays identical).
2. Then deploy the code changes.

Want me to proceed with the code changes now, or wait until you've updated MSG91 first?
