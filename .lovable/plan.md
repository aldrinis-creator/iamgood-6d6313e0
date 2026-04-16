

## Update Guardian Dashboard Memory

### Change
Update `mem://features/guardian-dashboard` to document that:
- Data Analysis is now a collapsed card with an in-app navigation link (`useNavigate` to `/guardian/reports`) instead of `window.open`
- Medications section is positioned above Alerts in the layout order

### File
| File | Action |
|------|--------|
| `mem://features/guardian-dashboard` | Update layout order and Data Analysis navigation note |

### Updated content
Line 1 will be rewritten to reflect:
- Layout reorder: Medications (item 5) above Notification Alerts (item 6)
- Data Analysis collapsed card uses React Router `useNavigate("/guardian/reports")` instead of `window.open`
- Add note about Data Analysis being a collapsed link card at the bottom

