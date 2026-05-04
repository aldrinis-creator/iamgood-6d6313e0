
## Humidity-Triggered Hydration Prompts (Lightweight)

Per your direction: **no new dashboard widget, no hydration tracking/logging**. We'll piggyback on the humidity value the existing `AQIWidget` already fetches from Open-Meteo and surface a gentle "drink water" nudge to the user, with an optional alert to the primary guardian on extreme conditions.

---

### 1. Where the data comes from
`AQIWidget.tsx` already fetches `relative_humidity_2m` and `temperature_2m` from Open-Meteo on the User Dashboard. No new API calls, no new cron, no new table.

### 2. Thresholds (combined heat + humidity for accuracy)
| Level | Trigger | User Action | Guardian Alert |
|---|---|---|---|
| Comfortable | Humidity < 60% OR Temp < 28°C | None | No |
| Hydration Reminder | Humidity ≥ 60% AND Temp ≥ 28°C | Toast: "It's humid today — drink a glass of water." | No |
| High Risk | Humidity ≥ 75% AND Temp ≥ 32°C | Larger persistent banner on dashboard | **Yes** — primary guardian only |

(Pure humidity without heat is uncomfortable but not dangerous; combining with temperature avoids false alarms in cool monsoon weather.)

### 3. User-side prompt
- New tiny hook `useHydrationNudge(humidity, temp)` runs inside `AQIWidget` after data loads.
- Shows a `sonner` toast (with 💧 icon, "Drink Water" CTA that just dismisses) at most **once every 2 hours**, tracked in `localStorage` (`hydration_nudge_last_at`).
- Hard-stops between 22:00 and 06:00 IST (don't wake people up).
- Respects `pauseMode` — skipped during `sleep` or `checked-out`.
- Respects user setting `hydrationNudges` (default `true`) — togglable in Settings → Alerts.

### 4. High-risk dashboard banner
- When **High Risk** thresholds hit, render a small dismissible `Card` at the top of `UserDashboard.tsx` (above CheckInCard): "🥵 Hot & humid today ({temp}°C / {humidity}%). Sip water often."
- Dismissal persists for the rest of the day in `localStorage`.
- This is a **prompt**, not a tracker — no counts, no logs.

### 5. Guardian alert (High Risk only)
- When High Risk threshold first hits in a day, call `insert_notification_deduped` for the **primary guardian only** (`guardians.is_primary = true`):
  - Title: "Heat & humidity advisory"
  - Message: "{wardName}'s area is {temp}°C with {humidity}% humidity. Please remind them to drink water."
- Dedupe key (handled by RPC's 1-hour window): `type='hydration_advisory'` — natural rate limit.
- Day-level guard: `localStorage` flag `hydration_guardian_alert_date` so we send at most once per day even if the user reopens the app.
- Respects `medicationMissedNotify`-style toggle: new setting `hydrationAdvisoryToGuardian` (default `true`).

### 6. Settings toggles (Settings → Alerts section)
Two new switches in `useUserSettings`:
- `hydrationNudges` (default `true`) — controls user toast + dashboard banner
- `hydrationAdvisoryToGuardian` (default `true`) — controls guardian notification

### Files touched
1. `src/hooks/useUserSettings.ts` — add two new settings keys + defaults.
2. `src/hooks/useHydrationNudge.ts` — **new**, encapsulates threshold logic, throttle, quiet hours, guardian alert.
3. `src/components/AQIWidget.tsx` — call the hook after data loads.
4. `src/pages/UserDashboard.tsx` — render High Risk banner (uses same hook's exported state).
5. `src/pages/Settings.tsx` — two new toggle rows under Alerts.

### Out of scope (not building)
- ❌ Dashboard humidity/hydration widget
- ❌ Glass-counter or daily water-intake tracking
- ❌ New DB tables, edge functions, or pg_cron jobs
- ❌ Background push when app is closed (in-app only)
- ❌ Indoor humidity / wearable integration

Approve and I'll implement.
