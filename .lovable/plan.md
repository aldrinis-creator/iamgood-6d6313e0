

# Fix "Save to Medical Vault" — Failed to Save

## Root Cause
The `saveToVault` functions in `DocumentAnalyzer.tsx`, `PrescriptionScanner.tsx`, and `VitalsMonitor.tsx` catch errors silently (`catch { toast.error("Failed to save") }`) without logging. The likely causes:

1. **Session retrieval issue**: `DocumentAnalyzer` and `PrescriptionScanner` call `supabase.auth.getSession()` inline instead of using the `useAuth()` context that's already available. If session returns null transiently, the insert fails.
2. **Description too long**: AI-generated analysis can be very long. If Postgres has a text limit or the payload exceeds Supabase REST API limits, the insert fails silently.
3. **No error details shown**: The catch blocks don't log the actual error, making debugging impossible.

## Changes

### 1. `src/components/health-tools/DocumentAnalyzer.tsx`
- Import and use `useAuth()` for session instead of calling `getSession()` inline
- Add `console.error` in catch block to log actual error
- Truncate `description` to 50,000 chars as safety net
- Show error details in toast when available

### 2. `src/components/medications/PrescriptionScanner.tsx`
- `SaveToVaultButton`: Pass session from parent or use `useAuth()` instead of inline `getSession()`
- Add error logging in catch
- Truncate description

### 3. `src/components/VitalsMonitor.tsx`
- Same: add error logging, truncate description

### 4. All three files
- Change `catch {` to `catch (err) { console.error("Vault save error:", err);` so errors are visible in logs
- Show `err.message` in toast for user visibility

## Files Modified

| File | Change |
|------|--------|
| `src/components/health-tools/DocumentAnalyzer.tsx` | Use `useAuth()`, log errors, truncate |
| `src/components/medications/PrescriptionScanner.tsx` | Use `useAuth()`, log errors, truncate |
| `src/components/VitalsMonitor.tsx` | Log errors, truncate |

