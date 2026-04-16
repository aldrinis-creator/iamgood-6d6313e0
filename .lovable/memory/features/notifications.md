---
name: Notification and Popup Timing
description: Revised reminder timing model — T-5 notification, T+5/T+15/T+25 popups with deconfliction
type: feature
---

## Reminder Timing Model (April 2026)

All reminders (medications, check-ins, exercise, appointments) follow this pattern:

- **T-5 min**: Browser notification only (no popup, no audio)
- **T+0**: Event is due — no immediate action
- **T+5 min**: Popup overlay 1/3 with audio/voice
- **T+15 min**: Popup overlay 2/3
- **T+25 min**: Popup overlay 3/3 (final user reminder)
- **T+30+**: Escalation (guardian notification for meds/check-ins)

## Popup/Notification Deconfliction

`ReminderOverlay` exports `isOverlayVisible()` — a global flag.
All hooks check this before firing browser notifications or audio alerts.
If popup is already showing, audio/notifications are suppressed to prevent overlap.

## Ambulance Feature

Ambulance is ungated ("free" tier) — available to all plans with pay-per-use tariff.
