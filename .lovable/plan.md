

## Remove Top Navigation Tabs from AppHeader

### What changes
Remove the duplicate role-based tab bars (`user` and `guardian`) from `AppHeader`, keeping only the greeting bar with logo, notifications, accessibility menu, and profile dropdown. The bottom `NavTabs` already covers all navigation with icons, labels, and badges.

### File: `src/components/AppHeader.tsx`

- **Delete lines 68–121**: Remove both the `{role === "user" && (<nav>...</nav>)}` and `{role === "guardian" && (<nav>...</nav>)}` blocks entirely.
- **Remove unused imports**: `useTodayAppointments`, `useRefillDue`, `useLocation` — no longer needed since the tab highlight logic is removed.
- The header will only contain the greeting row (logo + name + notification/accessibility/profile buttons).

### No other files change
- `NavTabs.tsx` already has all the same routes with icons, badges, and active-state highlighting — it remains untouched.

