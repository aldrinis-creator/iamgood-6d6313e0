

## Fix Email Disconnects: Bug Fix, Domain Setup, and Queue Migration

### Three issues found

1. **`check-missed-checkins` crash** — The MSG91 WhatsApp block (line 331) references `guardians` and `message` variables that are scoped inside an `if` block ending at line 329. This causes a `ReferenceError` on every run.

2. **No email domain configured** — The previous domain (`notify.www.futurewave.in`) is no longer set up. Without it, the Lovable email queue has no sending domain.

3. **4 edge functions bypass the email queue** — `check-missed-checkins`, `send-sos-alert`, `send-guardian-invite`, and `notify-vital-anomaly` all call the Resend API directly with an invalid API key. These should route through the Lovable email queue instead.

### Plan

**Step 1: Set up email domain**
- Open the email domain setup dialog so you can configure `notify.www.futurewave.in` (or your preferred domain)

**Step 2: Fix the crash in `check-missed-checkins`**
- Move the MSG91 WhatsApp block (lines 331-354) inside the `if (guardians && guardians.length > 0)` block so `guardians` and `message` are in scope

**Step 3: Create 4 new email templates and route through the queue**

Create React Email templates in `_shared/transactional-email-templates/` for:
- `missed-checkin-alert` — guardian notification for missed check-ins
- `sos-alert` — emergency SOS notification to guardians/doctor
- `guardian-invite` — guardian nomination invitation (replace the inline HTML in `send-guardian-invite`)
- `vital-anomaly-alert` — guardian notification for abnormal vitals

Then update each edge function to replace the direct `fetch("https://api.resend.com/emails", ...)` calls with `supabase.functions.invoke("send-transactional-email", ...)` using the appropriate template name.

**Step 4: Register all templates in `registry.ts`**

Add the 4 new templates to the TEMPLATES map.

**Step 5: Deploy all changed edge functions**

### Files to modify

| File | Change |
|------|--------|
| `supabase/functions/_shared/transactional-email-templates/missed-checkin-alert.tsx` | **New** template |
| `supabase/functions/_shared/transactional-email-templates/sos-alert.tsx` | **New** template |
| `supabase/functions/_shared/transactional-email-templates/vital-anomaly-alert.tsx` | **New** template |
| `supabase/functions/_shared/transactional-email-templates/registry.ts` | Register 3 new templates |
| `supabase/functions/check-missed-checkins/index.ts` | Fix scoping bug + replace Resend with queue |
| `supabase/functions/send-sos-alert/index.ts` | Replace Resend with queue |
| `supabase/functions/notify-vital-anomaly/index.ts` | Replace Resend with queue |
| `supabase/functions/send-guardian-invite/index.ts` | Already has a transactional template; replace Resend call with queue invocation |

Note: The `send-guardian-invite` function already has a `guardian-invitation` template registered. Its Resend call will be replaced with a queue invocation using that existing template.

