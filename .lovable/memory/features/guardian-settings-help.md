---
name: Guardian Settings & Help
description: Guardian role has dedicated Settings (/guardian-settings) and Help (/guardian-help) pages distinct from the Ward's. /help auto-routes by role.
type: feature
---
- Guardian Settings page (`src/pages/GuardianSettings.tsx`) replaces the Ward Settings UI for guardian accounts. Tabs: Profile, Wards, Notifications, Quiet Hours, Language, Privacy.
- Guardian Help page (`src/pages/GuardianHelp.tsx`) uses `src/data/guardianFaqData.ts` (10 sections covering nomination, dashboard, alerts, hospital admission kit, ward limits, privacy).
- `/help` is served by `HelpRouter` in `App.tsx`: routes guardians to `GuardianHelp`, users to `Help`.
- `/settings` is now `UserRoute`-only; guardians MUST use `/guardian-settings`.
- **CRITICAL DB semantics:** the `guardians` table uses `user_id` = ward, `guardian_user_id` = guardian. NEVER query `guardians.eq('user_id', session.user.id)` on the guardian side — that previously caused the Ward to be rendered as the guardian's "Primary Guardian". On the guardian side always use `eq('guardian_user_id', session.user.id)` and treat `is_primary=true` as "you are this ward's primary guardian".
- Quiet Hours on guardian side: SOS alerts ALWAYS break through; only routine notifications are deferred.
- Ward revocation is one-way: only the Ward can remove a guardian (no "leave ward" action on guardian side).
- Hard cap of 3 wards per guardian regardless of plan tier.
