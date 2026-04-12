

## Retain Dismiss Button + Fix Medication Navigation

### Changes to `src/components/ReminderOverlay.tsx`

1. **Re-add Dismiss button** — A secondary "Dismiss" button below the action button. Clicking it closes the overlay early (non-acknowledgment), so the auto-repeat cycle continues at 5-min intervals. It calls `dismiss(false)` and also schedules the next repeat if under max shows.

2. **Fix "View Medications" navigation** — Currently navigates to `/my-health` which shows the health tools grid, not the medications page directly. Change to `/my-health?tool=Tablets` so the `MyHealth` component auto-opens the `MedicationManager` via its existing `useSearchParams` logic (lines 78-82 of `MyHealth.tsx` already handle `?tool=` param).

### Implementation details

**Dismiss button behavior:**
- Clears the auto-dismiss timer
- Hides overlay with animation
- Schedules next repeat at 5-min interval (same as auto-dismiss behavior) if show count < MAX_SHOWS
- Does NOT mark as acknowledged — cycle continues

**Navigation fix:**
```typescript
// Before
window.location.href = "/my-health";

// After  
window.location.href = "/my-health?tool=Tablets";
```

### Single file modified
| File | Change |
|------|--------|
| `src/components/ReminderOverlay.tsx` | Add Dismiss button with `handleDismiss`, update medication navigation to `/my-health?tool=Tablets` |

