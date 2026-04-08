

## Go-Live Readiness Assessment

### Status: NOT YET READY — 3 Critical Security Issues

The app is feature-complete, but the security scan found **3 error-level vulnerabilities** that must be fixed before launch. These are real attack vectors, not theoretical concerns.

---

### Critical Issues to Fix

**1. Emergency share tokens are publicly enumerable**
- The RLS policy on `emergency_share_tokens` lets anonymous users SELECT all active tokens — meaning anyone can discover every active emergency share and access linked health data.
- **Fix**: Tighten the USING clause so the caller must already know the token (e.g., `token = current_setting('request.headers')::json->>'x-share-token'` or filter by token value passed as a query parameter).

**2. Guardian nomination tokens exposed via emergency share**
- The anon policy on `guardians` for emergency shares returns `nomination_token`, `guardian_phone`, and `guardian_email`. An attacker could steal nomination tokens and fraudulently accept guardian invitations.
- **Fix**: Create a restrictive column list or a database view for emergency share reads that excludes `nomination_token`, `guardian_phone`, and `guardian_email`.

**3. Realtime channels have no authorization**
- Any authenticated user can subscribe to any Realtime channel (e.g., another user's notifications or journey updates).
- **Fix**: Add RLS policies on Realtime or use private channels with server-side token validation.

---

### Warnings (Should Fix, Not Blockers)

| Issue | Fix |
|-------|-----|
| 4 functions with mutable `search_path` | Add `SET search_path = 'public'` to `enqueue_email`, `read_email_batch`, `delete_email`, `move_to_dlq` |
| Leaked password protection disabled | Enable via auth configuration |
| OTP codes stored in plaintext | Hash OTP codes instead of storing raw values |

---

### What's Already Good

- All core features working (SOS, check-ins, medications, geofencing, journeys)
- Notification deduplication and 48-hour cleanup in place
- Role-based routing and feature gating functional
- Edge functions deployed and operational
- PWA with offline emergency profile caching
- Email infrastructure on custom domain

---

### Recommended Go-Live Plan

| Step | Action |
|------|--------|
| 1 | Fix the 3 critical RLS/security issues (migration + policy updates) |
| 2 | Fix the 4 `search_path` warnings |
| 3 | Enable leaked password protection |
| 4 | Run security scan again to confirm clean |
| 5 | Publish |

### Files to Modify

- 1 SQL migration to tighten `emergency_share_tokens`, `guardians` anon policies, and fix function search paths
- Auth configuration for leaked password protection
- No frontend code changes needed

Shall I proceed with these security fixes?

