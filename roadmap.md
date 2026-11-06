# Roadmap

## Completed
- Deployed account, admin, invite, paid-tool and scheduled-job access protections; user-triggered missed-item checks are owner-scoped.
- Applied signup admin-escalation closure and atomic single-use OTP verification.
- Protected shared report HTML, CSV exports, search filters and saved pharmacy-order authorization.
- Nine frontend regression tests and one request-guard test passed; 43 function checks passed; preview build passed.
- Verified deployed anonymous requests are rejected by protected functions; no live SOS or message sent.
- ORANGE_HEALTH_API_KEY updated through the secure secret flow earlier.

## Outstanding
- MSG91 SOS delivery-webhook authentication: blocked by previously declined webhook secret configuration; leave existing delivery integration unchanged until an approved verification method is configured.
- Authenticated end-to-end verification: requesting user has no matching sign-in session; requires sign-in in the preview.
- Fresh deep rescan of saved changes: scanner only sees saved state, so start in the next turn; do not mark old findings fixed without fresh evidence.
- Frontend publication: requires explicit publication request; the saved-order pharmacy payload must be published with its updated function.
