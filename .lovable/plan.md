## Changes

**1. `src/components/CallGuardianButton.tsx`** — Remove the intermediate "Call +91..." confirmation/prompt. On single tap, immediately set `window.location.href = "tel:<phone>"` to launch the native dialer directly. Keep long-press behavior (550ms) for selecting between multiple guardians when more than one exists. Activity logging to `activity_logs` and the `notify-guardian-call` edge function invocation remain unchanged, fired in the background right before the dialer opens.

**2. `src/components/NavTabs.tsx`** — Restore the "Messages" tab in the bottom navigation for Wards (replacing the "Call" tab that was added previously). The green Call Guardian band on the dashboard now covers the calling need, so the bottom slot returns to Messages.

**3. `src/components/AppHeader.tsx`** — Remove the "Messages" entry from the profile dropdown (added when Messages was relocated). Messages is once again reachable from the bottom tab.

No backend, schema, or PDF changes. Guardian-side navigation untouched.
