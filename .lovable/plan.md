# Fix: Hardcode Google Maps API Key in Code

## Problem

Build secrets are difficult to configure, and `VITE_` environment variables aren't available at runtime without them.

## Solution

Since Google Maps API keys are **publishable** client-side keys (secured via HTTP referrer restrictions in Google Cloud Console, not by being secret), we can safely embed the key directly in the code.

### Steps

1. **You provide the API key** in chat (it's safe — it's a publishable key, like a Stripe publishable key)
2. **Update `src/lib/googleMaps.ts**` to use the hardcoded key instead of `import.meta.env.VITE_GOOGLE_MAPS_API_KEY`

### File Changed


| File                    | Change                                                                        |
| ----------------------- | ----------------------------------------------------------------------------- |
| `src/lib/googleMaps.ts` | Replace `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` with the actual key string |


### Security Note

This is standard practice for Google Maps — the key is always exposed in the browser's network requests anyway. Security is enforced by restricting the key to your domain in the Google Cloud Console (APIs & Services → Credentials → your key → Application restrictions → HTTP referrers).

## Next Step

Please paste your Google Maps API key here so I can add it to the code. AIzaSyDCeS7oubdcbYDt46e1vXeP3vrfLJGaOCw