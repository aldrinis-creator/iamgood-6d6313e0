

## Plan — Add Date & Time Stamp to AQI Widget

Add a timestamp showing when the AQI data was last updated, displayed alongside the location name in the AQI widget popover.

### Changes to `src/components/AQIWidget.tsx`

**1. Add imports**
- Import `Clock` icon from `lucide-react`
- Import `formatISTDateTime` from `@/lib/istTime`

**2. Track fetch timestamp**
- Add `fetchedAt` state: `const [fetchedAt, setFetchedAt] = useState<Date | null>(null);`
- In `fetchEnvironmentData`, after successful data fetch, call `setFetchedAt(new Date())`

**3. Display timestamp in popover header**
- In the Header section (around line 295-301), add a new row below the location name showing:
  - Clock icon
  - "Updated: " label
  - Formatted timestamp using `formatISTDateTime(fetchedAt)`
- Style: `text-[10px] text-muted-foreground` with `flex items-center gap-1`

**4. Reset timestamp on location change**
- When `fetchDefaultLocation` or `fetchWardLocation` is called, clear `fetchedAt` to null so old timestamps don't persist during loading

### Visual result
The AQI popover header will show:
- Location name (e.g., "Current Location" or "Ward's Location")
- Below it: "Updated: 21 Apr 2025, 03:45 PM" with a small clock icon

### Files touched
- `src/components/AQIWidget.tsx`

