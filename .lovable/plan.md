

## Fix: Data Analysis Link Not Opening

### Problem
The `window.open("/guardian/reports", "_blank")` on the Card's `onClick` handler may fail in certain mobile browsers or PWA contexts where `window.open` with `_blank` is blocked (popup blocker) since it's not triggered by a direct anchor click.

### Solution
Replace the Card `onClick` + `window.open` approach with a proper `<a>` tag or use React Router's `useNavigate` to navigate within the same tab (since opening a new tab in a PWA is unreliable). Given the guardian context/providers need to wrap the reports page, navigating in the same tab is more reliable.

**`src/pages/GuardianDashboard.tsx`** (line 981)
- Replace `window.open("/guardian/reports", "_blank")` with React Router `useNavigate()("/guardian/reports")`
- This ensures the link works reliably in PWA, mobile browsers, and desktop
- The GuardianReports page already has its own `WardPicker` so context is preserved

### Files
| File | Action |
|------|--------|
| `src/pages/GuardianDashboard.tsx` | Replace `window.open` with `useNavigate` |

