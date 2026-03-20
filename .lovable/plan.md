# Three Feature Changes: WhatsApp in SOS, Medication Redesign, Guardian Med Notifications

## 1. WhatsApp Message to Guardians from SOS Dialog

**What changes**: Add a WhatsApp button next to each guardian's Call button in the SOS dialog. When tapped, opens `https://wa.me/{phone}?text={encoded SOS message}` with pre-filled emergency text including location and toggled medical info.

**File**: `src/components/SOSDialog.tsx`

- Add WhatsApp icon (use a custom SVG or MessageCircle from lucide)
- Build a WhatsApp deep link with pre-composed SOS message: user name, location (if available), and selected medical info
- Update the "will receive your SOS" text to say "via SMS & WhatsApp" per screenshot
- Also update the SOS confirmation text after countdown to mention WhatsApp

**Screenshot alignment**: The screenshots show medical info displayed inline (not as toggles with switches) — the current toggle UI will be simplified to show info inline with the ability to include/exclude. The countdown shows "Sending SOS in 14s" with a Cancel button.

## 2. Redesign TodaySchedule (Medication Tablets Form)

**What changes**: Enforce the ±1 hour rule more clearly in the UI. Beyond that window, the dose is labeled "Not Taken" (instead of "missed"). Redesign the card layout per the medication screenshot style.

**File**: `src/components/medications/TodaySchedule.tsx`

- Rename "missed" display label to "NOT TAKEN" for doses past the 1-hour window
- The status logic already uses `differenceInMinutes > 60` for auto-marking missed — keep that, just update the UI label
- Ensure the "taken" action button is hidden once the 1-hour window passes
- Clean up card design: clearer time display, medication name/dosage, and status badges

## 3. Guardian Notifications for Daily Medication Taken/Missed

**What changes**: Currently guardians get nudged for missed check-ins but NOT for medication adherence. We need to add guardian notifications when medications are taken or missed.

**Approach**: Create a new edge function `notify-guardian-medication` that:

- Runs on a schedule (or is called from the existing `send-medication-push` function)
- At end of each medication time window (+1 hour), checks if the dose was taken or missed
- Creates a notification in the `notifications` table for each guardian
- Sends push notification to guardian devices
- Setup a Nudge acceptance in Guardian Settings with a defaut as Accepted 

However, a simpler approach: When the user marks a dose as "taken" or when a dose window expires as "missed" in `TodaySchedule.tsx`, insert a notification for each guardian via an edge function call.

**Files**:

- `supabase/functions/notify-guardian-medication/index.ts` — new edge function that accepts `{user_id, medication_name, status, scheduled_time}` and creates notifications + sends push/email to guardians
- `src/components/medications/TodaySchedule.tsx` — after marking taken/skipped, call the edge function to notify guardians

## Technical Details

### SOSDialog WhatsApp Integration

- Use `https://wa.me/${phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(message)}` 
- Build message from toggles: "🚨 SOS ALERT from {userName}. Location: {lat},{lng}. Blood: O+, Allergies: None, Doctor: Dr. X"
- Add MessageCircle icon in green next to Phone icon per guardian row

### Guardian Medication Edge Function

- Uses service role key to insert into `notifications` table (since client can't insert)
- Fetches guardians for the user, creates one notification per guardian
- Sends push via VAPID to guardian devices (same pattern as check-missed-checkins)
- Called from frontend after taken/skipped actions

### Database

- No schema changes needed — `notifications` table already supports custom types, and we'll use type `medication_taken` / `medication_missed`
- The `notifications` table INSERT requires service role (no public INSERT policy), so the edge function is necessary