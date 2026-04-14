

## Reorder Guardian Dashboard Layout

Rearrange the render section of `src/pages/GuardianDashboard.tsx` (lines 574-895) to follow the "Alert → Act → Monitor → Review" hierarchy.

### New Order (top to bottom)

1. **Ward Picker** (unchanged)
2. **SOS Banner** (unchanged, stays at top)
3. **Health Pattern Alerts** (unchanged position)
4. **User Status Card** (Last Active / Battery / Mode)
5. **Missed Check-in Alert banner** (move UP from line 825 to before Quick Actions)
6. **Quick Actions** (Call / Route / Ambulance / Ping)
7. **Ambulance Booking** (conditional)
8. **Notification Alerts** (unread count card — move DOWN from line 640)
9. **Today's Check-iNs card** (without the missed banner, already moved up)
10. **Active Journey Tracker**
11. **Location** (collapsible, already collapsed by default)
12. **Medications** — change `defaultOpen` to `true`
13. **Vitals**
14. **Activity**
15. **Reference group** (bottom): Health Passport, Emergency Health Card, Care Journal

### File to modify
- `src/pages/GuardianDashboard.tsx` — reorder JSX blocks in the return statement; set Medications `CollapsibleSection` `defaultOpen={true}`; group Health Passport, Emergency Card, and Care Journal at the bottom.

