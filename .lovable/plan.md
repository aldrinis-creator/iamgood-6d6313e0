

## Guardian Dashboard Reordering & Restructuring

### Changes Overview

**File: `src/pages/GuardianDashboard.tsx`**

### 1. Move Today's Check-iNs Above Alerts
- Move the Check-iNs card (lines 803-832) to render immediately after Quick Actions / Ambulance section
- Move the Notification Alerts card (lines 775-801) below Check-iNs

### 2. Auto-Collapsing Alerts Section
- Wrap the existing Alerts card in a `Collapsible` that is controlled by state
- Add state: `alertsOpen` (boolean), driven by `unreadCount > 0` or active journey
- Add a `useEffect` that sets a 5-minute timer to auto-close when alerts appear or journey ends
- When new unread alerts arrive or an active journey is detected, re-open
- When `unreadCount` drops to 0 and no journey, start the 5-min close timer

### 3. Medications — Summary + View Details
- Replace the current always-expanded `CollapsibleSection` with a new inline card
- Show a compact summary: `"X of Y doses taken"` with an inline `<Progress>` bar and percentage
- Add a "View Details" button that toggles showing the full `WardMedicationStatus`, `WardMedicationAdherence`, and `WardRefillOrder`
- Add a 5-minute inactivity timer: after details are opened, auto-collapse after 5 minutes of no interaction
- Fetch dose counts directly in the dashboard (query `medications` + `medication_logs` for today) or extract from `WardMedicationStatus` props

### 4. Data Analysis Tiles Grid
- Remove the individual `CollapsibleSection` wrappers for Vitals, Activity, Emergency Health Card
- Add a new section with heading: `"{wardName}'s Data Analysis"`
- Render a 3-column grid of tiles (navigable cards) for:
  - **Vitals** — links to `/guardian/reports` (vitals section) or opens inline
  - **Activity** — same pattern
  - **Emergency Card** — same pattern
  - **Nutrition** — new tile
  - **Face Scan** — new tile
  - **Wellness** — new tile
- Each tile: icon + label, tapping opens a Dialog/Sheet with the relevant component content
- Keep `CareJournal` collapsible section as-is (not part of data analysis)

### New State Variables
```
alertsOpen: boolean
alertsTimer: NodeJS.Timeout | null
medDetailsOpen: boolean
medDetailsTimer: NodeJS.Timeout | null
medDoseSummary: { taken: number; total: number } | null
dataAnalysisSheet: "vitals" | "activity" | "emergency" | "nutrition" | "facescan" | "wellness" | null
```

### New Components/Imports Needed
- Import existing: `WardVitalsSummary`, `WardActivitySummary`, `EmergencyCardGated`
- For Nutrition/FaceScan/Wellness tiles: render placeholder cards or fetch summary data (these were removed from Health Passport but the ward components may still exist)
- Use `Sheet` or `Dialog` for tile detail views

### Final Layout Order
1. WardPicker
2. Active SOS card (if any)
3. Health Pattern Alerts (if any)
4. User Status card (with health ring, battery, etc.)
5. Missed Check-in Alert
6. Quick Actions (Call, Route, Ambulance, Ping)
7. Ambulance booking (if toggled)
8. **Today's Check-iNs** ← moved up
9. **Alerts** (auto-collapsing) ← moved down, collapsible
10. Journey Tracker
11. Location (collapsible)
12. **Medications Summary** (compact + View Details)
13. **"{wardName}'s Data Analysis"** tile grid
14. Care Journal (collapsible)

### Files to modify
- `src/pages/GuardianDashboard.tsx` — all changes in this single file

