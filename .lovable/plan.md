

# Redesign SOS as a Dialog with Medical Info & 30s Countdown

## Current State
- SOS button triggers a full-screen red overlay (`EmergencyModeOverlay`) with a 5s countdown
- No medical info shown, no toggles for what to share, no "Call 112" prominent button
- `triggerSOS` in AppContext fires immediately on button press — no pre-send dialog

## New Design (from screenshots)

The SOS button should open a **dialog/sheet** (not immediately trigger emergency mode). The dialog shows:

1. **Header**: "Emergency SOS" with close X, description text
2. **"Call 112 Emergency Services"** — big red button (tel: link)
3. **Divider**: "OR ALERT YOUR EMERGENCY CONTACTS"
4. **Location note**: "Location will be included in message"
5. **Medical info section** with toggles (data from `health_profile` + `appointments`):
   - Blood Type (from `health_profile.blood_group`)
   - Allergies (from `health_profile.allergies`)
   - Conditions (from `health_profile.chronic_conditions` + `health_profile.current_medications`)
   - Doctor (from most recent `appointments.doctor_name`)
6. **Guardian count**: "N guardian(s) will receive your SOS via SMS & WhatsApp"
7. **Send SOS button** → starts 30s countdown with progress bar and Cancel button
8. On countdown expiry → calls `triggerSOS()` from AppContext

## Flow Change
- **SOS button tap** → opens SOS dialog (does NOT immediately trigger emergency)
- User reviews medical info toggles, then taps "Send SOS Alert"
- 30s countdown begins with cancel option
- If countdown expires → `triggerSOS()` fires, dialog closes

## Files to Change

### `src/components/SOSButton.tsx`
- Instead of calling `triggerSOS` directly, set state to open the SOS dialog
- Render the new `SOSDialog` component

### `src/components/SOSDialog.tsx` (new)
- Sheet/dialog component with all the UI from screenshots
- Fetches `health_profile`, `guardians`, recent `appointments` (doctor name) on mount
- Medical info toggles (blood type, allergies, conditions, doctor) — all ON by default
- "Send SOS Alert" button starts 30s countdown
- Countdown section: red border card with "Sending SOS in Xs", progress bar, Cancel button
- On expiry: calls `triggerSOS()`, shows confirmation

### `src/components/EmergencyModeOverlay.tsx`
- Remove — replaced by the new dialog flow. Or keep as a minimal "Alert Sent" confirmation that auto-dismisses.

### `src/contexts/AppContext.tsx`
- No changes needed — `triggerSOS` and `cancelSOS` remain as-is

## No database changes needed
All data already exists in `health_profile`, `guardians`, and `appointments` tables.

