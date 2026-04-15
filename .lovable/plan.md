

## Fix Google Maps API Key Configuration

### Problem
`VITE_` prefixed variables are build-time environment variables and cannot be stored as Lovable Cloud runtime secrets. Runtime secrets are only accessible by backend edge functions, not the frontend.

### Solution
Google Maps API keys are **publishable keys** — they are designed to be exposed in client-side code and secured via domain/referrer restrictions in the Google Cloud Console. This is the same pattern used by all Google Maps implementations.

**Option chosen: Build Secret approach**

1. **You (the user) add a Build Secret**:
   - Go to **Workspace Settings → Build Secrets**
   - Add a secret named `VITE_GOOGLE_MAPS_API_KEY`
   - Paste your new Places API key as the value
   - This makes it available as `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` during build

2. **No code changes needed** — `src/lib/googleMaps.ts` already reads `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` from the previous update.

### Important
- Build Secrets are configured at the **workspace level** (not project level) in **Workspace Settings → Build Secrets**
- This is different from the Cloud → Secrets panel you were using
- After adding the build secret, trigger a new build for it to take effect

### Alternative (if Build Secrets feel complex)
I can update `src/lib/googleMaps.ts` to hardcode your new key directly. This is safe for publishable API keys — just share the key value with me.

### Files Modified
None — only a workspace-level build secret needs to be added by you.

