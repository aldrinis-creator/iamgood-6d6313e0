

## Add Date Display Above Check-In Heart

### What changes

Add a formatted date line (e.g. "Tuesday, April 14 2026") at the top of the `CheckInCard` component, displayed above the green heart in all states (paused, approaching, active, checked-in).

### Implementation

**File: `src/components/CheckInCard.tsx`**

1. Import `formatISTDayDate` or create an inline formatter using IST timezone to produce "weekday, month day year" format (e.g. "Tuesday, April 14 2026").

2. Inside the `<CardContent>` block (line 298), add a date string element before the conditional rendering block (before line 299):

```tsx
<p className="text-center text-sm font-medium text-muted-foreground mb-2">
  {new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Kolkata",
  })}
</p>
```

This renders consistently in IST across all check-in states, appearing as the first element inside the card above the heart.

### Files to modify
- `src/components/CheckInCard.tsx` — add date display at top of card content

