

## Plan — Re-publish to fix broken `index.html` on `iamgood.lovable.app`

### What's wrong

The live published HTML at `https://iamgood.lovable.app` is:

```html
<!DOCTYPE html><html lang="en"><body><div id="root"></div></body></html>
```

The entire `<head>` and the `<script type="module" src="/src/main.tsx"></script>` boot tag have been stripped. With no script, no React app ever loads — that's the white screen on iOS, Android, and desktop.

The **source** `index.html` is correct (verified: head + script present), and the deployment server is healthy (HTTP 200, assets dir reachable). This is a stale/corrupted publish artifact from the last "Update" — likely the publish step either ran an HTML-transform plugin that mis-handled the file, or shipped a partial output.

### Fix

1. **Click Publish → Update** in the Lovable editor. This re-runs the build with the current (correct) `index.html` and `vite.config.ts`, and re-uploads `dist/index.html` with the proper `<head>` + module script.
2. After the publish completes (~30 sec), I'll verify by fetching `https://iamgood.lovable.app/` and confirming the response contains:
   - `<title>Check-iN — Personal Emergency Response</title>`
   - `<script type="module" crossorigin src="/assets/index-*.js"></script>`
   - The `theme-color` and PWA meta tags
3. If the verify still shows a stripped HTML after re-publish, that confirms a Lovable infra issue and I'll escalate with the deployment ID `4f9b77fb-d645-41c2-9dff-72a88c059f10` and request a different approach (cache-bust via small no-op edit + republish, or History → restore last known good version).

### What I will NOT change

- No code changes to `index.html`, `vite.config.ts`, `main.tsx`, or any source file. They are already correct.
- No DB / RLS / edge function / feature changes.
- No new dependencies.

### Action you take

Click **Publish → Update** in the top-right. Then tell me "done" and I'll verify the live site loads.

