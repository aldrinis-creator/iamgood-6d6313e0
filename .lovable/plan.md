

## Fix: Stop Excess Medication SMS Notifications

### Problem
8 SMS sent for a single missed medication due to two bugs:
1. The "already sent" flag (`missedSentRef`) is in-memory and resets on every page load — so every app open after 60 min re-fires the guardian SMS for the entire day
2. User has 3 duplicate guardian records (same person, same phone), tripling every SMS

### Solution

#### 1. Tighten the final escalation window (`src/hooks/useMedicationAlarms.ts`)
- Change `diffMin < 1440` to `diffMin < HARD_CUTOFF_MIN + 15` (i.e., only fire within 60–75 min window)
- Before calling `notifyGuardiansMissed`, check the database for an existing "missed" log for that slot — if it already exists, skip the SMS call (the DB is the durable guard, not the volatile ref)
- This ensures that even with page refreshes, the SMS only fires once

#### 2. Deduplicate guardians by phone in the edge function (`supabase/functions/notify-guardian-medication/index.ts`)
- Before sending MSG91 SMS, deduplicate `eligibleGuardians` by phone number so the same phone only receives one SMS regardless of how many guardian records exist

#### 3. Clean up duplicate guardian records (database)
- Remove the 2 duplicate "Don Carlos" records for user `8d12aed0-ce40-4103-acc4-5d69f9df8da7`, keeping only one

### Technical Details

**`src/hooks/useMedicationAlarms.ts`** — line 150:
```text
BEFORE: if (diffMin >= HARD_CUTOFF_MIN && diffMin < 1440 && ...)
AFTER:  if (diffMin >= HARD_CUTOFF_MIN && diffMin < HARD_CUTOFF_MIN + 15 && ...)
```
Plus add a DB check: query `medication_logs` for existing "missed" status before calling `notifyGuardiansMissed`.

**`supabase/functions/notify-guardian-medication/index.ts`** — before MSG91 block:
- Deduplicate recipients by phone: `const uniqueRecipients = [...new Map(recipients.map(r => [r.mobiles, r])).values()]`

**Database cleanup** — migration to:
- Delete duplicate guardian rows (keep earliest `id` per `user_id + guardian_phone` combo)
- Add a unique constraint on `(user_id, guardian_phone)` to prevent future duplicates

### Files Modified

| File | Change |
|------|--------|
| `src/hooks/useMedicationAlarms.ts` | Tighten window to 60–75 min; add DB-level "already missed" check before SMS |
| `supabase/functions/notify-guardian-medication/index.ts` | Deduplicate recipients by phone before sending SMS |
| Database migration | Remove duplicate guardians; add unique constraint |

