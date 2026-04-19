## Goal

1. Build new **Tongue Analysis** AI tool (photo → coating, color, indicators, red flags)
2. Move **Urine Check** from Health Tools sub-list to top-level tile in My Health
3. Move **Services** off My Health tiles → place alongside My Profile (in profile dropdown menu)

## 1. Tongue Analysis — new feature

### Backend — `supabase/functions/health-tools/index.ts`

Add `tongue_analysis` task (vision, `google/gemini-2.5-flash`), returns strict JSON:

```json
{
  "image_quality": "good" | "poor",
  "tongue_detected": true,
  "color": "pink | pale | red | purple | bluish | other",
  "coating": "none | thin_white | thick_white | yellow | brown | black | patchy",
  "moisture": "moist | dry | excess_saliva",
  "shape": "normal | swollen | thin | scalloped",
  "surface": ["smooth" | "cracked" | "fissured" | "geographic" | "ulcer" | "spots"],
  "possible_indicators": [...],     // plain language (e.g. "white coating may suggest digestive imbalance or thrush")
  "red_flags": [...],               // e.g. "persistent ulcer >2 weeks", "black hairy tongue"
  "recommendations": [...],
  "see_doctor": "no" | "soon" | "urgent",
  "confidence": 0-100,
  "disclaimer": "..."
}
```

### Frontend — new `src/components/health-tools/TongueAnalysis.tsx`

Mirrors `UrineCheck` pattern:

- Photo tips banner ("Stick tongue out fully, daylight, no flash glare, plain background, mouth wide open")
- Camera/upload buttons → preview → Analyze
- Results render: tongue color swatch, coating badge, surface tags, indicators list, recommendations
- Red-flag alert (urgent/soon) using same 3-tier banner pattern as Urine Check
- Low-confidence + poor-quality warnings
- Save to Medical Vault (`record_type: "Lab Reports"`, image to `medical-documents` bucket)
- Share via `ReportShareButtons`
- Disclaimer footer

## 2. Restructure My Health tiles — `src/pages/MyHealth.tsx`

**Updated `healthTools` tile list** (remove Services, add Urine Check + Tongue Check):

```
Tablets · Health Tools · Ambulance · Activity · Wellness · Vitals · 
Nutrition · Face Scan · Urine Check · Tongue Check · Vault · Emergency First Aid
```

- Remove `Services` tile
- Add `{ icon: TestTube, label: "Urine Check", color: "bg-success/10 text-success" }`
- Add `{ icon: <new icon e.g. Smile or Sparkles>, label: "Tongue Check", color: "bg-primary/10 text-primary" }`
- Register both in `toolComponents` map (`UrineCheck`, `TongueAnalysis`)
- Remove `Urine Check` entry from `healthToolsSubItems` and `subToolComponents` (no longer under Health Tools)
- Keep `Pill Identifier` as a sub-tool (already lives in MedicationManager too)

## 3. Move Services next to My Profile

The cleanest minimal-change approach: add a **"Services"** entry to the user-profile dropdown menu in `src/components/AppHeader.tsx`, right above "My Profile". Clicking it routes the user to a new route `/services` (user role) which renders `HealthServices` inside `AppLayout`.

### Changes:

- `src/components/AppHeader.tsx` — add `<DropdownMenuItem onClick={() => navigate("/services")}>` with a `Wrench` icon, above the My Profile entry
- New page `src/pages/Services.tsx` — thin wrapper rendering `<AppLayout>` + `<HealthServices />` with a back-friendly heading
- `src/App.tsx` — register `/services` route inside `UserRoute`
- Guardian header already has its own Services page (`/guardian/services`) — leave untouched

## Files to create/edit

- **Create**: `src/components/health-tools/TongueAnalysis.tsx`
- **Create**: `src/pages/Services.tsx`
- **Create**: `.lovable/memory/features/tongue-analysis.md`
- **Edit**: `supabase/functions/health-tools/index.ts` (add `tongue_analysis` task)
- **Edit**: `src/pages/MyHealth.tsx` (tile list restructure)
- **Edit**: `src/components/AppHeader.tsx` (Services dropdown entry, user role only)
- **Edit**: `src/App.tsx` (new `/services` route)
- **Edit**: `.lovable/memory/index.md` (add tongue-analysis reference, note Services moved)

## UX safeguards (mandatory, same pattern as Urine Check)

- Disclaimer always visible
- `image_quality === "poor"` or `tongue_detected === false` → "Photo unclear, retake"
- `confidence < 50` → low-confidence info banner
- `see_doctor === "urgent"` → red destructive Alert
- `see_doctor === "soon"` → amber warning Alert

## Include the following:  
Guardian auto-alert on red-flag tongue findings