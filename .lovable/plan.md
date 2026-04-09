

## Grant Full (Pro) Rights to Aldrin Alphonso

There are two profiles matching this name. The active one appears to be:
- **Name**: Aldrin Alphonso
- **ID**: `8d12aed0-ce40-4103-acc4-5d69f9df8da7`
- **Phone**: +91 9819576467

### What I'll Do

Insert a `pro` subscription record into the `subscriptions` table for this user with a far-future expiry (e.g. 2099-12-31), granting unlimited access to all features.

### Technical Detail

```sql
INSERT INTO subscriptions (user_id, plan_type, billing_cycle, status, amount_paise, starts_at, expires_at)
VALUES ('8d12aed0-ce40-4103-acc4-5d69f9df8da7', 'pro', 'lifetime', 'active', 0, now(), '2099-12-31T23:59:59Z');
```

This is a data insert (not a schema change), so I'll use the insert tool. No code changes needed — the existing `useSubscription` hook will pick up the `pro` plan automatically.

