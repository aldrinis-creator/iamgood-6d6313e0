

## Show Original Document Above Analysis Results

### What changes
When the Document Analyzer displays results, it will first show the original document (image, PDF page render, or extracted text) in a collapsible "Original Document" card, followed by the analysis below it. This gives users a side-by-side reference without losing context.

### Implementation

**File: `src/components/health-tools/DocumentAnalyzer.tsx`**

In the results view (lines 280-338), insert an "Original Document" section before the "Analysis Results" card:

1. **Preserve original data across the analysis flow** — the state variables `imagePreview`, `imageBase64`, `docFileName`, `extractedDocText`, and `textInput` are already retained when `result` is set. No state changes needed.

2. **Add an "Original Document" card** using a `Collapsible` component (already available via shadcn):
   - If `imagePreview` or `imageBase64` exists: render the image at full width in a scrollable container
   - If `docFileName` + `extractedDocText` exists: render the extracted text in a pre-formatted, scrollable block with the filename as a header
   - If `mode === "text"` and `textInput` exists: render the pasted text in a similar block
   - The card starts **expanded** so the original is immediately visible
   - User can collapse it to focus on the analysis

3. **Styling**: The original document card gets a neutral border with a `FileText` icon header, a max-height scroll area (~300px), and monospace font for extracted text to preserve formatting.

### Technical detail

```text
Results view layout:
┌──────────────────────────┐
│ ← Back                   │
├──────────────────────────┤
│ 📄 Original Document  ▼  │  ← Collapsible, starts open
│ ┌──────────────────────┐ │
│ │ [image / text / PDF] │ │  ← ScrollArea max-h-[300px]
│ └──────────────────────┘ │
├──────────────────────────┤
│ 🔍 Analysis Results      │  ← Existing analysis card
│ [VisualHealthReport or   │
│  ReactMarkdown]          │
│ [Share buttons]          │
├──────────────────────────┤
│ [Save to Vault]          │
│ ⚠️ Disclaimer            │
└──────────────────────────┘
```

### Files to modify
- `src/components/health-tools/DocumentAnalyzer.tsx` — add original document section in results view, import `Collapsible` and `ScrollArea`

