# Plan: A (Drug References) + C (Offline First Aid)

Dropping B (MedlinePlus). Shipping A and C only.

---

## A. Medication Info — openFDA + RxNorm citations

**New edge function:** `supabase/functions/drug-references/index.ts` (`verify_jwt = false`, add to `config.toml`)
- Input: `{ drug: string }` (Zod-validated, 1–100 chars)
- Parallel fetch:
  - RxNorm: `https://rxnav.nlm.nih.gov/REST/rxcui.json?name={drug}` → normalized name + RxCUI
  - openFDA: `https://api.fda.gov/drug/label.json?search=openfda.generic_name:{drug}+openfda.brand_name:{drug}&limit=1`
- Return shape:
  ```ts
  {
    rxnorm: { rxcui: string, name: string } | null,
    fda: {
      brand_name?: string,
      generic_name?: string,
      indications_and_usage?: string,
      dosage_and_administration?: string,
      warnings?: string,
      adverse_reactions?: string,
      contraindications?: string,
      pregnancy?: string,
      manufacturer?: string,
      effective_time?: string,
    } | null,
    sources: { rxnorm_url, fda_url }
  }
  ```
- Both APIs are free, keyless, public. Soft-fail per source (one missing ≠ overall failure). 8s timeout each via `AbortController`.

**Client:** `src/components/health-tools/MedicationInfo.tsx`
- In the Drug Search tab, after Gemini result resolves, fire `supabase.functions.invoke("drug-references", { body: { drug } })` in parallel.
- New "Verified Sources" card below the Gemini summary:
  - Header: "FDA Label & RxNorm" with small NIH/FDA badges
  - 5 collapsible (`@/components/ui/collapsible`) sections: Indications, Dosage, Warnings, Adverse Reactions, Contraindications
  - Each truncated to ~600 chars with "Read more" expanding to full text
  - Footer: "Sources: openFDA, NLM RxNorm" + last-updated date from `effective_time`
- Disclaimer line: "FDA labeling reflects US drug approvals. For India-specific approval/ban status, see the Banned Drugs check."
- Loading state: skeleton card while fetching. Hide card entirely if both sources return null.

**Save to Vault:** Append a "Verified Sources" markdown block (RxCUI, FDA fields, source URLs) to the saved `medical_records.description`.

---

## C. Emergency First Aid — true offline reliability

**Data extraction:** `src/data/firstAidGuides.ts`
- Move existing 6 guides out of `EmergencyFirstAid.tsx`.
- Expand to 15 scenarios. New: Choking (adult/child), Stroke (FAST), Seizure, Drowning, Snake bite, Heat stroke, Hypothermia, Fracture/sprain (RICE), Diabetic emergency (hypo/hyper).
- Schema: `{ id, title, icon, color, steps[], whenToCall112: string[], doNot: string[] }`
- Content sourced from Indian Red Cross / St John Ambulance / AIIMS guidelines (human-curated, no AI generation).

**Component:** `src/components/health-tools/EmergencyFirstAid.tsx`
- Render expanded grid from `firstAidGuides.ts`.
- Each expanded guide adds "When to call 112" (red box) and "Do NOT" (yellow box) sections.
- Per-guide "Save as PDF" button using existing `src/lib/reportPdf.ts` (`printReport`).
- Offline indicator pill at top: green "Available offline ✓" when `navigator.onLine === true && SW ready`, gray "Cached" when offline.
- Prominent sticky 112 call button (existing pattern, keep).
- Search/filter input at top for quick lookup.

**Service worker:** `src/sw.ts`
- Add `firstAidGuides` chunk to precache list (well under 3MB budget — pure text).
- Ensure `/emergency-first-aid` route shell + JS chunk are in the precache manifest via existing Workbox config.
- Verify offline by toggling DevTools offline + reloading.

**No backend, no APIs, no AI, no DB changes.**

---

## Out of scope
- MedlinePlus integration (dropped per user).
- India-specific drug regulator API (CDSCO has no public API — existing Gemini `banned_check` flow handles this).
- Push notifications, new tables, RLS changes.

## Files touched
- New: `supabase/functions/drug-references/index.ts`
- New: `src/data/firstAidGuides.ts`
- Edit: `supabase/config.toml` (register new function)
- Edit: `src/components/health-tools/MedicationInfo.tsx`
- Edit: `src/components/health-tools/EmergencyFirstAid.tsx`
- Edit: `src/sw.ts` (precache entries)