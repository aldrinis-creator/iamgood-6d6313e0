

## Reorganize User Dashboard

### New Layout Order (top to bottom)
1. Email Prompt Banner (unchanged)
2. Mode Selector (unchanged)
3. Check-In Card (unchanged)
4. Map My Journey (unchanged)
5. **NEW: Today's Appointments reminder card** — compact card showing count of today's appointments with a tap-to-navigate action to `/appointments`
6. **NEW: Medication Due alert** — compact card showing low-stock/refill-due medications using existing `useRefillDue` hook, linking to `/my-health?tool=Medications`
7. Health Passport accordion (unchanged, collapsed by default)
8. ~~How It Works~~ — **removed** (moved to Help)
9. ~~AI Health Companion~~ — **removed** (moved to Help)

### Files to Modify

**`src/pages/UserDashboard.tsx`**
- Import `useTodayAppointments` and `useRefillDue`
- Add a compact appointments card (icon + "You have N appointments today" + chevron) between Map My Journey and Health Passport — only renders when count > 0
- Add a compact medication alert card (icon + "Medication refill due" + chevron) below appointments — only renders when `refillDue` is true
- Delete the "How It Works" accordion (lines 267-292) and "AI Health Companion" card (lines 294-303)

**`src/pages/Help.tsx`**
- Add a new "About" or "How It Works" section within the FAQ tab (or as a separate card above FAQs) containing:
  - The 4-step "How Check-iN Works" content
  - The "AI Health Companion" description
- These render as static cards at the top of the FAQ tab content area

### Technical Details
- `useTodayAppointments()` already returns today's appointment count with 60s refresh
- `useRefillDue()` already returns a boolean for low-stock medications with realtime subscription
- Both new cards are conditional (hidden when nothing to show), keeping the dashboard clean
- Cards use `onClick={() => navigate(...)}` for navigation, matching the Map My Journey pattern

