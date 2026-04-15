

## Admin Coupon Management Panel

### Overview
Create a protected admin page at `/admin/coupons` that provides full CRUD for the `coupons` table. Since the coupons table RLS only allows `service_role`, all mutations will go through a new edge function that verifies admin role before executing.

### Changes

**1. New Edge Function: `supabase/functions/admin-coupons/index.ts`**
- Accepts POST with action: `list`, `create`, `update`, `delete`
- Validates the caller has `admin` role via `has_role(uid, 'admin')`
- Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS on the `coupons` table
- Returns coupon data or success/error responses

**2. New Page: `src/pages/AdminCoupons.tsx`**
- Table view of all coupons with columns: Code, Type, Value, Plans, Expiry, Max Uses, Used, Active, Actions
- "Create Coupon" button opens a dialog with form fields:
  - Code (text, auto-uppercased)
  - Discount Type (select: percentage / flat)
  - Discount Value (number)
  - Applicable Plans (checkboxes: basic, pro)
  - Expiry Date (date picker)
  - Max Uses (number, optional)
  - Active toggle
- Edit button on each row opens the same dialog pre-filled
- Activate/Deactivate toggle switch per row
- Delete button with AlertDialog confirmation
- Color-coded badges for active/expired/exhausted status

**3. Route: `src/App.tsx`**
- Add `/admin/coupons` route protected by a new `AdminRoute` component that checks `has_role` for admin

**4. New Component: `src/components/AdminRoute.tsx`**
- Checks if user has admin role via `user_roles` table
- Redirects non-admins to `/dashboard`

### Files
| File | Action |
|------|--------|
| `supabase/functions/admin-coupons/index.ts` | New — CRUD edge function |
| `src/pages/AdminCoupons.tsx` | New — admin UI |
| `src/components/AdminRoute.tsx` | New — admin route guard |
| `src/App.tsx` | Add route |

### Prerequisites
- You need an `admin` role assigned to your user in the `user_roles` table. I will insert that after building the page, or you can tell me your user ID.

