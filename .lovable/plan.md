

## Fix Text Wrapping in Appointment Cards

Several text elements in the appointment cards lack wrapping constraints, causing long titles, descriptions, and location text to overflow on narrow screens.

### Changes — `src/pages/Appointments.tsx`

1. **Title** (line 113): Add `break-words` to `<h3>` so long appointment titles wrap instead of overflowing
2. **Description** (line 139): Add `break-words` to the description `<p>`
3. **Location** (line 143): Add `break-words` to the location `<p>`
4. **Date/time line** (line 129): Add `flex-wrap` so the start/end date text wraps on small cards
5. **Card container**: Add `overflow-hidden` and `min-w-0` to the Card to enforce text containment

These are all single-class additions — no structural changes needed.

