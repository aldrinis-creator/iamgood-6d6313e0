

## Four Changes: Settings Persistence, 48h Cleanup, Guardian Audio Restrictions, Location Dropdown

### 1. Settings Persist Across Logout / Abrupt Session End

**Problem**: The `updateSetting` function debounces DB writes by 500ms. If the user logs out or the session terminates before the debounce fires, the latest setting change is lost.

**Fix — `src/hooks/useUserSettings.ts`**:
- Add a `flushPendingWrites` function that immediately executes any pending debounced mutation.
- Export it from the hook.

**Fix — `src/contexts/AuthContext.tsx`**:
- Before calling `supabase.auth.signOut()`, flush any pending settings writes.
- Also register a `beforeunload` listener to flush on abrupt tab close.

### 2. Delete Notifications Beyond 48 Hours

**Already done** — a pg_cron job (`DELETE FROM public.notifications WHERE created_at < now() - interval '48 hours'`) runs daily at 3 AM. No changes needed.

### 3. Stop All Guardian Audio Alerts Except Check-iNs (Once, Within 1hr) and SOS

Currently the Guardian app plays audio for: battery low, medication missed/taken, route deviation, missed check-ins (with escalation), SOS/fall. 

**New rule**: Only play audio for:
- **SOS / Fall** — voice alert (unchanged)
- **Missed Check-iN** — play chime **once** per slot, only if the check-in was missed within the last 60 minutes. No escalation, no voice for repeated misses.

**Remove audio for**: battery low, medication missed, medication taken, route deviation, health anomaly, all other types.

**Files to modify**:
- **`src/pages/GuardianDashboard.tsx`**:
  - Remove the battery low `playVoiceReminder` effect (lines 371-379)
  - In the realtime notification handler: remove medication missed/taken chime/voice, remove route deviation voice. For `missed_checkin`: play chime once only if notification `created_at` is within 60 minutes of now (no escalation counter).
  
- **`src/pages/GuardianAlerts.tsx`**:
  - In the realtime handler: remove `route_deviation` voice, remove `missed_checkin` chime. For `missed_checkin`: play chime once only if within 60 minutes. Keep SOS/fall voice.

### 4. Make Location a Collapsible Dropdown in Guardian Dashboard

**Change**: Wrap the Location card (lines 765-798) in a `Collapsible` component with a clickable header showing "Location" with a chevron, defaulting to **collapsed**. When expanded, shows the map and refresh button as before.

**File**: `src/pages/GuardianDashboard.tsx` — replace the Location Card with a `CollapsibleSection` (already defined in the file) or a similar collapsible pattern.

### Files to Modify
- `src/hooks/useUserSettings.ts` — add `flushPendingWrites` export
- `src/contexts/AuthContext.tsx` — flush settings before signOut + beforeunload handler
- `src/pages/GuardianDashboard.tsx` — remove battery audio, restrict notification audio, collapsible location
- `src/pages/GuardianAlerts.tsx` — restrict notification audio

