---
name: Guardian Dashboard Layout
description: Guardian Dashboard follows Alert->Act->Monitor->Review with auto-collapsing alerts, compact med summary, and data analysis collapsed card
type: feature
---
Layout order:
1. WardPicker
2. Active SOS card
3. Health Pattern Alerts (24h)
4. User Status (health ring, battery, safe zone)
5. Missed Check-in Alert
6. Quick Actions (Call, Route, Ambulance, Ping)
7. Ambulance booking
8. Today's Check-iNs (moved above Alerts)
9. Medications Summary (compact dose progress bar + "View Details" expanding full status/adherence/refill, auto-collapses after 5min)
10. Alerts (auto-collapsing Collapsible — opens on unread/active journey, closes 5min after clearing)
11. Journey Tracker
12. Location (collapsible)
13. Care Journal (collapsible)
14. Data Analysis (collapsed card — uses React Router `useNavigate("/guardian/reports")` for in-app navigation, NOT `window.open`)

Nutrition, Face Scan, Wellness tiles show placeholder text until wearable integration.
"Since Last Check-iN" label on the status card time display.
