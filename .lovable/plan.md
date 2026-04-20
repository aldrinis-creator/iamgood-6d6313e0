

## Plan — Real 7-day free trial enforcement

Today the "Try Premium Free for 7 Days" banner is purely cosmetic — clicking it just scrolls to the plans. We'll turn it into a real, time-bound trial that grants Pro access for 7 days and auto-downgrades to free when it expires.

### 1. Database — extend `subscriptions` table

Add a small migration so a trial is just another row in `subscriptions` (keeps `useSubscription` logic unchanged).

- New columns:
  - `is_trial` boolean NOT NULL default `false`
  - `trial_used` — handled via a new `profiles` column (see below) so a user can only ever start one trial.
- New `profiles` column:
  - `trial_started_at` timestamptz nullable — set the first time a user starts a trial. Used to permanently block re-trialing.

A trial is recorded as a `subscriptions` row with:
- `plan_type = 'pro'`
- `status = 'active'`
- `is_trial = true`
- `amount_paise = 0`, `razorpay_payment_id = null`
- `starts_at = now()`, `expires_at = now() + 7 days`

### 2. Edge function — `start-trial` (new)

A small POST function that:
- Requires JWT (validates user via `auth.getUser()`).
- Checks `profiles.trial_started_at IS NULL` for that user → otherwise returns `409 Trial already used`.
- Checks no active subscription exists → otherwise returns `409 Already subscribed`.
- Inserts the trial subscription row + sets `profiles.trial_started_at = now()`.
- Fires (best-effort) the `send-transactional-email` flow with a new `trial-started` template (welcome + expiry date).

We use an edge function (not a direct insert) because we need atomic "one trial per user ever" enforcement that RLS alone can't cleanly express.

### 3. Auto-downgrade — pg_cron job

A scheduled job runs every hour:

```sql
UPDATE subscriptions
SET status = 'expired', updated_at = now()
WHERE status = 'active'
  AND expires_at < now();
```

This already covers paid subs too, so it consolidates expiry logic. Plus a follow-up notification insert for trials that just ended ("Your free trial has ended — upgrade to keep Pro features"), via `insert_notification_deduped`.

Optional: a `trial-ending-soon` email at T-2 days using the existing transactional pipeline.

### 4. Frontend — `Subscription.tsx`

**Trial banner CTA** ("Start Your Free Trial") becomes a real action:
- If user not logged in → redirect to `/register`.
- If `useSubscription()` already returns an active sub → toast "You're already on a paid plan."
- If `profile.trial_started_at` is set → toast "Free trial already used on this account." + button greyed out.
- Otherwise → call `start-trial` edge function, on success invalidate the `subscription` query, toast success, scroll to top.

**Active-subscription card** (the existing green "Active: Pro …" card around lines 366-380):
- When `subscription.is_trial === true`, show:
  - Title: `Free Trial — Pro` with a `Trial` badge.
  - Sub-line: `Trial ends in N days (DD MMM)` using a small `daysUntil()` helper.
  - "Upgrade Now" button that scrolls to plans.
- When not a trial → unchanged.

**Banner suppression**:
- Hide the "Try Premium Free for 7 Days" banner entirely if the user already has any active sub OR has already used their trial.

### 5. Feature gating — no change needed

`useSubscription()` already returns `plan_type`, and `canAccessFeature()` keys off that. Because the trial row sets `plan_type = 'pro'`, all Pro features unlock automatically while the trial is active and re-lock the moment cron expires the row. Zero changes to `featureGating.ts` or `useFeatureGate`.

### 6. New email template (optional but recommended)

`trial-started.tsx` — branded React Email mirroring the existing welcome template style:
- Subject: "Your 7-day Premium trial has started"
- Body: list of unlocked features, trial expiry date in IST, CTA to dashboard, link to subscribe before trial ends.
- Register in `_shared/transactional-email-templates/registry.ts`.

### Files to create / edit

**Create**
- Supabase migration (columns + cron job).
- `supabase/functions/start-trial/index.ts`
- `supabase/functions/_shared/transactional-email-templates/trial-started.tsx`

**Edit**
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register new template.
- `src/hooks/useSubscription.ts` — surface `is_trial` and a derived `trialDaysLeft`.
- `src/pages/Subscription.tsx` — wire the CTA, conditional active-card UI, banner suppression.
- `src/integrations/supabase/types.ts` — auto-regenerated post-migration.

### Edge cases handled

- **Re-trial abuse**: blocked by `profiles.trial_started_at` (one per user, forever).
- **Trial → paid mid-trial**: existing `confirm-payment` already marks active rows expired before inserting the new paid sub — works as-is.
- **Cron downtime**: `useSubscription` query already filters by `expires_at >= now()`, so even without cron the user loses access at the right moment client-side. Cron is just for consistency + notifications.
- **Guardian accounts**: trial CTA hidden for `role === 'guardian'` (guardians don't subscribe).

### Out of scope

- Card-on-file / auto-conversion to paid at trial end (no Razorpay tokenization wired up yet).
- Per-feature trial (e.g. trial only Health Tools) — full Pro tier only.
- Trial extensions / referral bonus trials.

