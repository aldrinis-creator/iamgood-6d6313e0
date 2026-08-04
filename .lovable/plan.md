# Guardian Missed Check-iN alarm: timed blink, auto-dismiss, max 3 shows

## Current behaviour

- The overlay's warning icon uses an infinite pulse animation, so it blinks for as long as the pop-up stays on screen.
- The loud voice alert re-fires every 12 seconds in a loop while the pop-up is open.
- The pop-up never closes on its own — it stays until the Guardian taps Dismiss.

## New behaviour

Each time the alarm appears:

1. The warning icon blinks for 5 seconds, then goes steady (pop-up stays visible).
2. The loud audio alert plays once when the pop-up appears (still bypasses silent mode).
3. If the Guardian does nothing, the pop-up auto-closes after 1 minute.
4. It can reappear up to 3 times in total for the same missed Check-iN (on the next scan cycle after each auto-close). After the 3rd auto-dismiss it stops for that check-in for the rest of the day.
5. Tapping Dismiss closes it immediately and stops all further showings for that check-in that day (unchanged).

```text
show #1 -> blink 5s + 1 audio -> visible 60s -> auto-close
show #2 -> blink 5s + 1 audio -> visible 60s -> auto-close
show #3 -> blink 5s + 1 audio -> visible 60s -> auto-close -> silent for the day
```

## Technical changes

`src/components/GuardianMissedAlarmOverlay.tsx`
- Replace `animate-pulse` on the icon with a state-driven class: pulsing on mount, cleared by a 5s timer.
- Add a 60s auto-dismiss timer that calls a new `onAutoDismiss` callback and hides the overlay; clear both timers on unmount/manual dismiss.
- Reset both timers whenever a new alarm payload is pushed in.

`src/hooks/useGuardianAudio.ts`
- Remove the 12s `setInterval` audio loop (`startLoop`/`stopLoop` interval); play `playLoudAlertSequence` once per showing.
- Track a per-check-in "shown count" in localStorage (same IST-day keying as the existing dismiss store). Skip items whose count has reached 3.
- Increment the count on each show; on auto-dismiss, allow the next poll cycle (60s) to re-show until the cap is hit.
- Keep the existing `guardianPersistentMissedAlarm` setting, accepted-guardian scoping, IST day boundary, and 1-hour-old missed filter unchanged.

No database or settings changes required.
