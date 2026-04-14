

## Increase Green Heart Size After Check-In

### Change

In `src/components/CheckInCard.tsx`, the checked-in success state (green heart) currently uses:
- Container: `w-24 h-24` (96px)
- Heart icon: `w-12 h-12` (48px)

**Increase to:**
- Container: `w-32 h-32` (128px) 
- Heart icon: `w-20 h-20` (80px)

This ensures the heart is visually prominent and well above 1.5cm on standard displays.

### File to modify
- `src/components/CheckInCard.tsx` — lines 330-337 (checked-in state JSX)

