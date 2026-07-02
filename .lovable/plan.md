## Problem

The admin verification screen shows `Email failed: Email invoke error: Edge Function returned a non-2xx status code` because `send-transactional-email` is failing to boot:

```
worker boot error: Uncaught SyntaxError: The requested module
'npm:@react-email/components@0.0.22' does not provide an export named 'Col'
  at .../_shared/transactional-email-templates/weekly-report.tsx:4:81
```

`@react-email/components@0.0.22` does not export `Col` (and `Row` behaves differently in this version). Because the shared templates registry is imported at cold-start, ANY template that fails to import brings down the whole `send-transactional-email` function — that's why the 2FA email (a different template) also fails. SMS still works because it goes through MSG91 directly.

## Fix

Edit `supabase/functions/_shared/transactional-email-templates/weekly-report.tsx`:

1. Remove `Row, Col` from the `@react-email/components` import.
2. Replace any `<Row>`/`<Col>` layout in the template with an HTML `<table>`/`<tr>`/`<td>` block (or stacked `<Section>` + inline-styled `<div>`s) styled with the existing navy-blue email tokens, so the weekly report still renders side-by-side stats in email clients.
3. Redeploy `send-transactional-email` so the boot error clears.

No changes to `admin-2fa`, admin UI, other templates, config, or DB.

## Verification

- Confirm `send-transactional-email` logs no longer show the boot error.
- Trigger admin verification: expect "Code sent" toast with both SMS and Email succeeding (no red banner).
