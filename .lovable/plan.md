## SOS-aware Location panel + faster GPS sync

Two tightly-scoped changes so guardians see a fresh ward location the moment SOS fires.

### 1. Guardian Dashboard — auto-expand Location during SOS
**File:** `src/pages/GuardianDashboard.tsx`

- The Location section currently uses a `Collapsible` with locally-controlled `open` state defaulting to closed.
- Convert it to a controlled `Collapsible` whose `open` is `true` whenever the selected ward has an `activeSos` (already tracked on the dashboard for the Active SOS card).
- When SOS clears (resolved/cancelled), revert to the user's manual open/close preference.
- Update the section header label to "Live Location (SOS Active)" and add a subtle pulsing red dot when `activeSos` is set.
- Add a small "Updated Xs ago" line under the map using `lastLocationAt` (relative time, refreshed every 10s via a small interval while SOS is active).

### 2. Ward app — bump GPS cadence while SOS is active
**File:** `src/hooks/useLocationSync.ts`
**Reads:** `useApp().emergencyMode` from `src/contexts/AppContext.tsx`

- Today: fixed 5-minute interval.
- New behaviour:
  - Normal: 5 minutes (unchanged).
  - While `emergencyMode === true`: 30 seconds.
  - Hard cap: revert to 5-minute cadence after 15 minutes of continuous SOS, even if still active (battery safeguard). Reset the cap when `emergencyMode` flips back to `true` after a `false`.
- Implementation: add `emergencyMode` to the hook's effect deps; on change, clear the existing interval and re-create at the right cadence. Track SOS-start timestamp in a ref to enforce the 15-min cap.
- Trigger an immediate `saveLocation()` call the instant `emergencyMode` becomes `true` so guardians don't wait for the first tick.
- Keep the `shareLocation` gate: if the ward has location sharing OFF, SOS still respects that (no covert tracking). Coordinates already attach to `sos_events` row at trigger time via `triggerSOS`, so guardians still see the SOS pin even without continuous sharing.

### Out of scope
- No changes to `triggerSOS`, SOS delivery, or `sos_events` schema.
- No changes to safe-zone logic or zone-exit alerts.
- No new permissions or settings UI.

### Verification
1. Ward triggers SOS → Guardian dashboard's Location section opens automatically and shows "Live Location (SOS Active)" with pulse.
2. Ward moves; within ~30s the dot updates and "Updated Xs ago" resets.
3. Ward marks "I'm Safe" → header reverts, GPS interval returns to 5 min.
4. SOS left active >15 min → ward's GPS interval drops back to 5 min (check console/network).
5. Ward with `shareLocation: false` triggers SOS → guardian still sees the SOS pin from the event row, but no continuous live updates (expected).

### Memory updates after implementation
- Update `mem://features/sos-lifecycle` to note: Guardian Location auto-expands on active SOS; ward GPS cadence accelerates to 30s with a 15-min battery cap.
