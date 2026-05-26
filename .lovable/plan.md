## Goal

Make the Guardian dashboard's **Last Active** tile a true inactivity monitor for the ward, with escalating visual urgency and a 1-hour popup — suppressed while the ward is asleep or checked out.

## Behavior

Thresholds based on `now - ward.last_active_at`:


| Inactivity | Tile state                                  |
| ---------- | ------------------------------------------- |
| < 15 min   | Normal (muted)                              |
| ≥ 15 min   | Amber background + amber text               |
| ≥ 30 min   | Red background + red text                   |
| ≥ 45 min   | Red background, **pulsing/flash** animation |
| ≥ 60 min   | Red + flash **and** one-time modal popup    |


Popup copy:

> "Hello! We have not had any active signal from your Ward **{wardName}** for the past one hour. Please check on them."
> [Dismiss]

Rules:

- Auto-refresh every **10 min** (re-evaluate `now - last_active_at`; the value itself already streams in via Realtime, but we also re-tick the clock).
- Suppression: do **not** color-escalate or show the popup if the ward is currently in **Sleep window** or **Checked Out**.
- Dismiss = hides popup for that ward + that inactivity episode. If the ward becomes active again and later crosses 60 min anew, the popup can show again.
- Popup is per-ward (switching wards in `WardPicker` re-evaluates).

## Implementation

1. **New component** `src/components/WardInactivityPopup.tsx` — modal using existing `Dialog` + design tokens, single Dismiss button.
2. **Edit `src/pages/GuardianDashboard.tsx**` (around lines 874–882, the Last Active tile):
  - Add a `nowTick` state updated every 60 s via `setInterval` (cheap; lets thresholds advance smoothly). A separate 10-min interval re-fetches `last_active_at` from `profiles` as a belt-and-braces refresh in case Realtime is paused.
  - Derive `inactivityMin = (nowTick - new Date(wardLastActive)) / 60000`.
  - Derive `suppressed` = ward is sleeping or checked out (see step 3).
  - Compute tile classes:
    - `≥30`: `bg-destructive/15 text-destructive`
    - `≥15`: `bg-warning/15 text-warning` (amber semantic token)
    - `≥45`: add `animate-pulse` (or a new `animate-flash` keyframe in `index.css` if a stronger flash is wanted)
  - When `inactivityMin ≥ 60 && !suppressed && !dismissedForEpisode`, render `<WardInactivityPopup wardName ... />`.
  - Reset `dismissedForEpisode` whenever `inactivityMin` drops below 60 (ward came back).
3. **Ward pause/sleep awareness** (suppression source):
  - `user_settings` is currently RLS-scoped to the owning user, so the guardian can't read the ward's `pauseMode` / `sleepSchedule` directly.
  - Add a new SECURITY DEFINER RPC `get_ward_pause_state(ward_id uuid)` that returns `{ pause_mode, sleep_start, sleep_end, check_out_ends_at }` only if the caller is an **accepted** guardian for that ward. Call it on dashboard mount and every 10 min.
  - Locally compute: `suppressed = pause_mode === 'checked-out' (and not expired) || (sleepMode enabled && now ∈ sleep window, IST)`.
  - All time math in **IST** per project standard.
4. **Amber token check**: project already uses `bg-warning` / `text-warning` (see offline banner in `AppLayout`). Reuse — no new tokens needed. Red uses `destructive`.
5. **No changes** to `useActivityHeartbeat` — the underlying signal is already correct.

## Edge cases

- `last_active_at` null → show "N/A", no escalation, no popup.
- Ward switch via WardPicker → reset `dismissedForEpisode` and `nowTick` evaluation.
- Guardian role only — logic stays inside `GuardianDashboard`, no impact on user app.
- Tab backgrounded > 10 min → on `visibilitychange → visible`, force a refresh + re-evaluate.

## Open question for you

For the **flash at ≥45 min**, do you want:

- (a) a soft `animate-pulse` (subtle, already in Tailwind), or
- (b) a harder red on/off flash (new keyframe, more attention-grabbing)?

Default I'll go with **(b)** since the intent is escalation, unless you say otherwise.  
go with (b)

&nbsp;