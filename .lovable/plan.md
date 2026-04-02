

# Close the SOS Loop

## Problem
Once SOS is triggered, there's no clean way to end it:
- User has no "I'm Safe" button after the SOS dialog closes
- Guardian can only resolve after 2 hours (stale)
- No notification sent to guardians when SOS is resolved/cancelled

## Changes

### 1. User-side: "I'm Safe" banner
**File: `src/components/SOSActiveBar.tsx`** (new)
- Persistent top banner shown when `emergencyMode === true`
- Red bar with "SOS Active" label and an "I'm Safe" button
- Clicking "I'm Safe" calls `cancelSOS()` and sends a resolution notification

**File: `src/components/AppLayout.tsx`**
- Render `SOSActiveBar` when emergency mode is active

### 2. Guardian-side: Allow immediate resolve
**File: `src/pages/GuardianDashboard.tsx`**
- Show "Resolve" button on ALL active SOS events, not just stale ones
- Add a confirmation dialog before resolving

### 3. Send "SOS Resolved" notification
**File: `src/contexts/AppContext.tsx`**
- Update `cancelSOS` to also:
  - Insert a `notifications` row (type: `sos_resolved`) for each guardian
  - Invoke `send-sos-alert` edge function with an "all clear" message

**File: `src/pages/GuardianDashboard.tsx`**
- Update `resolveSOS` to similarly notify the user and other guardians

### 4. Real-time status sync
- Guardian Dashboard already subscribes to `sos_events` changes — when user cancels, the active SOS card will auto-dismiss via the existing realtime channel

## Files

| File | Change |
|------|--------|
| `src/components/SOSActiveBar.tsx` | **New** — persistent "I'm Safe" banner for user |
| `src/components/AppLayout.tsx` | Render SOSActiveBar |
| `src/contexts/AppContext.tsx` | Send resolution notifications in cancelSOS |
| `src/pages/GuardianDashboard.tsx` | Show resolve button immediately + send notifications on resolve |

