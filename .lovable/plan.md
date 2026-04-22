

## Diagnosis — Why no WhatsApp/SMS arrived

I checked Supabase edge logs: **`send-sos-alert` was never invoked** in this session. The MSG91 wiring is correct; the function simply wasn't called.

### Root cause

In `SOSDialog.tsx` (line 243-248), `sendAlerts()` only fires when the **30-second countdown reaches 0**. If the user:
- Closed the dialog early
- Cancelled before 0
- Or only saw the floating SOS bubble but never opened the dialog

…then no edge function call is made → no WhatsApp, no email, no push.

The countdown was added as a "safety cancel window," but it conflicts with the user's expectation that **pressing SOS = alerts go out immediately**.

### Secondary gap

`AppContext.triggerSOS()` (called by Fall Detection and other auto-triggers) inserts into `sos_events` but **never invokes `send-sos-alert`** itself. Only `SOSDialog` and `FallDetectionOverlay` invoke the edge function. So any code path that calls `triggerSOS()` directly without the dialog will also silently fail to send WhatsApp.

---

## Plan — Two fixes

### 1. Reduce SOSDialog countdown + add manual "Send Now" button
- Drop countdown from **30s → 10s** (matches industry standard for emergency apps)
- Add a prominent **"Send SOS Now"** button inside the dialog that bypasses the countdown and calls `sendAlerts()` immediately
- Keep the "Cancel" button as-is

### 2. Make `triggerSOS()` self-sufficient
- After inserting into `sos_events`, `AppContext.triggerSOS()` will also invoke `send-sos-alert` with the current user's name + guardian list
- Add a guard (`hasInvokedRef`) so the same SOS event isn't double-sent if the dialog also fires
- This guarantees that **any** SOS path (manual button, fall detection, voice, journey auto-SOS) sends WhatsApp

### 3. Verification
- After deploy, trigger SOS once and check edge logs for `[send-sos-alert] MSG91 WA response` → confirms the call reached MSG91 with `request_id`

### Files modified
- `src/components/SOSDialog.tsx` — countdown 30→10, add "Send Now" button
- `src/contexts/AppContext.tsx` — `triggerSOS()` invokes `send-sos-alert` after inserting event, with dedupe guard

### What you do
1. Approve this plan
2. After deploy, press SOS in the app and wait. WhatsApp should arrive on guardian phones within ~5 seconds.

