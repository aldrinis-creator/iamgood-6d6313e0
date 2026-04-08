

## Build Subscription Infrastructure with Website Payment Redirect

### Overview

Replace the mock Razorpay checkout dialog with a redirect to `futurewave.in`, and build the backend infrastructure to track subscription status via a secure webhook.

### Architecture

```text
┌─────────────┐    redirect     ┌──────────────────┐
│  Check-iN   │ ──────────────► │  futurewave.in   │
│  App (PWA)  │  ?plan&billing  │  /pay?...        │
│             │                 │  (Razorpay here) │
│             │ ◄────────────── │                  │
│             │  redirect back  └───────┬──────────┘
│             │  /subscription?status   │
└──────┬──────┘                         │ POST webhook
       │                                ▼
       │ useSubscription()    ┌──────────────────┐
       └─────────────────────►│  Edge Function   │
         reads subscriptions  │  confirm-payment │
                              │  (HMAC verified) │
                              └──────────────────┘
```

### 1. Database — `subscriptions` table

Create a `subscriptions` table:

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | NOT NULL |
| plan_type | text | `basic` or `pro` |
| billing_cycle | text | `monthly` or `yearly` |
| status | text | `active`, `expired`, `cancelled` (default `active`) |
| amount_paise | integer | Amount in paise |
| razorpay_payment_id | text | Nullable, from webhook |
| razorpay_order_id | text | Nullable |
| starts_at | timestamptz | Default now() |
| expires_at | timestamptz | Computed from billing cycle |
| created_at | timestamptz | Default now() |
| updated_at | timestamptz | Default now() |

RLS policies:
- Users can SELECT their own subscriptions
- No client INSERT/UPDATE/DELETE — only the webhook edge function (service role) writes

### 2. Edge Function — `confirm-payment`

`supabase/functions/confirm-payment/index.ts`

- Accepts POST with: `user_id`, `plan_type`, `billing_cycle`, `amount_paise`, `razorpay_payment_id`, `razorpay_order_id`, `signature`
- Verifies HMAC signature using a shared `PAYMENT_WEBHOOK_SECRET` to ensure only `futurewave.in` can call it
- Inserts/upserts into `subscriptions` table with computed `expires_at`
- Returns `{ success: true }`
- Uses service role client to bypass RLS

Requires a new secret: `PAYMENT_WEBHOOK_SECRET` (a shared key you also configure on futurewave.in)

### 3. Client Hook — `src/hooks/useSubscription.ts`

- Queries `subscriptions` table for current user where `status = 'active'` and `expires_at > now()`
- Returns `{ plan, isActive, isPro, isBasic, loading, subscription }`
- Can be used anywhere in the app to gate premium features

### 4. Subscription Page Update — `src/pages/Subscription.tsx`

- Remove the mock Razorpay dialog
- Show current subscription status if active (plan name, expiry date, badge)
- "Choose Plan" button opens `https://futurewave.in/pay?plan=basic&billing=monthly&user_id=xxx&app_callback=<encoded-return-url>` in the same window
- Handle `?status=success` / `?status=cancelled` query params on return to show toast feedback
- If already subscribed to a plan, show "Current Plan" badge and disable that button

### 5. Config — `supabase/config.toml`

Add `verify_jwt = false` for `confirm-payment` (webhook called externally, uses HMAC instead).

### Files Changed/Created

| Action | File |
|--------|------|
| Create | Migration for `subscriptions` table + RLS |
| Create | `supabase/functions/confirm-payment/index.ts` |
| Create | `src/hooks/useSubscription.ts` |
| Modify | `src/pages/Subscription.tsx` |
| Modify | `supabase/config.toml` |

### Secret Required

Before implementation, you will need to provide a `PAYMENT_WEBHOOK_SECRET` — a random string that you also configure on `futurewave.in` to sign webhook requests. This ensures only your website can confirm payments.

