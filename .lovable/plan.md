## Goal

Bring `src/data/faqData.ts` (User FAQ) and `src/data/guardianFaqData.ts` (Guardian FAQ) fully up-to-date with the features built since the last refresh (FAQ_VERSION `2026-05-11` / GUARDIAN_FAQ_VERSION `2026-05-15`). Add new Q&As for net-new features and revise existing answers where behaviour has changed.

Both files will get a bumped version stamp (e.g. `2026-05-27`) and last-updated comment so the in-app "Download Guide" footer and the version badge reflect the refresh.

## Guardian FAQ (`guardianFaqData.ts`)

**New sections / entries**

1. **Last Active Monitor (NEW)** — explain the escalating tile:
   - <15 min normal, ≥15 amber, ≥30 red, ≥45 red + flashing, ≥60 popup.
   - Auto-refreshes every 10 min, also on tab focus.
   - Suppressed while ward is in Sleep window or Checked Out (Vacation).
   - Popup is one-time per inactivity episode; resets when ward becomes active.
2. **Medication adherence alerts** — clarify the T+60–75 min guardian alert window and that simultaneous doses are batched into a single alert.
3. **Refill visibility** — guardian can see medications running low and nudge the ward; refill orders require Doctor/Hospital details and can sync with Jan Aushadhi alternatives.
4. **Notifications inbox** — auto-cleanup after 48 h; dedup so the same alert isn't repeated; you can mark as read.
5. **Push notifications** — server-side cron checks every 1 min so alerts fire even if the ward's phone is asleep.
6. **Coupons / promos** — wards can apply a coupon at checkout; guardians don't pay.
7. **Subscriptions redirect** — clarify wards pay via futurewave.in/pay (Razorpay), confirmation syncs back.
8. **Guardian Profile scope** — your profile is identity-only (name, phone, avatar, emergency contact). No health, ID, meds or sub-guardians on the guardian side.
9. **Login suppression** — no alert chimes or overlays will fire while you're mid-login (prevents jump-scares on first open).

**Revisions to existing entries**

- **Ward limits** — restate: hard cap 3 wards regardless of the ward's plan.
- **Reading the Dashboard** — add "Last Active tile" bullet alongside Health Score and Today's Appointments.
- **Responding to Alerts** — expand the alert types list to include the new Inactivity (1 h) popup.
- **Account → "stop being someone's Guardian"** — keep one-way revocation, restate clearly.

## User FAQ (`faqData.ts`)

**New sections / entries**

1. **Guardian inactivity monitor (informational)** — let the user know guardians get an escalating tile + 1 h popup if their phone shows no activity, and that Sleep Mode + Check-Out automatically suppress those alerts.
2. **Coupon codes** — how to apply at checkout, single-use per account, validated server-side.
3. **Subscription checkout** — Basic ₹99/mo, Pro ₹199/mo; payment opens futurewave.in/pay (Razorpay); confirmation returns to the app.
4. **Freemium plan limits** — Free 1 guardian, Basic 3, Pro 5; AI-heavy tools gated to higher tiers.
5. **Phone-first login** — phone+OTP is the primary login; email is optional/placeholder; OTPs are 6-digit and one-time.
6. **Push notifications (refresh)** — server cron now fires alerts every minute; works even when the app is closed.
7. **Notifications inbox** — entries auto-cleanup after 48 h; dedup logic prevents repeats.
8. **Offline SOS** — if you trigger SOS while offline, the service worker queues and retries it once back online; your Emergency Profile is also cached offline.
9. **Auto Sleep Mode** — added entry confirming Sleep Mode also suppresses guardian-side inactivity escalation and check-in chimes.

**Revisions to existing entries**

- **Medication Tracker** — refill ordering now requires a Doctor or Hospital reference; Jan Aushadhi cart sync is built in; simultaneous reminders are batched into one alert + chime.
- **Medical Documents / Vault** — viewing uses 1-hour signed URLs; diagnosis records auto-link to attached scans.
- **Emergency Profile** — public profile uses a secure token RPC and is cached by the service worker for offline use.
- **Subscription & Pricing** — replace with the current tier list (Free / Basic ₹99 / Pro ₹199) and Premium Plus details already on the page; remove stale "2 guardians on Basic" copy.
- **Account & Login** — phone-first; verification email is optional; OTPs are self-managed (no email magic link).
- **Settings persistence** — note that changes auto-save with a short debounce and flush on sign-out / app close.
- **Battery monitoring** — confirm 30 % / 10 % thresholds and that guardian only receives a battery alert during an active journey (already correct — just align wording with the memory).

## Implementation

- Edit `src/data/faqData.ts`:
  - Bump `FAQ_VERSION = "2026-05-27"` and the header comment.
  - Add new sections (Guardian Inactivity Info, Coupons, Phone-first Login, Offline SOS, etc.) and revise the entries listed above in place.
- Edit `src/data/guardianFaqData.ts`:
  - Bump `GUARDIAN_FAQ_VERSION = "2026-05-27"` and the header comment.
  - Insert the new "Last Active Monitor" section near the top of "Reading the Dashboard"; add the other new sections (Medication Alerts, Refills, Notifications Inbox, Push, Coupons, Subscriptions, Profile Scope, Login Suppression); revise the listed existing entries.
- No component changes needed — `Help.tsx` and `GuardianHelp.tsx` already read these files and render the new sections / version stamps automatically.
- No DB or backend changes.

## Out of scope

- Translating new copy into the 9 supported languages (translation pass can follow separately).
- Restructuring section ordering beyond inserting the new sections in sensible places.
- Any UI changes to the Help pages themselves.
