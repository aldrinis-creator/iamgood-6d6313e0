# Fix: DLQ messages not visible in Admin → Emails

## Diagnosis

Database has **1,657 messages stuck in DLQ** (1 in `auth_emails_dlq`, 1,656 in `transactional_emails_dlq`), but the Admin → Emails → DLQ tab appears empty / unhelpful. Two real bugs combine to make them "invisible":

1. **Wrong field names in the DLQ row renderer.** `DlqSection` reads `m.message?.to`, `m.message?.label`, `m.message?.subject`. But messages in the DLQ are the **pre-rendered Lovable Email API payload** (`from`, `to`, `subject`, `html`), not the original enqueue envelope (`templateName`, `recipientEmail`, `label`). Result:
   - `Template:` always shows `—`
   - `To:` happens to work (field is also called `to`)
   - `Subject:` works only because the payload also has `subject`
   - There is no visible cue that these are welcome emails — so the user scrolls and sees a wall of "Template: —" entries and assumes the DLQ is empty / wrong.

2. **Hard `LIMIT 50` per DLQ.** `read_dlq_messages` is called with `limit_count: 50`. With 1,656 messages in the transactional DLQ, 1,606 are silently hidden and there is no pagination, no "load more", no count of how many are truncated. The card title shows `(50)` even though the queue depth stat card shows 1,656 → looks like a UI bug or stale data.

The earlier "16 stuck welcome emails" estimate was wrong — the welcome-email failure has been recurring for weeks and the real backlog is ~1,656. The DLQ growth alert kept firing because new failures keep arriving.

## Plan

### 1. Show real fields in the DLQ row
Update `DlqSection` (`src/pages/AdminEmails.tsx`, ~line 607-617) to read fields actually present on a pre-rendered payload, with fallback to envelope fields for backward compatibility:
- **To:** `m.message?.to ?? m.message?.recipientEmail ?? "—"`
- **Subject:** `m.message?.subject ?? "—"`
- **Template:** derive from subject heuristics OR show `m.message?.templateName ?? m.message?.label ?? "(pre-rendered payload)"`
- Add a small expandable "View raw payload" `<details>` so the admin can confirm what each stuck message actually is.

### 2. Surface the true backlog size and add pagination
- Change card title from `({messages.length})` to `({messages.length} of {queueDepth(queueName)})` so the truncation is visible.
- Bump default `limit_count` from 50 → 200, and add a **Load more** button that re-calls `read_dlq_messages` with a larger limit (e.g. +200 each click). Keep the RPC's existing hard cap.
- Show a warning banner above the list when `queueDepth > messages.length`: "Showing N of M. Older messages are not loaded."

### 3. Add a "Purge all" action for the welcome-email backlog
With 1,656 messages, deleting one-by-one is not viable. Add a single **Purge all messages in this DLQ** button (with a strong confirmation dialog requiring the user to type the queue name) that calls a new SECURITY DEFINER RPC `purge_dlq(dlq_name text)` wrapping `pgmq.purge_queue`. This is the only realistic way to clear the existing backlog so the `dlq_total_threshold` alert stops firing.

### 4. (Out of scope, but noted) Root-cause the welcome-email failures
The 1,656 messages all look like the same welcome email template repeatedly failing. The code fix to stop *new* failures was shipped earlier, but the historical backlog still needs purging (step 3). After purging, monitor for 24h to confirm the queue stays at 0.

## Files touched

- `src/pages/AdminEmails.tsx` — fix field names, add pagination/load-more, add purge button, update card title.
- New migration — add `purge_dlq(text)` RPC (admin + service_role only, restricted to the two DLQ queue names).

## Out of scope

- Changing the dispatcher behaviour or DLQ retention policy.
- Investigating *why* welcome emails fail (already addressed in earlier turn; this plan only restores visibility + cleanup).
