

## Plan — Restructure SOS template to fit MSG91's variable-length rule

### What the error means

MSG91 rejects templates when the **ratio of variables to fixed body text** is too high. Our 5-variable SOS body had only ~30 characters of static text wrapping 5 placeholders — WhatsApp considers this spammy. Two ways to fix it: **fewer variables** OR **more fixed text**. We'll do both: drop to **4 variables** and add more grounding copy.

---

### New template — `sos_alert_notification` (4 vars, longer body)

**Name:** `sos_alert_notification`
**Category:** Utility
**Language:** `en_US`
**Sender:** `917045868482`

**Body:**
```text
🚨 EMERGENCY SOS ALERT from Check-iN

{{1}} has triggered an emergency SOS and needs your immediate attention.

Time of alert: {{2}}
Last known location: {{3}}

Health summary: {{4}}

Please call them immediately or reach their nearest emergency contact. If unreachable, contact local emergency services.

Sent via Check-iN — Personal Emergency Response System.
```

**Variable mapping:**
- `{{1}}` = ward name
- `{{2}}` = IST timestamp (e.g. `22 Apr 2026, 15:42 IST`)
- `{{3}}` = Google Maps link OR "Location unavailable"
- `{{4}}` = compact health summary (blood group + key conditions + allergies, truncated to ~200 chars) OR "See app for details"

This restructure:
- Drops from 5 to 4 variables
- Adds ~250 chars of fixed safety copy (call them, contact emergency services, branded footer)
- Keeps every critical data point a guardian needs in a real SOS

---

### Same fix applied preemptively to the other 3 templates

To avoid the same rejection on resubmission, here are the revised, longer-body versions:

#### `missed_checkin_notification` — 3 vars
```text
⏰ Missed Check-iN Alert

{{1}} did not respond to their scheduled {{2}} check-in window today on Check-iN.

This may be nothing, but please reach out to confirm they are safe and well. You can call them at {{3}} or open the Check-iN app to view their status.

Sent via Check-iN — Personal Safety Companion.
```
Vars: `{{1}}` ward name · `{{2}}` window label · `{{3}}` ward phone.
*(Date dropped — "today" is implicit since alert fires within the hour.)*

#### `medication_status_notification` — 3 vars
```text
💊 Medication Update from Check-iN

{{1}} has {{2}} their scheduled medication: {{3}}.

You are receiving this because you are listed as their guardian and have opted in to medication notifications. You can review the full medication schedule and history in the Check-iN app.

Sent via Check-iN — Personal Health Companion.
```
Vars: `{{1}}` ward name · `{{2}}` "taken" / "taken late" / "missed" · `{{3}}` medication name.
*(Timestamp dropped — message arrives in real time, so "just now" is implicit.)*

#### `guardian_invite_notification` — 3 vars
```text
🛡️ Guardian Invitation from Check-iN

Hi {{1}},

{{2}} has nominated you as their Guardian on Check-iN — a personal safety and health companion app for families.

As their Guardian, you'll receive alerts if they miss a check-in, trigger an SOS, or need help. Accept your nomination here: {{3}}

This invitation expires in 72 hours. Sent via Check-iN.
```
Vars: `{{1}}` guardian name · `{{2}}` ward name · `{{3}}` accept link.
*(Relation dropped — already shown in-app on the accept page.)*

---

### Code impact (after templates are approved)

When you approve each template and share the namespace, I'll wire each edge function exactly like pharmacy/appointments — no schema changes. Variable counts in the rewrite will match the new template (4 for SOS, 3 for the other three).

### What you do next

1. In MSG91 dashboard, replace the `sos_alert_notification` body with the **4-variable version above** and submit.
2. Optionally pre-fix the other three templates the same way before submitting them, to avoid hitting the same error.
3. Reply with the namespace for each template once approved — I'll wire the matching edge function.

