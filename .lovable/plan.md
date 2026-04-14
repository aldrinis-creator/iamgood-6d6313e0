

## Add Response Timestamp to Today's Check-iNs

### What changes

In `src/pages/GuardianDashboard.tsx`, the Today's Check-iNs list (lines 812-824) currently shows:
- Left: slot time label (e.g. "7:00 AM")
- Right: status badge ("Checked In" / "Missed" / "Pending")

**Change**: For check-ins with status `responded`/`ok`, append the actual `responded_at` timestamp formatted in IST next to the "Checked In" label — e.g. `"Checked In · 7:03 AM"`.

### Implementation

Modify the check-in row rendering (~line 814-822) to include the `responded_at` value:

```tsx
<div key={ci.id} className="flex items-center justify-between ...">
  <span className="text-sm">{formatCheckInTime(ci.scheduled_at)}</span>
  <span className={`text-xs px-2 py-1 rounded-full ${...}`}>
    {getStatusLabel(ci.status)}
    {(ci.status === "ok" || ci.status === "responded") && ci.responded_at && (
      <span className="ml-1 opacity-75">· {formatISTTime(ci.responded_at)}</span>
    )}
  </span>
</div>
```

The `todayCheckIns` data already includes all columns from the `check_ins` table (fetched with `select("*")`), so `responded_at` is available — no query changes needed.

### File to modify
- `src/pages/GuardianDashboard.tsx` — add `responded_at` display in the check-in row

