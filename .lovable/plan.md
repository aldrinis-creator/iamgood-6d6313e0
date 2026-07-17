# Auto-dismiss "Great to know you're Well!" bubble

After the user taps **Yes** to the "Are you OK?" prompt, the confirmation screen ("Great to know you're Well! Have a wonderful day!") in `src/components/CheckInDialog.tsx` currently stays open until manually closed. Make it auto-dismiss after 3 seconds.

## Change

In `src/components/CheckInDialog.tsx`, when `step === "well"` is rendered, start a 3-second timer that calls `onClose()` and clear it on unmount / step change to avoid leaks or double-close.

Implementation: add a `useEffect` guarded by `step === "well" && open`:

```tsx
useEffect(() => {
  if (!open || step !== "well") return;
  const t = setTimeout(() => onClose(), 3000);
  return () => clearTimeout(t);
}, [open, step, onClose]);
```

No other flows (`not-well`, `voice`, `ask`) change. No styling changes.
