## Plan — Persist Premium Plus pre-registrations to a waitlist

A small backend addition so every "Notify Me" tap is captured in the database, even if the user never actually sends the mailto email.

### 1. New table: `premium_plus_waitlist`


| Column        | Type                                          | Notes                                    |
| ------------- | --------------------------------------------- | ---------------------------------------- |
| `id`          | `uuid` PK                                     | `gen_random_uuid()`                      |
| `email`       | `text` NOT NULL                               | normalized lowercase, **UNIQUE**         |
| `user_id`     | `uuid` nullable                               | populated from `auth.uid()` if logged in |
| `phone`       | `text` nullable                               | from profile if logged in                |
| `full_name`   | `text` nullable                               | from profile if logged in                |
| `source`      | `text` NOT NULL default `'subscription_page'` | future-proof for other entry points      |
| `notified_at` | `timestamptz` nullable                        | set when launch email goes out           |
| `created_at`  | `timestamptz` NOT NULL default `now()`        | &nbsp;                                   |


**RLS:**

- Enable RLS.
- `INSERT` policy for `anon` + `authenticated`: `with check (true)` — anyone can join the waitlist (no enumeration risk because there's no SELECT for them).
- `SELECT` / `UPDATE` / `DELETE`: service_role only (admin-only via edge function later).
- Unique index on `lower(email)` to prevent dupes.

### 2. Wire `Subscription.tsx` to write before navigating to mailto

In the existing `<a href="mailto:…">` Notify Me anchor:

- Add an `onClick` handler that runs BEFORE the mailto opens:
  - Validate email (already done).
  - Fire-and-forget `supabase.from("premium_plus_waitlist").upsert({ email: normalizedEmail, user_id: user?.id ?? null, phone: profile?.phone ?? null, full_name: profile?.full_name ?? null }, { onConflict: "email", ignoreDuplicates: true })`.
  - Show `toast.success("You're on the waitlist! Opening email to confirm…")`.
  - Don't `preventDefault` — the mailto still opens as a confirmation/personal touch.
  - On DB error: still let mailto proceed (don't block the user), but log the error.

This way: the lead is captured even if the user closes the mail client, but they still get the familiar mailto confirmation flow.

### 3. Optional auto-confirmation email (recommended, low effort)

Instead of (or alongside) mailto:

- Trigger `send-transactional-email` with a new template `premium-plus-waitlist-confirmation` after successful insert.
- Confirms enrollment + sets expectations ("We'll email you when the Smart Ring ships in late 2026").
- Uses existing branded React Email pipeline — no new infra.

If you want this, I'll add it in the same change. Otherwise the mailto stays as the user-facing confirmation.

### Files to touch

- **Migration:** new table + RLS + unique index.
- **Edit:** `src/pages/Subscription.tsx` — `onClick` upsert in the Notify Me anchor.
- **(Optional) Create:** `supabase/functions/_shared/transactional-email-templates/premium-plus-waitlist-confirmation.tsx` + register in `registry.ts`.

### Out of scope

- Admin UI to view/export the waitlist (can be added later — for now you can query via the database panel).
- Double opt-in / verification email (premature — entry is already low-friction).
- Removing the mailto entirely (keeps a human signal channel + works as user-side receipt).

### Question before I implement

Do you want the **auto-confirmation email** added now, or just the silent waitlist capture for v1?  
add auto-confirmation email now.