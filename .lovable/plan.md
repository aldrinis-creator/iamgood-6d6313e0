

# Inline Emergency Health Card on SOS Overlay

## Overview
After SOS alerts are sent (the "sent" state), replace the current minimal confirmation screen with a full Emergency Health Card displayed inline. This gives first responders immediate access to critical health info without needing to navigate anywhere.

## Changes

### `src/components/SOSDialog.tsx`
Expand the `sent` view (lines 218-250) to show a full Emergency Health Card below the confirmation message:

- Keep existing: success icon, "SOS Alerts Sent!" title, Call Doctor / Call 112 buttons
- Add a new bordered card section titled "Emergency Health Card" containing:
  - **Personal**: Name, DOB, Phone, Gender
  - **Blood Type** (prominent red badge)
  - **Allergies** (highlighted in destructive/warning style)
  - **Medical Conditions** list
  - **Current Medications** list
  - **Family Doctor** name + phone (tap-to-call)
  - **Emergency Contacts** (guardians with tap-to-call)
  - **Location** (map link if captured)
- All data is already loaded in component state (`medical`, `userName`, `userPhone`, `userDob`, `guardians`, `location`) — no new fetches needed
- Also fetch `medications` list (name + dosage) from the existing `fetchData` call for richer display
- Add gender from profiles query (minor addition to fetchData)
- Style: clean card with clear sections, large text for blood type/allergies (first-responder readability)

### No other files change
All required data is already fetched in `fetchData()`. Minor additions: `gender` field from profiles, and structured `medications` (name/dosage) from medications table.

