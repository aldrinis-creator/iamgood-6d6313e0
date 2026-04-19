## Suggestion

Great call — this is exactly the right move. The current My Health grid has 12 tiles which is overwhelming on a 430px mobile screen, and the tools naturally cluster into two groups. Grouping them into "Quick Visual Checks" and "Activity Tracker" hubs will:

- Drop the main grid from **12 → 8 tiles** (3×3 minus one = much cleaner)
- Create discoverable "hubs" for related tools
- Set up the pattern for future bundles (e.g. Eye/Nail/Skin can join Visual Checks later)

One small refinement I'd suggest: rename **"Activity Tracker"** to **"Wellness Hub"** or **"Daily Wellness"** since it bundles Activity + Wellness + Nutrition (all three are daily lifestyle trackers, not just activity). But I'll go with your naming if you prefer.  
We go with **Wellness Hub**

---

## Plan

### 1. New hub component — `src/components/health-tools/QuickVisualChecks.tsx`

Sub-navigation page with 3 cards:

- **Urine Analysis** → renders existing `<UrineCheck />`
- **Tongue Analysis** → renders existing `<TongueAnalysis />`
- **Face Scan Analysis** → renders existing `<FaceScan />`

Pattern: same as the existing "Health Tools" sub-page in `MyHealth.tsx` — card list with icon + label + description, click opens the tool with a back button. Each sub-tool keeps its own freemium gate via `useFeatureGate`.

### 2. New hub component — `src/components/health-tools/ActivityTrackerHub.tsx`

Sub-navigation page with 3 cards:

- **Activity** → renders existing `<ActivityTracker />`
- **Wellness** → renders existing `<WellnessTracker />`
- **Nutrition** → renders existing `<NutritionAdvisor />`

Same pattern.

### 3. Restructure `src/pages/MyHealth.tsx`

**New `healthTools` tile list (8 tiles, 3×3 grid with 1 empty or 2×4):**

```
Tablets · Health Tools · Ambulance
Quick Visual Checks · Activity Tracker · Vitals
Vault · Emergency First Aid
```

Removed from top-level: Activity, Wellness, Nutrition, Face Scan, Urine Check, Tongue Check (6 tiles)
Added: Quick Visual Checks, Activity Tracker (2 tiles)

**Routing logic:** Extend the existing `selectedTool === "Health Tools"` sub-page pattern to also handle `"Quick Visual Checks"` and `"Activity Tracker"`. Each opens its own sub-page with a back button → tool selection cards → tool render.

**Deep-link support:** `useSearchParams` already handles `?tool=X`. Add support for the two new hub names so existing links to `?tool=Activity` etc. still work (route them through the hub).

### 4. Icons

- Quick Visual Checks → `Eye` or `ScanFace` (lucide-react)
- Wellness Hub → `HeartPulse` or `Activity`

### 5. Memory update

Update `mem://style/navigation-hierarchy` (or add a small note) documenting the new My Health hub structure so future changes respect this grouping.

---

## Files to create/edit

- **Create**: `src/components/health-tools/QuickVisualChecks.tsx`
- **Create**: `src/components/health-tools/ActivityTrackerHub.tsx`
- **Edit**: `src/pages/MyHealth.tsx` (tile restructure + sub-page routing for 2 new hubs)
- **Edit**: `.lovable/memory/style/navigation-hierarchy.md` (document new hub grouping)

## Out of scope

- Renaming "Activity Tracker" — will use your name unless you opt for "Wellness Hub"
- Combining the 3 visual checks into a single 3-photo guided wizard (good Phase 2 — would generate one combined report card)
- Adding more tools to either hub (Eye/Nail/Skin to Visual Checks; Sleep/Mindfulness to Activity)