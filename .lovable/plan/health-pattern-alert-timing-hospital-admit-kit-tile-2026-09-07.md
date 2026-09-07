# Health pattern alert timing + Hospital Admit Kit tile

## 1. Health pattern alert stays 30 seconds with a Dismiss button

The pop-up that appears at the bottom of the screen when an unusual health pattern is detected currently fades away on its own after a few seconds.

Change it so it:

- stays visible for 30 seconds
- shows a clear "Dismiss" button that closes it immediately

Everything else about the alert (when it fires, what it says, the guardian notification it creates) stays the same.

## 2. "Hospital Admit Kit" tile on the Guardian home page

Add a fourth tile to the quick action row on the Guardian's home page, next to Ambulance:

- Label: "Hospital Admit Kit", with a medical-briefcase icon
- Visible to all guardians (no primary-guardian restriction on the tile)
- Tapping it opens the Guardian's Reports page

The row becomes Call · Ambulance · Ping · Hospital Admit Kit, laid out so four tiles fit comfortably on a phone (2x2 grid on narrow screens).

Nothing is removed: the Hospital Admittance Kit tile inside Ward's Activity stays exactly as it is today, including its primary-guardian gating. 

## Technical notes

- `src/hooks/useAbnormalPatternCheck.ts`: the `toast.warning(...)` call gets `duration: 30000` and an action button labelled "Dismiss" that calls `toast.dismiss(id)`.
- `src/pages/GuardianDashboard.tsx`: Quick Actions grid changes from `grid-cols-3` to a 2-column/4-column responsive grid; new `Button` with `BriefcaseMedical` icon calling `navigate("/guardian/reports")`.
- No database, routing, or notification-logic changes.