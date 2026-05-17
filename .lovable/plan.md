# Swap to clean email subdomain

## Goal
Replace failed `notify.www.futurewave.in` with `notify.futurewave.in` so email verification can complete and emails start sending.

## Why
`notify.www.futurewave.in` is permanently failed — the provider reports it's owned by another Mailgun account (`DOMAIN_OWNED_BY_ANOTHER_ACCOUNT`). DNS will never fix this. `notify.futurewave.in` is a clean, unused subdomain on the same root with no conflicts.

## Steps

### 1. Delete failed domain (you)
In **Cloud → Emails → Manage Domains**, delete `notify.www.futurewave.in`.

### 2. Add clean subdomain (you)
In the same dialog, add `notify.futurewave.in`. Lovable will display 2 NS records (`ns3.lovable.cloud`, `ns4.lovable.cloud`).

### 3. Add NS records at registrar (you)
At the `futurewave.in` DNS provider, add the two NS records for the `notify` subdomain. Verification typically completes in minutes to hours (max 72h).

### 4. Update sender domain in code (me)
Update the `SENDER_DOMAIN` and `FROM_DOMAIN` constants in `supabase/functions/send-transactional-email/index.ts`:
- `SENDER_DOMAIN`: `notify.www.futurewave.in` → `notify.futurewave.in`
- `FROM_DOMAIN`: `www.futurewave.in` → `futurewave.in`

Check `auth-email-hook/index.ts` for any hardcoded domain references and update similarly. Redeploy both functions.

### 5. Verify (me + you)
Monitor verification status in **Cloud → Emails**. Once active, trigger a test transactional email and a test password reset to confirm both pipelines deliver.

## What stays unchanged
Email queue (pgmq), `process-email-queue` cron, health monitoring, admin dashboard at `/admin/emails`, all transactional templates, suppression list, unsubscribe tokens, send logs.

## What you need to do
- Delete the failed domain and add `notify.futurewave.in` via the Cloud → Emails dialog
- Add 2 NS records at your DNS provider when prompted
