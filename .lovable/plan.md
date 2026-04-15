

## Share with Member/s — Appointment WhatsApp Sharing via MSG91

### Overview
Replace the static "Share with Doctor" button on each appointment card with an interactive "Share with Member/s" action that opens a contact picker (guardians directory) and sends appointment details via WhatsApp using the existing MSG91 Flow API edge function.

### Changes

**1. New Component: `src/components/appointments/ShareAppointmentDialog.tsx`**

A dialog that:
- Fetches the user's guardians from the `guardians` table (accepted status, with phone numbers)
- Displays them as a selectable checklist (name, phone, relation)
- Allows selecting one or more members
- On confirm, calls the existing `msg91-send` edge function with a WhatsApp Flow template for each selected recipient
- Falls back to opening `wa.me` links if MSG91 fails
- Updates `share_status` to `"shared"` on the appointment row after sending
- Shows toast confirmation

**2. New MSG91 Secret: `MSG91_APPT_SHARE_TEMPLATE_ID`**

A new runtime secret for the WhatsApp appointment-share template ID. The user will need to create this Flow template in their MSG91 dashboard with variables like `appointment_title`, `date`, `time`, `location`, `doctor_name`.

**3. Modified: `src/pages/Appointments.tsx`**

- Import the new `ShareAppointmentDialog`
- Replace the static "Share with Doctor" `div` (lines 152-158) with a clickable button labeled **"Share with Member/s"**
- Clicking opens the dialog, passing the appointment data
- Badge still shows "Shared" / "Pending" based on `share_status`

**4. Edge Function: `supabase/functions/share-appointment-whatsapp/index.ts`**

A dedicated edge function that:
- Accepts `{ appointment, recipients: [{ phone, name }] }`
- Reads `MSG91_AUTH_KEY` and `MSG91_APPT_SHARE_TEMPLATE_ID` from env
- Sends via MSG91 Flow API to each recipient with appointment variables
- Returns success/failure per recipient
- Updates the appointment `share_status` to `"shared"` via service-role client

### Files Created
- `src/components/appointments/ShareAppointmentDialog.tsx`
- `supabase/functions/share-appointment-whatsapp/index.ts`

### Files Modified
- `src/pages/Appointments.tsx` — replace share button, add dialog state

### Secret Required
- `MSG91_APPT_SHARE_TEMPLATE_ID` — user must create a WhatsApp Flow template in MSG91 and provide the template ID

### Flow
```text
User taps "Share with Member/s"
  → Dialog opens with guardian contacts (checkboxes)
  → User selects members, taps "Share via WhatsApp"
  → Edge function calls MSG91 Flow API per recipient
  → share_status updated to "shared"
  → Toast: "Appointment shared with 2 member(s)"
```

