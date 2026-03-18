

## Create Shared LegalPageLayout Component

Both legal pages share identical structure: AppLayout wrapper, container with `px-4 py-6 space-y-6`, title (h1), "Last updated" date, and repeated sections with h2 + paragraph pairs.

### New file: `src/components/LegalPageLayout.tsx`
- Props: `title: string`, `sections: Array<{ heading: string; content: string }>`, optional `contactEmail?: string`
- Wraps content in `AppLayout` with the shared container div
- Renders the title, auto-generated "Last updated" date (en-IN locale), and maps over sections to render each with consistent h2/p styling

### Edit: `src/pages/PrivacyPolicy.tsx`
- Replace the full JSX with `<LegalPageLayout>` passing title and sections array

### Edit: `src/pages/TermsOfService.tsx`
- Same refactor, passing its own title and sections array

No visual changes -- purely a DRY refactor for maintainability.

