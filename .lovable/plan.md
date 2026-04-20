

## Plan — Admin Sidebar + Waitlist Auto-Notify on Launch

Two features: a shared admin navigation sidebar replacing the current ad-hoc links, and a "Notify All" button on the waitlist page that sends a launch email to all un-notified waitlist users.

### A. Generic Admin Sidebar

**New component — `src/components/AdminSidebar.tsx`**

A lightweight sidebar using the existing `SidebarProvider` + `Sidebar` components from `src/components/ui/sidebar.tsx`. Three nav items:
- Coupons (`/admin/coupons`) — Ticket icon
- Waitlist (`/admin/waitlist`) — Users icon
- Logout — LogOut icon (calls `signOut`, navigates to `/admin/login`)

Uses `NavLink` from `src/components/NavLink.tsx` for active-route highlighting. Collapsible to icon-only mode. `SidebarTrigger` in a small header bar so it is always accessible.

**New layout wrapper — `src/components/AdminLayout.tsx`**

Replaces `AppLayout` on admin pages. Structure:
```text
SidebarProvider
  div.min-h-screen.flex.w-full
    AdminSidebar
    div.flex-1.flex.flex-col
      header (SidebarTrigger + page title)
      main (children)
```

No NavTabs, no SOSButton, no check-in hooks, no footer disclaimer — admin pages don't need any of that.

**Edit admin pages** (`AdminCoupons.tsx`, `AdminWaitlist.tsx`)
- Replace `<AppLayout>` with `<AdminLayout>`.
- Remove the manual `<Link to="/admin/...">` navigation buttons (sidebar handles it).

**Edit `src/App.tsx`** — no route changes needed; only the layout wrapper inside each page changes.

### B. Waitlist Auto-Notify on Launch

**New action in `admin-waitlist` edge function — `action: "notify_all"`**

- Fetches all waitlist rows where `notified_at IS NULL`.
- For each row, invokes `send-transactional-email` with a new `premium-plus-launch` template, passing `{ name: row.full_name }` as `templateData` and `idempotencyKey: "pp-launch-{row.id}"`.
- Updates `notified_at = now()` for each successfully queued row.
- Returns `{ queued: N, failed: N }`.
- Guard: if zero un-notified rows exist, returns immediately with `{ queued: 0 }`.

**New email template — `premium-plus-launch.tsx`**

A branded React Email template announcing the Premium Plus Smart Ring is now available. Mirrors the styling of the existing `premium-plus-waitlist-confirmation.tsx`. Content:
- Heading: "Premium Plus is here, {name}!"
- Body: The Smart Ring is ready to ship. Early-bird pricing active.
- CTA button linking to the subscription page.
- Contact section (same as waitlist confirmation).

Register in `registry.ts` as `'premium-plus-launch'`.

**Frontend — `AdminWaitlist.tsx`**

Add a "Notify All" button in the header (next to Export CSV). Behavior:
- Shows count of un-notified entries (e.g., "Notify 12 users").
- On click, opens a confirmation `AlertDialog`: "Send launch email to X waitlist users?"
- On confirm, calls `invoke({ action: "notify_all" })`.
- Shows toast with results ("Queued 12 emails").
- Refreshes the list so `notified_at` timestamps update.
- Disabled when no un-notified entries exist.

**Important caveat — Email domain not configured**

No email domain is set up for this project yet. The "Notify All" button will work (emails get queued), but they will not actually deliver until the email domain is configured and DNS is verified. The plan includes showing a warning banner on the waitlist page if email sending is not yet active, with a note to set up the email domain.

### Files

**Create**
- `src/components/AdminSidebar.tsx` — sidebar nav component
- `src/components/AdminLayout.tsx` — admin layout wrapper (SidebarProvider + AdminSidebar + content area)
- `supabase/functions/_shared/transactional-email-templates/premium-plus-launch.tsx` — launch notification email

**Edit**
- `src/pages/AdminCoupons.tsx` — swap `AppLayout` for `AdminLayout`, remove manual nav links
- `src/pages/AdminWaitlist.tsx` — swap `AppLayout` for `AdminLayout`, remove manual nav links, add "Notify All" button + AlertDialog
- `supabase/functions/admin-waitlist/index.ts` — add `notify_all` action
- `supabase/functions/_shared/transactional-email-templates/registry.ts` — register `premium-plus-launch`

**Deploy**
- `admin-waitlist` and `send-transactional-email` edge functions after changes

### Email domain setup

After implementation, the email domain needs to be configured for actual delivery. This is a one-time interactive setup step.

