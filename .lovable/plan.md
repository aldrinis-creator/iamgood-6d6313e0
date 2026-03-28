

# Fix: Google Maps API Key Not Available to Client

## Problem
`VITE_GOOGLE_MAPS_API_KEY` was added as a **runtime secret**, which is only accessible to backend functions. The client-side code in `src/lib/googleMaps.ts` reads it via `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`, which is undefined at build time.

## Solution
Since Google Maps API keys are **publishable** (public, restricted by HTTP referrer — not private), the correct approach is to move this key into a **build secret** so it gets injected as a `VITE_` environment variable during the build.

### Steps

1. **User action required**: Go to **Workspace Settings → Build Secrets** and add `VITE_GOOGLE_MAPS_API_KEY` with the same API key value. This makes it available to `import.meta.env` during the Vite build.

2. **No code changes needed** — `src/lib/googleMaps.ts` already reads `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` correctly.

3. After adding the build secret, trigger a rebuild (e.g., make any small edit or re-deploy) for the variable to take effect.

## Why This Happened
Runtime secrets (added via the secrets tool) are injected into edge functions only. Client-side `VITE_` variables must be configured as **build secrets** at the workspace level so Vite can embed them during compilation.

