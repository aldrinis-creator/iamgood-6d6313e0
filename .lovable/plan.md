## Goal
Replace the small hydration toast + tiny dashboard banner with a single **large, prominent banner with a Dismiss button**, shown for both "reminder" and "high_risk" hydration levels.

## Changes

### 1. `src/hooks/useHydrationNudge.ts`
- Remove the `toast(...)` call entirely (it's redundant with the new banner).
- Keep the `hydration-level` event dispatch (banner reads it) and keep the guardian advisory logic untouched.
- Keep the 2h throttle for the *event-driven nudge* but always dispatch level so banner can render.

### 2. `src/pages/UserDashboard.tsx`
- Trigger banner when `hydration.level` is `"reminder"` OR `"high_risk"` (not just high_risk).
- Enlarge the banner card:
  - Bigger padding (`p-5`), larger droplet icon (`w-10 h-10`), heading at `text-lg`/`text-xl`, body at `text-base`.
  - Color tint per level: amber for reminder, stronger orange/red tint for high_risk.
  - Dynamic copy:
    - reminder → "💧 Stay hydrated — drink a glass of water now."
    - high_risk → "🥵 Hot & humid ({temp}°C / {humidity}%). Sip water often."
  - Replace small `X` icon button with a **full-width "Dismiss" Button** (outline variant) below the text.
- Daily dismiss persistence (`hydration_banner_dismissed_date`) stays the same — one dismiss covers the day.

### 3. Out of scope
- Guardian hydration advisory (unchanged).
- Quiet hours / pauseMode gating (unchanged — banner respects `hydrationNudges` setting).
- No new files, no DB changes, no audio.

## Visual sketch
```
┌────────────────────────────────────────┐
│  💧  Stay hydrated                     │
│      It's humid today — drink a glass  │
│      of water now.                     │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │           Dismiss                │  │
│  └──────────────────────────────────┘  │
└────────────────────────────────────────┘
```