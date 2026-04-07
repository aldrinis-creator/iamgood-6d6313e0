

## Add Reasoning Effort Levels to Health-Tools Edge Function

Enhance AI accuracy for complex medical queries by adding reasoning effort configuration per task type.

### Design

Map each `type` to an appropriate reasoning effort level and model tier:

| Type | Model | Reasoning Effort | Rationale |
|------|-------|-------------------|-----------|
| `symptom_check` | `google/gemini-3.1-pro-preview` | `high` | Complex differential diagnosis |
| `vitals_insights` | `google/gemini-3.1-pro-preview` | `high` | Pattern detection across multiple data streams |
| `doctor_report` | `google/gemini-3.1-pro-preview` | `medium` | Structured report, moderate complexity |
| `document_analysis` | `google/gemini-3-flash-preview` | `medium` | Extract + interpret values |
| `medication_info` | `google/gemini-3-flash-preview` | `medium` | Drug info + interaction checks |
| `prescription_scan` | `google/gemini-3-flash-preview` | `medium` | Structured JSON extraction |
| `banned_check` | `google/gemini-2.5-flash-lite` | `low` | Simple classification |
| `face_analysis` | `google/gemini-2.5-flash` | `low` | Vision analysis, straightforward |

### Change — `supabase/functions/health-tools/index.ts`

1. Add a `taskConfig` map defining `model` and `reasoning` effort per type
2. Replace the hardcoded model selection with config-driven lookup
3. Add `reasoning: { effort }` to the AI gateway request body when effort is set
4. Keep vision model override for image payloads (use `google/gemini-2.5-flash` for vision tasks)

This is a single-file change to the edge function — no client-side changes needed.

