
## Plan — Contact Us form in Profile + admin table

Add a Contact Us tab inside the My Profile page, store submissions in a new database table, and surface them in the admin section similar to the Premium Plus waitlist.

### Database

**New table: `contact_submissions`**

Columns:
- `id` uuid PK (default `gen_random_uuid()`)
- `user_id` uuid nullable (set when authenticated user submits)
- `full_name` text not null
- `email` text not null
- `phone` text nullable
- `subject` text not null
- `message` text not null
- `source` text not null default `'app-profile'` (so future website submissions can use `'web-landing-page'`)
- `status` text not null default `'new'` (values: `new`, `in_progress`, `resolved`)
- `admin_notes` text nullable
- `responded_at` timestamptz nullable
- `created_at` timestamptz not null default `now()`

**RLS policies:**
- Authenticated users can `INSERT` their own submission (`auth.uid() = user_id` OR `user_id IS NULL`).
- Authenticated users can `SELECT` their own submissions (`auth.uid() = user_id`).
- Admins can `SELECT`/`UPDATE` all rows via `has_role(auth.uid(), 'admin')`.
- Service role full access.

### Frontend — Profile tab

**`src/pages/MyProfile.tsx`**
- Convert the page to use the existing `Tabs` UI (or add a "Contact Us" section alongside current profile sections — match existing tab pattern used in Settings/Help).
- Add new tab "Contact Us" with form fields:
  - Full Name (required, prefilled from profile)
  - Email (required, prefilled)
  - Phone (optional, prefilled, uses `PhoneInput`)
  - Subject (required, dropdown: General Inquiry, Bug Report, Feature Request, Billing, Other)
  - Message (required, textarea, max 1000 chars)
- Validate with `zod` (trim + length limits per security guidelines).
- Submit inserts into `contact_submissions` with `user_id = auth.uid()` and `source = 'app-profile'`.
- On success: toast confirmation, reset form, optionally trigger `send-transactional-email` using existing `contact-confirmation` template to email the user a receipt.

### Admin section

**New page: `src/pages/AdminContacts.tsx`**
- Mirrors `AdminWaitlist.tsx` layout (AdminLayout + table).
- Columns: Email, Name, Phone, Subject, Source, Submitted, Status (badge).
- Row actions:
  - Click to expand/show full message in a Dialog.
  - Status dropdown (new → in_progress → resolved) — updates `status` and `responded_at`.
  - Optional `admin_notes` textarea inside dialog.
- Export CSV button.
- Filter by status (All / New / In Progress / Resolved).

**New edge function: `supabase/functions/admin-contacts/index.ts`**
- Mirror of `admin-waitlist`: actions `list`, `export`, `update_status`, `add_note`.
- Verifies admin via `has_role` RPC.

**Routing & navigation**
- `src/App.tsx` — register `/admin/contacts` route (wrapped in `AdminRoute` + `AdminLayout`).
- `src/components/AdminSidebar.tsx` — add "Contact Submissions" link with badge for `new` count.
- `supabase/config.toml` — add `[functions.admin-contacts]` block.

### Files

**Create**
- `src/pages/AdminContacts.tsx`
- `supabase/functions/admin-contacts/index.ts`
- Migration for `contact_submissions` table + RLS

**Edit**
- `src/pages/MyProfile.tsx` — add Contact Us tab + form
- `src/App.tsx` — register admin route
- `src/components/AdminSidebar.tsx` — add nav link
- `supabase/config.toml` — function config block

### Table name to share

**`contact_submissions`** — use this exact name when wiring up the website's contact form so all submissions (app + web) collect into one table. Set `source = 'web-landing-page'` for website entries vs `'app-profile'` for app entries.
