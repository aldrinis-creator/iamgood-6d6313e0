

## Plan — Plan B: Restrict the Maps key in Google Cloud (no Build Secret needed)

Since Build Secrets aren't available in your workspace, we treat the Google Maps JS key as a **public, restricted browser key** — which is how Google designs Maps JS keys to be used. The leak only mattered because the old key may have been unrestricted. Once the new key is locked down, having it in the bundle is acceptable and standard practice.

### Step 1 — You: Rotate + restrict the key in Google Cloud Console

1. Google Cloud Console → **APIs & Services → Credentials**.
2. **Delete** the leaked key `AIzaSyBRtFaGdJzYpSjC8_0h6FdeJ0W8OqLjeFc`.
3. Click **Create credentials → API key** to generate a new one.
4. Click the new key → **Edit API key** and apply BOTH restrictions:

   **Application restrictions → Websites (HTTP referrers):**
   ```
   https://iamgood.lovable.app/*
   https://*.lovable.app/*
   https://*.lovable.dev/*
   http://localhost:*/*
   ```
   (Add any custom domain later when you set one up.)

   **API restrictions → Restrict key**, enable only:
   - Maps JavaScript API
   - Places API
   - Street View Static API
   - Geocoding API
   - Air Quality API (used by AQI widget)

5. Save. Copy the new key — you'll paste it into the codebase in Step 3.

### Step 2 — Me: Audit codebase for all hardcoded Google keys

Search and identify every `AIzaSy…` string. Known ones:
- `src/lib/googleMaps.ts` — Maps JS key (leaked one)
- `src/components/AQIWidget.tsx` — separate Air Quality key

I'll list all hits before changing anything so we know the full surface.

### Step 3 — Me: Replace old key with the new restricted key

Once you paste the new key into chat (safe to do AFTER it's restricted in Google Cloud — restrictions make the key unusable from any other domain):
- Replace the leaked key in `src/lib/googleMaps.ts`.
- Replace the AQI key in `src/components/AQIWidget.tsx` if you also want to rotate that one (recommended — same exposure model).
- Remove the `import.meta.env.VITE_GOOGLE_MAPS_API_KEY ||` fallback pattern since we're not using build-time injection.
- Add a code comment noting that this key is intentionally public and security is enforced via Google Cloud HTTP referrer + API restrictions.

### Step 4 — Verify

- Republish the app.
- Open Map My Journey, AQI widget, Street View — confirm they still load.
- Mark the GitHub secret-scanning alert as **Revoked** (since the old key is deleted, it no longer grants access).

### Why this is safe

A restricted Maps JS key in browser code is Google's official recommended pattern — see [Google's docs on API key best practices](https://developers.google.com/maps/api-security-best-practices). The HTTP referrer restriction means even if someone copies the key from your bundle, browsers will reject their requests because they're not on your domain. The API restriction caps the blast radius to only the Maps APIs.

### Files touched
- `src/lib/googleMaps.ts`
- `src/components/AQIWidget.tsx` (if you choose to rotate the AQI key too)

### What I need from you to proceed
After you finish Step 1 (rotate + restrict in Google Cloud), paste the new key here and confirm whether you want to also rotate the AQI key in `AQIWidget.tsx`.

