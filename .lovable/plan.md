# MSG91 template cleanup — no app changes needed

You'll delete the old template definitions inside the MSG91 console. The app doesn't need any code change for that, and nothing should be removed from the codebase.

## Templates the app actively sends — keep these in MSG91

| Template | Used by |
| --- | --- |
| `verification_otp` | WhatsApp OTP login/signup |
| `welcome_user` | Right after signup |
| `ward_missed_check_in` | Guardian missed check-in alert |
| `user_missed_checkin` | Ward's own missed check-in nudge |
| `guardian_medication_reminder` | Guardian missed-medication alert |
| `user_missed_medication` | Ward's own missed-medication nudge |
| `safe_zone` | Ward leaves safe zone (Guardian) |
| `safe_zone_return` | Ward returns to safe zone (Guardian) |
| `safe_zone_creation_user` | Ward creates a safe zone |
| SOS template | Emergency SOS dispatch to guardians |
| Pharmacy order template | Medication refill orders |
| Appointment share template | Sharing an appointment via WhatsApp |
| Ambulance request template | Ambulance booking |

Any MSG91 template not in this list is safe to delete on your side.

## Safe-delete note

Deleting a template in MSG91 only affects sending if a live function still references it. Since all references above are current, deleting the superseded older definitions (the pre-rename check-in / medication / safe-zone-return / OTP variants) will not break anything.

## Action in this app

None. No files change unless you later want a different template wired up.
