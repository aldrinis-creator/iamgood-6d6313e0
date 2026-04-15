

## Fix Messages Not Popping + Remove Blocking Journey Acknowledge Overlay

### Issue 1: Messages System Fixes

**Root causes identified:**
1. No popup overlay exists for guardians when users send messages
2. User's own `GuardianPingOverlay` fires on their own outgoing messages (self-triggered)
3. RLS missing: guardians cannot update `guardian_read` column

**Fixes:**

**A. `src/components/GuardianPingOverlay.tsx`** — Filter out self-sent pings
- In the realtime INSERT handler, check if `p.guardian_user_id !== session.user.id` before showing the overlay. This prevents the user from seeing their own outgoing messages as incoming pings.

**B. `src/components/AppLayout.tsx`** — Add guardian-side ping overlay
- Render a new `UserPingOverlay` component when `role === "guardian"` that listens for new pings where `guardian_user_id = session.user.id` and shows a popup notification.

**C. New component: `src/components/UserPingOverlay.tsx`**
- Similar to `GuardianPingOverlay` but for the guardian role
- Subscribes to realtime INSERT on `guardian_pings` filtered by `guardian_user_id=eq.${session.user.id}`
- Shows popup with the user's message, reply input, and dismiss button
- On dismiss, marks `guardian_read = true`

**D. Database migration** — Add UPDATE RLS policy for guardians
```sql
CREATE POLICY "Guardians can update own pings"
ON public.guardian_pings
FOR UPDATE
TO authenticated
USING (guardian_user_id = auth.uid());
```

### Issue 2: Remove Blocking "Acknowledged" Overlay on Arriving

**Root cause:** The `JourneyAlertOverlay` for "arriving" type is a full-screen modal at z-[100] that blocks the "End Journey" button. It serves no actionable purpose.

**Fix:**

**E. `src/pages/MapMyJourney.tsx`** — Replace arriving overlay with inline banner
- Remove the `JourneyAlertOverlay` for the "arriving" type (keep it for "deviation" which is critical)
- Instead, show the "Arriving Soon" status as a non-blocking inline banner within the status card (already partially done with the badge at line 267, just enhance it)
- Add an "End Journey" button directly accessible without any overlay blocking it

**F. `src/components/JourneyAlertOverlay.tsx`** — No changes needed (keep for deviation only)

**G. `src/hooks/useJourneyTracker.ts`** — When `arrivingSoon` triggers, also play the chime/vibrate directly in the hook instead of relying on the overlay for audio feedback

### Files to modify
- `src/components/GuardianPingOverlay.tsx` (filter self-sent)
- `src/components/UserPingOverlay.tsx` (new — guardian-side overlay)
- `src/components/AppLayout.tsx` (add UserPingOverlay for guardians)
- `src/pages/MapMyJourney.tsx` (remove arriving overlay, keep deviation)
- `src/hooks/useJourneyTracker.ts` (play audio on arrivingSoon)
- Database migration (guardian UPDATE policy)

