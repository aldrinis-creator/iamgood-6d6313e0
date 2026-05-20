## Why your AI credits are draining fast

Lovable AI bills **per request, weighted by model tier and input/output tokens**. Expensive models (Gemini **3.1-pro**, **2.5-pro**, GPT-5) cost many times more per call than `gemini-2.5-flash-lite`. So the bill is driven by: (a) how often calls fire, (b) which model each call uses, (c) how much context you send in.

After scanning the project, three things stand out — one big leak, one model-tier issue, and a few smaller multipliers.

---

### 1. Biggest leak: `useAbnormalPatternCheck` fires far more than intended

`src/hooks/useAbnormalPatternCheck.ts` is wired into `AppLayout`, which wraps every authenticated page. It is *supposed* to run at most once per hour using `lastCheckRef`, but:

- `lastCheckRef` is a `useRef` inside the hook → it **resets on every remount**.
- `AppLayout` mounts/unmounts as the user navigates between Dashboard / Health / Vault / Settings / Map / Alerts etc.
- It also re-fires on every tab focus (`visibilitychange`).

Result: a Lovable AI call to `detect-anomalous-patterns` runs on **every page navigation and every time the app comes to foreground**, for every signed-in user — not once per hour. For an active user this can easily be dozens of calls per session.

It uses `gemini-2.5-flash-lite` (cheap), but at this frequency the cheap model still adds up — and it runs for guardians too, who don't need it.

**Fix:** persist the throttle in `localStorage` keyed by user_id, skip the run for guardian accounts, and drop the `visibilitychange` re-trigger (the interval is enough).

---

### 2. Model tier: health-tools defaults to expensive Pro models

In `supabase/functions/health-tools/index.ts`:

```
symptom_check        → gemini-3.1-pro-preview  (high effort)
vitals_insights      → gemini-3.1-pro-preview  (high effort)
doctor_report        → gemini-3.1-pro-preview  (medium)
hospital_bill_analysis → gemini-3.1-pro-preview (high)
```

Gemini 3.1-pro is one of the most expensive options on the gateway, and `high effort` further multiplies cost. Every Symptom Checker chat turn, every Vitals AI insight tap, every Doctor Visit report, and every Hospital Bill analysis burns Pro-tier credits.

**Fix options (you choose):**

- Move `symptom_check`, `doctor_report`, `hospital_bill_analysis` to `gemini-3-flash-preview` (medium effort). Quality stays good for these structured tasks.
- Keep `vitals_insights` on Pro only if you really want premium reasoning there; otherwise flash is fine.
- For `symptom_check`, also consider sending only the last 6 messages of history instead of the entire chat (currently the full transcript is appended every turn — input tokens grow quadratically with conversation length).

---

### 3. Smaller multipliers

- **Voice Assistant (`voice-query`)**: each tap = 1 Lovable AI call (`gemini-2.5-flash`) + 1 ElevenLabs TTS call. Lovable side is cheap, but the full `gatherContext` JSON is shoved into the user prompt every time — trimming it would help input tokens.
- `**nutrition-advisor` with image** uses `gemini-2.5-pro`. That's correct for vision but expensive — make sure photo meal logging isn't being triggered accidentally.
- `**detect-anomalous-patterns**` also pulls 14 days of multiple tables into the prompt; large payload = more input tokens per call. Once #1 is fixed this matters less.

---

### What is *not* the cause

- No `pg_cron` job is invoking AI functions in the background.
- Push notifications, missed-checkin checks, medication reminders, and email queue do **not** call Lovable AI.
- ElevenLabs voice credits are billed separately by ElevenLabs and are not part of your Lovable AI balance.

---

## Proposed fix (one change set, all reversible)

**A. Fix the anomaly-check throttle (biggest impact)**

- In `useAbnormalPatternCheck`: replace the in-memory `lastCheckRef` with `localStorage` key `anomaly_check_last_run_<userId>`, so the 1-hour gate survives navigation and reloads.
- Skip the hook entirely for accounts with role `guardian` (guardians don't have personal health data anyway).
- Remove the `visibilitychange` listener; rely on the 1-hour `setInterval` + the initial mount check.

**B. Downshift expensive health-tools to flash**

- Change in `supabase/functions/health-tools/index.ts`:
  - `symptom_check`        → `gemini-3-flash-preview` (medium)
  - `doctor_report`        → `gemini-3-flash-preview` (medium)
  - `hospital_bill_analysis` → `gemini-3-flash-preview` (medium)
- Leave `vitals_insights` on Pro (low frequency, premium feature) **or** move it too — your call.

**C. Trim Symptom Checker history**

- In `src/components/health-tools/SymptomChecker.tsx`, only send the last 6 messages to the edge function instead of the full transcript.

**D. Optional: trim voice-query context payload**

- In `voice-query`, drop fields like full `appointments_today.items` and `health_passport` raw breakdown unless the model needs them — send a smaller summarized object.

### Expected outcome

Step A alone should cut your daily AI credit consumption dramatically (this is almost certainly where most of the drain is coming from). Steps B and C reduce per-call cost on the heaviest features. Step D is polish.

### Out of scope

- I'm not touching auth, RLS, scheduling, or the voice-assistant UX.
- ElevenLabs voice credits — those are a separate top-up at elevenlabs.io and not affected by these changes.

Want me to implement A+B+C, or just A first?

implement A+B+C

&nbsp;