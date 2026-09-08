# Steady reminder bubble, Guardian back button, Hospital Admit Kit shortcut

## 1. Medicine reminder bubble — white and steady
The pop-up reminder bubble currently pulses, has a flashing halo ring, and uses the app background colour.

Change it to:
- A solid white bubble with dark, high-contrast text (kept readable in both light and dark themes).
- No pulsing, no flashing halo — completely still.
- Everything else stays: the round shape, the icon, the action button, tap-to-close, the 10-second auto-close, and the repeat/escalation timing.

## 2. Back button in the Guardian app
Add a back arrow at the top-left of the header for Guardians on every page except their Home page. Tapping it returns to the previous screen; if there is no previous screen in the app, it goes to the Guardian Home page. The greeting, notifications, and profile menu stay where they are.

## 3. Hospital Admit Kit opens the Hospital Visit page
The "Hospital Admit Kit" tile on the Guardian Home currently opens the Reports page on its default (Medications) section. It will instead open the Reports page with the "Hospital Visit" section already selected.

## Technical notes
- `src/components/ReminderOverlay.tsx`: drop `animate-[pulse...]`, remove the `animate-ping` halo span, swap `bg-background` for a white surface with foreground-safe text colours.
- `src/components/AppHeader.tsx`: when `role === "guardian"` and `location.pathname !== "/guardian"`, render an `ArrowLeft` icon button that calls `navigate(-1)` with a fallback to `/guardian`.
- `src/pages/GuardianDashboard.tsx`: Hospital Admit Kit button navigates to `/guardian/reports?section=hospital_visit` (GuardianReports already reads the `section` query param).
