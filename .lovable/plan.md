# Fix Guardian Settings & Help (separate from Ward)

## The problem

1. **Shared Settings/Help pages.** `/guardian-settings` and `/help` route a guardian to the same `Settings.tsx` and `Help.tsx` files used by the Ward. Those screens are full of Ward-only controls (Check-In times, SOS, Safe Zones, Sleep/Vacation Mode, Health Passport FAQs, audio alerts, fall detection, etc.) that have no meaning for a Guardian.
2. **Ward shown as "Primary Guardian".** The Guardians tab in Settings queries `guardians` with `user_id = session.user.id`. For a Guardian account this returns rows where they themselves are listed as a ward's guardian — but the UI then renders the **ward's name** (and whichever row is `is_primary`) as the Guardian's "Primary Guardian". This inverts the relationship.
3. **Help/FAQ content** is 100 % ward-centric (heart tap, SOS, Sleep Mode, Vault claim, etc.). A Guardian has different concerns: ward switching, alerts, reports, hospital admission kit, nudges, ward-limit tier.

## What we will build

### A. Dedicated Guardian Settings page (`src/pages/GuardianSettings.tsx`)

Route `/guardian-settings` will mount this new page (wrapped in `GuardianRoute` + `GuardianWardProvider`). Tabs:

- **Profile** — guardian's own name, phone, email, relation to ward (read-only, comes from the ward's nomination), profile photo.
- **Wards** — list of wards monitored (from `guardians` where `guardian_user_id = session.user.id` AND `status='accepted'`). Shows ward name, relation, primary badge if **the guardian is the primary guardian for that ward**, "Leave this ward" action, ward-limit indicator (Free 1 / Basic 3 / Pro 5 — from `useFeatureGate`).
- **Notifications** — push toggle (re-uses `usePushSubscription`), email digest opt-in, WhatsApp opt-in, alert categories (Missed Check-In, SOS, Low Battery, Medication Missed, Geofence Exit, Journey Deviation) with per-category mute.
- **Quiet Hours** — guardian's own do-not-disturb window (alerts still arrive for SOS).
- **Language** — language selector (re-use existing logic).
- **Accessibility** — font size, contrast, reduced motion (re-use existing `AccessibilityMenu`).
- **Privacy** — data access / export / deletion requests scoped to guardian's own data (re-use the existing `PrivacyTab` component but fed with guardian-only context; remove guardian-of-ward selector).
- **Subscription** — current plan, ward-limit, link to upgrade.

Removed from the guardian view (kept Ward-only): Check-In times, SOS configuration, Safe Zones, Sleep Mode, Vacation Mode, Fall Detection, Battery thresholds (these are device-level for the ward), Audio alerts, Health Passport opt-ins, Vault nominee setup.

### B. Dedicated Guardian Help page (`src/pages/GuardianHelp.tsx`)

Route `/help` for guardian role will redirect / branch to this new page. New `src/data/guardianFaqData.ts` with sections targeted at the Guardian:

- Getting started as a Guardian (nomination, accept invite, opt-in)
- Ward Picker & switching between multiple wards
- Reading the Dashboard (alerts hierarchy, health-score ring, today's appointments strip)
- Reports: Hospital Visit / Admission Kit, Appointments, Adherence, Journeys
- Responding to alerts (Missed Check-In, SOS, Low Battery, Geofence, Journey Deviation, Medication Missed)
- Nudges to the ward (missing ID/insurance docs, missed check-ins)
- Ward-limit tiers (Free 1, Basic 3, Pro 5) and how to upgrade
- Privacy: what a Guardian can / cannot see in the ward's app
- Settings (their own — quiet hours, notification channels)
- Account, leaving a ward, contact support

The "How Check-iN Works" intro card is re-written from the guardian's perspective. Reuse the same Accordion UI, search box, and Markdown download as `Help.tsx`.

### C. Fix the "Ward as Primary Guardian" inversion

- Remove the Guardians tab and all Ward-side controls from the Guardian view by routing to `GuardianSettings` instead of `Settings`.
- In the new `GuardianSettings` Wards tab, query strictly:
  ```
  guardians.select(...).eq('guardian_user_id', session.user.id).eq('status','accepted')
  ```
  and label rows as **"Ward"** (with relation, e.g. "Mother", "Father"). The `is_primary` flag is interpreted as "you are this ward's primary guardian" and rendered with a clear label such as "You are the Primary Guardian" — never as the ward themselves being a guardian.

### D. Routing & navigation

- `src/App.tsx`:
  - `/guardian-settings` → new `GuardianSettings` page.
  - `/help` is split: if `profile.role === 'guardian'` → render `GuardianHelp`, else render existing `Help`. Done with a small `HelpRouter` wrapper to avoid two URLs.
- `AppHeader` (guardian variant) and `NavTabs` already point to `/guardian-settings` and `/help`; no link changes needed.

### E. Memory update

Add a project memory note:

- Guardian and Ward have distinct Settings and Help surfaces.
- `guardians` table semantics: `user_id` = ward, `guardian_user_id` = guardian. Never query `guardians` by `user_id = session.user.id` on the Guardian side.

## Files

**New**

- `src/pages/GuardianSettings.tsx`
- `src/pages/GuardianHelp.tsx`
- `src/data/guardianFaqData.ts`

**Edited**

- `src/App.tsx` — route `/guardian-settings` to `GuardianSettings`; add `HelpRouter` for `/help`.
- (Optional) `src/pages/Settings.tsx` — guard against being mounted by a guardian (defensive `<Navigate to="/guardian-settings" />` if `profile.role === 'guardian'`).
- `.lovable/memory/index.md` + new memory file `features/guardian-settings-help.md`.

**Untouched**

- `src/pages/Settings.tsx` and `src/pages/Help.tsx` keep all Ward content as-is.
- No DB schema or RLS changes required.

## Open questions before I build

1. Should the Guardian be able to **leave a ward** from Settings (sets `status='left'` and notifies the ward), or only the ward can revoke?
2. For **Quiet Hours** on the guardian side, should SOS still break through (recommended) or strictly mute everything?
3. Do you want a single combined **Guardian Help** page, or split into "Quick Start" + "FAQ" tabs like the Ward Help has Settings/Privacy/Terms tabs too?

Answer these (or say "use sensible defaults") and I'll implement.  
1. No. Only the Ward can revoke  
2. In Quiet Hours, the SOS must still breakthrough  
3. Single combined Gaurdian Help page

&nbsp;