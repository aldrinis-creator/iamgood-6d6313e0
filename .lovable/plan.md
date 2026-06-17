## Why the audio keeps sounding past 3

`src/hooks/useCheckInAudio.ts` fires audio more than 3 times per missed window, for two compounding reasons.

### Bug 1 — A 4th audio at T+35 ("final escalation")

The popup branch correctly stops at `MAX_POPUPS = 3` (audio at T+5, T+15, T+25). But the *next* tick of `check()` falls into the `else if (state.count >= MAX_POPUPS && minSinceLast >= POPUP_INTERVAL_MIN)` branch at line 175 and runs:

```ts
playVoiceReminder(`[…] You have not checked in after 3 reminders…`);
playChime();
```

That is a guaranteed 4th audio cue every time a check-in is missed, on top of the 3 popups.

### Bug 2 — Race on rapid `check()` re-entry can fire 5+ audios

`check()` is invoked every 30 s by `setInterval` **and** on every `visibilitychange`. Each invocation does an `await supabase…isCheckInResponded(…)` *before* it reads/writes `postGraceRef` and `missedSentRef`. While the first call is awaiting Supabase, a second call (often triggered by a focus/visibility flip) starts, awaits, and both then pass the guard, both increment `state.count`, both call `fireAlert(…)`. Same hazard exists in the final-escalation branch (it sets `missedSentRef` only *after* the await resolves on the previous statement, so two parallel calls each fire audio before either sets the flag).

Net effect: a single missed 7 PM check-in can produce 4, 5, or more audio cues — exactly what was observed.

## Fix — `src/hooks/useCheckInAudio.ts` only

1. **Add a re-entry guard** so `check()` cannot run concurrently:
   ```ts
   const runningRef = useRef(false);
   …
   const check = useCallback(async () => {
     if (runningRef.current) return;
     runningRef.current = true;
     try {
       …existing body…
     } finally {
       runningRef.current = false;
     }
   }, [...]);
   ```

2. **Add a hard audio cap per slot.** Track audio fires in a new ref so we can never exceed `MAX_POPUPS = 3` for a given `missedKey`, regardless of which branch tries to play:
   ```ts
   const audioFiredRef = useRef<Map<string, number>>(new Map());
   const tryFireAudio = (key: string, msg: string) => {
     const n = audioFiredRef.current.get(key) || 0;
     if (n >= MAX_POPUPS) return false;
     audioFiredRef.current.set(key, n + 1);
     fireAlert(msg);
     return true;
   };
   ```
   Use `tryFireAudio(missedKey, msg)` in place of the direct `fireAlert(msg)` inside the popup branch (line 165).

3. **Silence the final-escalation branch.** It still:
   - shows the overlay ("Check-In Missed … guardians have been notified"),
   - marks `missedSentRef`,
   - calls `triggerServerEscalation()`,
   but it must NOT call `playVoiceReminder` / `playChime` / `navigator.vibrate`. Remove those three lines (180–182). The overlay + server notification are enough; audio cap is honoured.

4. **Tighten the popup branch ordering** so the count is reserved before any await on the next tick:
   - move `state.count += 1; state.lastFiredAt = now.getTime(); postGraceRef.current.set(missedKey, state);` to run synchronously right after the `state.count < MAX_POPUPS && diffMin >= expectedMin && …` check, *before* `fireAlert`. (Already in that order — keep it. The new re-entry guard from step 1 handles the concurrent-await race.)

5. **Clean `audioFiredRef` cross-day** the same way `missedSentRef` is cleaned at the bottom of `check()`:
   ```ts
   audioFiredRef.current.forEach((_, k) => {
     if (!k.includes(dateKey)) audioFiredRef.current.delete(k);
   });
   ```

No changes to `ReminderOverlay`, `useGuardianAudio`, audio library, edge functions, DB, or settings. Guardian server-side notifications continue to fire via `triggerServerEscalation()` and the existing pg_cron job.

### Expected behaviour after fix

For a missed 7 PM check-in:
- T+5: audio #1 + popup 1/3
- T+15: audio #2 + popup 2/3
- T+25: audio #3 + popup 3/3
- T+35: silent overlay "Check-In Missed — guardians have been notified" + server escalation
- T+60: no further activity for this window

Hard ceiling: 3 audio cues per missed check-in.