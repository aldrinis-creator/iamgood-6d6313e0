

## Add Visual Health Analysis Display to Health Tools

### What changes

Currently, all health tool results (Document Analyzer, Vitals Insights, Doctor Visit Report, Symptom Checker) render AI responses as raw markdown text. The user wants structured, visual analysis cards inspired by Apollo 24|7 Smart Reports — with body system categories, status badges (Ideal Health / Needs Monitoring), colored progress bars, and numbered next steps.

### Approach

**Two-part change: structured AI output + visual renderer component.**

#### 1. New shared component: `src/components/health-tools/VisualHealthReport.tsx`

A reusable component that accepts structured health analysis data and renders it visually:

- **System/Category Cards** — Each health category (Heart Health, Blood Glucose, Kidney Health, etc.) gets a card with:
  - Icon (mapped from category name)
  - Status badge: "IDEAL HEALTH" (green), "NEEDS MONITORING" (orange), "AT RISK" (red)
  - Color-coded progress bar showing health level
  - Date stamp
  - Key findings as bullet points
- **Next Steps Section** — Numbered action items with descriptions
- **Tests Overview** — Shows which parameters were found vs missing with checkmark/X indicators
- **Disclaimer footer** — Standard medical disclaimer

The component accepts this TypeScript interface:
```typescript
interface HealthCategory {
  name: string;
  status: "ideal" | "monitoring" | "at_risk";
  score: number; // 0-100
  findings: string[];
  tests_found: string[];
  tests_missing: string[];
}
interface VisualReport {
  categories: HealthCategory[];
  next_steps: string[];
  summary: string;
}
```

If the AI response can be parsed as this JSON structure, render visually. Otherwise, fall back to the existing `ReactMarkdown` display. This ensures backward compatibility.

#### 2. Update edge function system prompts

Modify `document_analysis` and `vitals_insights` prompts in `supabase/functions/health-tools/index.ts` to request a structured JSON response with the `VisualReport` schema above. Add a new prompt variant or append to existing prompts asking the AI to return JSON when analyzing lab reports or health data.

For `document_analysis` specifically (most relevant for lab reports like in the screenshots):
- When the document is a lab report, return structured JSON with body system categories
- For other document types (prescriptions, doctor's notes), continue returning markdown

The prompt will instruct: "If the document is a lab/diagnostic report, respond with JSON matching this schema: {...}. For all other document types, respond with markdown."

#### 3. Update result rendering in these components

| Component | Change |
|-----------|--------|
| `DocumentAnalyzer.tsx` | Try parsing result as JSON → render `VisualHealthReport` if valid, else `ReactMarkdown` |
| `VitalsMonitor.tsx` (AI Insights) | Same JSON-first rendering with fallback |
| `DoctorVisitReport.tsx` | Same pattern |
| `SymptomChecker.tsx` | Keep as markdown (chat-based, not report-style) |
| `WardVitalsSummary.tsx` | Same JSON-first rendering |

#### 4. Category icon mapping

Map category names to appropriate lucide icons:
- Heart Health → Heart
- Blood Glucose → Droplet
- Kidney Health → Bean-shaped icon (Activity)
- Liver / GI → Pill
- Bone & Muscle → Bone
- Vitamins → Pill
- Hormones → Zap
- Skin & Hair → Sparkles
- Blood Health → Droplets
- General → Stethoscope

### Files to create/modify

| File | Change |
|------|--------|
| `src/components/health-tools/VisualHealthReport.tsx` | **New** — visual report renderer |
| `supabase/functions/health-tools/index.ts` | Update `document_analysis` and `vitals_insights` prompts for structured JSON |
| `src/components/health-tools/DocumentAnalyzer.tsx` | Parse JSON, render `VisualHealthReport` or fallback |
| `src/components/health-tools/DoctorVisitReport.tsx` | Same pattern |
| `src/components/VitalsMonitor.tsx` | Same pattern for AI insights section |
| `src/components/WardVitalsSummary.tsx` | Same pattern |

### No database changes needed

