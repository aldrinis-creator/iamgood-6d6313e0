

## Guardian Ambulance Booking: Auto-use Ward Location + Attach Health Card

### What Changes

1. **Accept props in `AmbulanceBooking`** — new optional props: `wardUserId`, `wardName`, `wardLocation` (from `user_settings.lastLocation`), `wardPhone`.

2. **Auto-populate ward location** — When used from Guardian context (props provided), skip the "Detect My Location" button entirely. Instead show the ward's last known location as a read-only display with an "Edit" pencil button that reveals a manual address/coordinates input for the guardian to override.

3. **Auto-fill patient details** — Pre-fill patient name (from `wardName`) and contact number (from ward's profile phone). Guardian can still edit.

4. **Attach Emergency Health Card to WhatsApp/API** — When sending the ambulance request:
   - Fetch the ward's profile, health_profile, medications, guardians, and medical_history from Supabase (same data as the Emergency Health Card).
   - Build a comprehensive text block appended to the WhatsApp message: blood group, allergies, conditions, current medications, emergency contacts, family doctor.
   - Include the ward's public emergency profile link (`/e/:token`) if available.

5. **Pass ward data from `GuardianServices`** — Fetch ward's location from `user_settings` and phone from `profiles`, pass as props to `AmbulanceBooking`.

### Files to Modify

**`src/components/AmbulanceBooking.tsx`**
- Add props interface: `wardUserId?: string`, `wardName?: string`, `wardLocation?: {lat, lng}`, `wardPhone?: string`
- When `wardUserId` is provided (guardian mode):
  - Pre-fill `patientName` with `wardName`, `contactNumber` with `wardPhone`
  - Show ward location as read-only text with Edit button (toggles editable input)
  - Remove "Detect My Location" button in guardian mode
  - In `sendWhatsApp()`: fetch ward's health data (profile, health_profile, medications, guardians, medical_history, emergency_share_tokens) and append an "Emergency Health Card" section to the WhatsApp message text
- When no props (user mode): keep existing behavior unchanged

**`src/pages/GuardianServices.tsx`**
- Fetch ward's `user_settings` (for `lastLocation`) and `profiles` (for `phone`) 
- Pass `wardUserId`, `wardName`, `wardLocation`, `wardPhone` to `<AmbulanceBooking />`

### WhatsApp Message Format (Guardian Mode)

```text
🚑 AMBULANCE REQUEST

Patient: Ramesh Kumar
Contact: +91 98765 43210
Emergency: Chest pain
Location: https://maps.google.com/?q=19.0760,72.8777

═══ EMERGENCY HEALTH CARD ═══
Blood Group: B+
Allergies: Penicillin, Sulfa
Conditions: Hypertension, Diabetes Type 2
Medications: Metformin 500mg, Amlodipine 5mg
Family Doctor: Dr. Sharma (+91 98765 00000)
Emergency Contacts:
  - Priya Kumar (Daughter) +91 98765 11111 [Primary]
Emergency Profile: https://iamgood.lovable.app/e/abc123
```

### Technical Notes
- Location edit uses a simple text input for address override; the Edit button toggles between read-only display and editable mode
- Health data fetch is done at send time (not on mount) to keep it fresh
- If no emergency share token exists, the profile link line is omitted

