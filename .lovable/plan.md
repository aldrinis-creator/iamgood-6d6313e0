## Hide expired medications from the Tablets tab

**Problem:** In the Tablets/Medications list, meds keep showing even after their End Date has passed. The list query in `MedicationList.tsx` fetches all rows for the user with no date filter.

**Fix:** Filter out any medication whose `end_date` is set and is on or before today (IST) so they no longer appear in the list. Meds with no `end_date` (open-ended) keep showing.

### Changes

**`src/components/medications/MedicationList.tsx`**
- In `loadMeds`, after fetching from Supabase, apply a client-side filter using `getISTDateString()` from `@/lib/istTime`:
  - Keep med if `!med.end_date` OR `med.end_date > todayIST`.
- Equivalently, narrow at the query level with `.or('end_date.is.null,end_date.gt.<todayIST>')` for efficiency.
- Import `getISTDateString` (already used elsewhere in the project).

### Out of scope / unaffected
- `TodaySchedule`, alarms, refill, and other med-related views — only the Tablets list display is changed.
- Data is not deleted; expired meds remain in DB and reappear in history/reports as before.
- Editing an existing expired med via another path is not affected (this only hides from the list).

### Verification
1. Add a med with End Date = yesterday → save → Tablets tab should not list it after reload.
2. Add a med with End Date = tomorrow → still appears.
3. Add a med with no End Date → still appears.
4. Edit a listed med to set End Date = today → after save + reload, it disappears.