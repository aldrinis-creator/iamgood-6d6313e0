
## Plan — Fix the runtime crash that is blanking the whole app

### What’s actually broken
The app is no longer failing at publish time. The published site now serves valid HTML, CSS, manifest, and JS assets.

The current blocker is a **runtime JavaScript crash** on first load:

```text
ReferenceError: Cannot access 'A' before initialization
at /assets/vendor-charts-*.js
```

That means the browser downloads the app successfully, then crashes while evaluating the shared chart bundle, which leaves a white screen on iOS, Android, and desktop.

### Why this happens
Two things combine here:

1. **Chart code is loaded eagerly at app startup**
   - `App.tsx` imports route pages like `UserDashboard`, `GuardianDashboard`, `MyHealth`, etc. directly.
   - Those pages pull in multiple `recharts`-based components.
   - So the chart bundle is evaluated even when the user is only visiting `/`.

2. **The current `recharts` version is vulnerable to a circular-dependency initialization bug**
   - Current package: `recharts@2.15.4`
   - The browser error pattern matches a known Recharts circular import / “cannot access before initialization” issue fixed in later releases.

### Implementation steps

1. **Make chart-heavy routes lazy-loaded**
   - Convert the major authenticated/chart-bearing pages in `src/App.tsx` from static imports to `lazy(() => import(...))`.
   - At minimum: `UserDashboard`, `GuardianDashboard`, `GuardianReports`, `MyHealth`, and any other route that currently pulls chart components into the initial bundle.
   - Keep the public landing/login/register/install routes lightweight so `/` can render without touching charts.

2. **Upgrade `recharts` to a version with the circular-dependency fix**
   - Update `recharts` from `2.15.4` to a newer stable release that includes the fix.
   - Rebuild lockfiles as needed.

3. **Check for any small compatibility breaks**
   - Review chart components that import from `recharts`, especially:
     - `src/components/ui/chart.tsx`
     - `src/components/HealthPassportTrend.tsx`
     - `src/components/WardActivitySummary.tsx`
     - `src/components/WardMedicationAdherence.tsx`
     - `src/components/WardVitalsSummary.tsx`
     - `src/components/NutritionTrendChart.tsx`
     - `src/pages/GuardianReports.tsx`
   - Adjust only if the upgraded package changes import or prop behavior.

4. **Verify both preview and published behavior**
   - Confirm `/` loads without a blank screen.
   - Confirm console no longer throws the `vendor-charts` initialization error.
   - Smoke-test at least:
     - landing page
     - login/register
     - one user dashboard route
     - one guardian/report route with charts

5. **Republish after the frontend fix**
   - Once preview is healthy, trigger Publish → Update so the live site gets the corrected JS bundle.

### Expected result
- The home page and auth pages load again everywhere.
- Chart code no longer crashes the whole app on startup.
- If a chart issue remains in one specific screen, it is isolated to that route instead of taking down the entire application.

### What I will not change
- No database schema, RLS, auth, or backend-function changes
- No PWA manifest/service-worker redesign unless a separate issue appears
- No redesign of the app’s UI or route structure beyond lazy-loading

### Technical notes
- Published site currently returns valid HTML and asset requests succeed; this is not the earlier broken-`index.html` issue anymore.
- The strongest current signal is the browser runtime error inside `vendor-charts`.
- Lazy-loading routes is a resilience fix.
- Upgrading `recharts` is the primary bug fix.
