# Swap to a clean email subdomain

## Goal
Replace the failed `notify.www.futurewave.in` domain with `notify.futurewave.in` so email verification can complete and auth + transactional emails start sending.

## Why this approach
- `notify.www.futurewave.in` is in a permanent **failed** state — the email provider reports the domain is already registered elsewhere, so DNS propagation will never fix it.
- `notify.futurewave.in` is a clean, unused subdomain on the same root domain — no conflict, no DNS changes at the registrar beyond the new NS records Lovable will request.
- All existing email infrastructure (queues, edge functions, templates, monitoring) stays intact — only the sender domain changes.

## Steps

### 1. Remove the failed domain
- Open **Cloud → Emails → Manage Domains**.
- Delete `notify.www.futurewave.in`.

### 2. Add the new subdomain
- In the same dialog, add `notify.futurewave.in` via the email setup flow.
- Lovable will display 2 NS records (`ns3.lovable.cloud`, `ns4.lovable.cloud`) to add at the futurewave.in registrar.

### 3. Add the NS records at the registrar
- Log in to wherever `futurewave.in` DNS is managed.
- Add the two NS records exactly as shown for the `notify` subdomain.
- DNS verification typically completes within minutes to a few hours (max 72h).

### 4. Update sender domain in code
Once the new domain is added, I'll update the `SENDER_DOMAIN` constant in:
- `supabase/functions/send-transactional-email/index.ts`
- `supabase/functions/auth-email-hook/index.ts` (if hardcoded)

From `notify.www.futurewave.in` → `notify.futurewave.in`, then redeploy both functions.

### 5. Verify
- Monitor verification status in **Cloud → Emails**.
- Once active, trigger a test transactional email and a test auth email (password reset) to confirm both pipelines deliver.

## What stays unchanged
- Email queue (`pgmq`), `process-email-queue` cron job, health monitoring edge function and admin dashboard at `/admin/emails`.
- All transactional templates and the `auth-email-hook`.
- Suppression list, unsubscribe tokens, send logs.

## What you need to do
- Confirm you want to proceed.
- Be ready to add 2 NS records at your DNS provider for `futurewave.in` when prompted.

I'll handle steps 1–2 guidance, the code update in step 4, and the deploy.
