# Roadmap

## In progress
- Deep-scan security fixes (approved plan: 36 critical, 36 warnings, 5 batches)
  - Batch 1 done: signup role clamp, admin setup disabled, review-bypass lockout, secure random codes, coupon field allowlist, email-by-phone lookup closed
  - Batch 3 done: scheduler-only guards on 12 jobs, test-db deleted
  - Batch 4 partial: scan-card, sarvam-stt, extract-prescription require sign-in; product-assistant sanitized
  - Batch 2 partial: safe-zone alerts bound to accepted guardians, msg91-send internal-only, ambulance ward check, SOS emails validated, transactional email restricted
  - Batch 5 in progress: printout escaping (reportPdf done; MedicalVault, SOSDialog, MyProfile pending), CSV formula neutralization, log scrubbing
  - Remaining: typecheck, deploy all touched functions, verification calls, mark findings fixed

## New
- Update ORANGE_HEALTH_API_KEY secret with the new value the user provided (via update_secret secure form)
