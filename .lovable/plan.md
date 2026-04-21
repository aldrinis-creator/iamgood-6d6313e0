

## Plan — Draft WhatsApp Template for Appointment Sharing

The edge function (`share-appointment-whatsapp`), frontend dialog (`ShareAppointmentDialog.tsx`), and secret slot (`MSG91_APPT_SHARE_TEMPLATE_ID`) **already exist and are wired up** — including a `wa.me` fallback if MSG91 fails. The only missing piece is the approved WhatsApp template in MSG91.

Below is the template to submit. The variable names match exactly what the existing edge function already sends, so once you paste the approved Template ID into the secret, the flow works in both User and Guardian apps with no code changes.

---

### Template Metadata

| Field | Value |
|---|---|
| **Template Name** | `appointment_share` |
| **Category** | `UTILITY` (transactional — fastest approval) |
| **Language** | `English` (`en`) |
| **Header** | None |
| **Footer** | `Sent via Check-iN` |
| **Buttons** | None |

---

### Template Body (paste exactly)

```
Hello {{1}}, an appointment has been shared with you via Check-iN.

*Appointment:* {{2}}
*Date:* {{3}}
*Time:* {{4}}
*Doctor:* {{5}}
*Location:* {{6}}

Please save this to your calendar. Reply if you need any clarification.
```

### Sample Values (required for MSG91 approval)

| Var | MSG91 field name | Sample |
|---|---|---|
| `{{1}}` | `member_name` | `Priya Sharma` |
| `{{2}}` | `appointment_title` | `Cardiology Follow-up` |
| `{{3}}` | `date` | `25 Apr 2026` |
| `{{4}}` | `time` | `10:30` |
| `{{5}}` | `doctor_name` | `Dr. R. Mehta` |
| `{{6}}` | `location` | `Apollo Hospital, Bangalore` |

---

### Why these choices

- **UTILITY category**: appointment notifications are transactional → 1–24h approval, vs days for MARKETING.
- **Opens with `{{1}}` greeting that includes static text "Hello"**: WhatsApp rejects templates that start with a bare variable, so the leading "Hello " keeps it compliant while still personalising.
- **Variable names match the existing edge function payload exactly** (`member_name`, `appointment_title`, `date`, `time`, `doctor_name`, `location`) — no code changes needed after approval.
- **Bold via asterisks**: scannable by busy recipients.
- **No buttons/header/URLs**: highest approval rate, no extra review.

---

### Your steps in MSG91

1. **MSG91 dashboard → WhatsApp → Templates → Add New**.
2. Name `appointment_share`, category **UTILITY**, language **English**.
3. Paste the body above; fill the 6 sample values from the table.
4. **Important**: in the variable mapping step, name the variables exactly: `member_name`, `appointment_title`, `date`, `time`, `doctor_name`, `location` — these must match the keys the edge function already sends.
5. Submit for approval.
6. Once approved, copy the **Template ID** and paste it as the value of the existing secret `MSG91_APPT_SHARE_TEMPLATE_ID` (already provisioned).

---

### After you update the secret

Nothing for me to build — the flow is already complete:

1. User taps **"Share with Member/s"** in Appointments → selects guardians → taps **Share via WhatsApp**.
2. Frontend invokes `share-appointment-whatsapp` edge function.
3. Edge function calls MSG91 Flow API with the approved template.
4. On success → marks `appointments.share_status = 'shared'` and shows success toast.
5. On failure → automatic fallback opens `wa.me/<phone>?text=...` for each recipient (already implemented).

This works identically in the User app and Guardian app since both use the same `ShareAppointmentDialog` component.

### Common rejection reasons to avoid

- Don't add promotional language ("Best appointment service!") — flips it to MARKETING.
- Don't start the body with a bare `{{1}}` — already handled with the "Hello " prefix.
- Don't include URLs in the body — increases scrutiny and rejection risk.

The template above already follows all three rules.

