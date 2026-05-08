## Add "Appointments" to Profile Dropdown (Guardian)

Add an **Appointments** menu item in the top-right profile dropdown (`AppHeader`) so guardians can reach `/guardian/appointments` from anywhere.

### Change

**File:** `src/components/AppHeader.tsx`

In the `DropdownMenuContent`, add a new `DropdownMenuItem` (visible only when `role === "guardian"`) above "My Profile":

```tsx
{role === "guardian" && (
  <DropdownMenuItem onClick={() => navigate("/guardian/appointments")}>
    <CalendarDays className="w-4 h-4 mr-2" /> Appointments
  </DropdownMenuItem>
)}
```

Import `CalendarDays` from `lucide-react`.

### Out of scope
- No changes to bottom NavTabs (kept lean per existing nav memory).
- No changes for the user role (they already have appointments via My Health / dashboard).
- No DB or RLS changes.

### Verification
- Log in as guardian → tap profile avatar (top-right) → "Appointments" appears → tapping it opens `/guardian/appointments` scoped to selected ward.
- Log in as user → no "Appointments" item shown (unchanged behavior).
