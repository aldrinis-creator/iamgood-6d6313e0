## Missed Check-In Email Notifications to Guardians

### Problem

Guardians have no `email` field — only `guardian_phone`. To send email notifications, we need to add a `guardian_email` column to the `guardians` table.

### Changes

**1. Database Migration — Add `guardian_email` to `guardians` table**

- `ALTER TABLE guardians ADD COLUMN guardian_email text;`

**2. Edge Function — `check-missed-checkins/index.ts**`

- Scheduled to run every 10 minutes via `pg_cron`
- Uses service role key to query across all users
- Logic:
  1. Find all `check_ins` with `status = 'pending'` where `scheduled_at` is more than 10 minutes past the window end (window end = next check-in hour or 11:59 PM for the 7 PM slot)
  2. For each missed check-in, look up the user's guardians from the `guardians` table
  3. Look up the user's name from `profiles`
  4. Send an email to each guardian with an email address using Supabase's built-in `supabase.auth.admin` or the Resend-based approach — since no external email service is configured, we'll use the **Lovable AI endpoint** to compose and send via a simple SMTP/HTTP call
  5. Update the check-in status to `missed` so it's not re-processed
- Actually, the simplest approach: use `net.http_post` from within a database function, or use the edge function with the built-in Resend integration

**Revised approach — keep it simple with Supabase Edge Function + Resend:**

Since Lovable Cloud has `SUPABASE_SERVICE_ROLE_KEY` available, the edge function can:

1. Query `check_ins` for overdue pending records (30 min past window)
2. Join with `guardians` and `profiles` to get guardian emails and user names
3. Use `Deno.env.get("SUPABASE_URL")` + service role to make admin queries
4. Send emails using Supabase's built-in auth email or a simple fetch to a mail API

For email sending without external API keys, the edge function will use the **Lovable AI proxy** or we can simply log/store notifications in a `notifications` table and show them in-app for now, then layer on email later.

**Pragmatic plan:**

**1. Migration: Add `guardian_email` column + create `notifications` table**

```sql
ALTER TABLE guardians ADD COLUMN guardian_email text;

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  guardian_id uuid REFERENCES guardians(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'missed_checkin',
  title text NOT NULL,
  message text NOT NULL,
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- Guardians can view their notifications
-- Users can view notifications about them
```

**2. Edge Function: `check-missed-checkins**`

- Runs on a cron schedule (every 10 minutes)
- Finds pending check-ins older than 10 minutes past their window
- Creates notification records for each guardian
- Marks the check-in as `missed`
- Sends email via Resend (if we have an API key) — otherwise just creates in-app notifications

**3. Update `supabase/config.toml**` to disable JWT verification for the scheduled function

**4. Set up `pg_cron` job** to invoke the edge function every 10 minutes

**5. Update Guardian Dashboard** to show real notification badges and missed check-in alerts

**6. Update UI** — add `guardian_email` field to the guardian management form in Medical Vault

### Files to create/modify

- New migration SQL (add `guardian_email`, create `notifications` table with RLS)
- `supabase/functions/check-missed-checkins/index.ts` — edge function
- `supabase/config.toml` — add function config (handled automatically)
- `src/pages/GuardianDashboard.tsx` — show real missed check-in data
- `src/pages/MedicalVault.tsx` — add email field to guardian form
- `pg_cron` job via insert tool

### Email Sending

Since no external email API key is configured, the initial implementation will create **in-app notifications** visible on the Guardian Dashboard. We can layer on email delivery (via Resend or similar) as a follow-up once an API key is provided.