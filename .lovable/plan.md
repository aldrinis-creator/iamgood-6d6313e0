

## Geofencing Enhancement Plan

### Current State
Journey-based geofencing works: during active journeys, route deviation >500m triggers guardian alerts. Gated behind Pro tier.

### What to Add: Safe Zone Geofencing

The high-value safety feature for elderly users is **always-on safe zone monitoring** — guardians define a "home zone" radius, and if the user leaves it (without an active journey), guardians are alerted immediately.

---

### Architecture

```text
User sets Home location → stored in user_settings
Guardian enables "Safe Zone" for ward → stored in guardian preferences
Background location sync (already running every 5 min via useLocationSync)
  ↓
Edge function checks: is user outside safe zone radius?
  ↓
YES → notify guardian (push + in-app + optional WhatsApp)
```

---

### Implementation

**1. Database: Add safe zone fields**

Add migration for a `safe_zones` table:
- `id`, `user_id`, `name` (e.g. "Home", "Day Care"), `lat`, `lng`, `radius_m` (default 500), `enabled`, `created_at`
- RLS: user can manage own zones, guardians can view their ward's zones

**2. User Settings: Safe Zone Management UI**

New section in `Settings.tsx` → Privacy tab or new "Safety Zones" tab:
- "Add Safe Zone" — use current location or search for address (reuse `usePlaceAutocomplete`)
- Set radius (200m / 500m / 1km / 2km slider)
- Name the zone (Home, Temple, Park, etc.)
- Toggle enabled/disabled
- Show zone on a mini Leaflet map with circle overlay

**3. Background Check: Enhance `useLocationSync`**

Currently saves location every 5 minutes. Add logic to:
- After saving location, fetch user's active safe zones
- If user is outside ALL enabled zones AND no active journey is running → trigger alert
- Cooldown: only alert once per 30 minutes per zone exit (prevent spam)
- Store `lastZoneAlertAt` in settings to prevent duplicate alerts

**4. Guardian Notification**

When zone exit detected:
- Insert notification for all accepted guardians: "⚠️ [User] has left [Zone Name]"
- Send push notification via existing `send-checkin-push` pattern
- Include location coordinates so guardian can see where user is on their dashboard map

**5. Guardian Dashboard: Zone Visibility**

In `GuardianDashboard.tsx`:
- Show safe zone circles on the ward's location map (dashed border, semi-transparent fill)
- Add a badge "Outside Safe Zone" next to ward status when applicable
- Quick action: "Set Home Zone" if ward has none configured

**6. Feature Gating**

Already gated as Pro feature (`"Geofencing": "pro"`). Safe zones follow the same gating — free/basic users see the feature but get the upgrade prompt.

---

### Files to Create/Modify

| Action | File | Change |
|--------|------|--------|
| SQL | Migration | Create `safe_zones` table with RLS |
| Modify | `src/pages/Settings.tsx` | Add "Safety Zones" management section |
| Modify | `src/hooks/useLocationSync.ts` | Check safe zones after each location save, trigger alerts |
| Modify | `src/pages/GuardianDashboard.tsx` | Show zone circles on map, "Outside Zone" badge |
| Create | `src/components/SafeZoneEditor.tsx` | Map + radius picker + zone CRUD UI |
| Modify | `src/components/AppLayout.tsx` | Show "Outside Safe Zone" warning banner for user |

### Key Design Decisions

- **Client-side zone check** (in `useLocationSync`) rather than an edge function — avoids extra infra, runs every 5 minutes already, simple haversine distance check
- **30-minute cooldown** per zone exit to avoid notification fatigue
- **Multiple zones** supported (Home, Day Care, Temple, etc.) — practical for Indian families
- **No entry alerts** initially — only exit alerts (simpler, higher safety value)

