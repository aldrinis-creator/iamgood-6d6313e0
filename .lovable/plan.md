## Answers + Plan

### 1. Why "Premium" isn't in the Active Plans checkbox

**Naming mismatch between the Subscription page and the coupon system.**

- The Subscription page (and Razorpay checkout URL) uses plan keys: `basic`, `premium`, `premium-plus`.
- The Coupon admin and `validate-coupon` edge function only know two legacy keys: `basic` and `pro`.
- The Premium Plus tier is also missing entirely (it's waitlist-only right now, but coupons should still be configurable for it once it launches).

Result: any coupon you create can only ever apply to `basic` or `pro` — and since the checkout sends `premium` / `premium-plus`, a coupon will never validate at checkout for those tiers.

### 2. Where to find Premium Plus pre-registration emails

They're stored in the database table `premium_plus_waitlist` (columns: `email`, `full_name`, `phone`, `user_id`, `source`, `created_at`, `notified_at`). RLS blocks all client reads — only service_role can access. **There is no admin UI to view this table today.**

---

## Proposed fix

### A. Align coupon plan keys with the Subscription page

Update both the admin UI and the validator to use `basic`, `premium`, `premium-plus` (matching what checkout actually sends). Backfill existing `pro` rows to `premium` so old coupons keep working.

**Database migration**

- Update existing coupon rows: `applicable_plans` containing `'pro'` → replace with `'premium'`.
- Update the table default for `applicable_plans` from `{basic,pro}` to `{basic,premium}`.

**Edge function — `validate-coupon**`

- Add `premium` and `premium-plus` to `PLAN_PRICES` map (using the prices from Subscription.tsx: premium ₹199/₹1999, premium-plus ₹999/₹9999).
- Update the allowed `plan_type` validation list.

**Admin UI — `AdminCoupons.tsx**`

- Replace the two-checkbox `["basic", "pro"]` block with three checkboxes: `Basic`, `Premium`, `Premium Plus`.
- Update `EMPTY.applicable_plans` default to `["basic", "premium"]`.

**Edge function — `admin-coupons**`

- Update the `create` action's default `applicable_plans` fallback from `["basic", "pro"]` to `["basic", "premium"]`.

### B. New admin page: Premium Plus Waitlist

Add `/admin/waitlist` so you can see who's pre-registered without going to the database.

**Edge function — `admin-waitlist**` (service_role, admin-only, mirrors the `admin-coupons` auth pattern)

- `action: "list"` → returns all waitlist rows ordered by `created_at` desc.
- `action: "export"` → returns CSV string for download.
- `action: "mark_notified"` → sets `notified_at = now()` for a given id (useful when Premium Plus launches).

**Page — `src/pages/AdminWaitlist.tsx**`

- Table: Email, Name, Phone, Source, Joined date, Notified status.
- Header: total count + "Export CSV" button.
- Per-row "Mark notified" toggle.
- Wrapped in `AppLayout` + `AdminRoute` like the coupon page.

**Routing — `src/App.tsx**`

- Add `/admin/waitlist` inside `<AdminRoute>`.

**Optional small nicety:** add a "Waitlist" link on the Coupons page header so you can flip between admin tools without typing URLs (or build the small admin nav menu mentioned earlier — I'll skip it unless you want it now).   
Go ahead with this Optional plan.

### Files

**Create**

- Migration: backfill `pro` → `premium`, update `applicable_plans` default.
- `supabase/functions/admin-waitlist/index.ts`
- `src/pages/AdminWaitlist.tsx`

**Edit**

- `supabase/functions/validate-coupon/index.ts` — add premium & premium-plus pricing/validation.
- `supabase/functions/admin-coupons/index.ts` — default plan list fix.
- `src/pages/AdminCoupons.tsx` — three-checkbox plan picker.
- `src/App.tsx` — register `/admin/waitlist` route.
- `supabase/config.toml` — add `[functions.admin-waitlist]` block.

### Plan for the following too;

- Building a generic admin nav sidebar (separate small task).
- Notifying waitlist users automatically when Premium Plus launches.
- Refactoring the legacy `pro` references inside `featureGating.ts` — those gate AI features and don't affect coupons; want consistent naming everywhere.