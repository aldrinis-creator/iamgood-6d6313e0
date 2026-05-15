# Plan: SEO Blog — 8 FAQ Posts Across 4 Topic Clusters

## Goal
Launch a public blog at `/blog` targeting the four winnable Semrush keyword clusters identified earlier (medication reminder app, elderly care app, senior safety app, emergency alert app). Each post answers a high-intent FAQ, ends with a "Get Check-iN free" CTA to `/register`, and is fully indexable.

## Posts (slug → target keyword → headline)

**Medication reminders**
1. `medication-reminder-app-india` — "medication reminder app" — *Best Medication Reminder App for Elderly Parents in India (2026 Guide)*
2. `how-to-never-miss-medication` — long-tail FAQ — *How to Make Sure Elderly Parents Never Miss Their Medication*

**Elderly care**
3. `elderly-care-app-features` — "elderly care app" — *What Does an Elderly Care App Actually Do? A Family Guide*
4. `caring-for-aging-parents-remotely` — long-tail — *Caring for Aging Parents from Another City: A Practical Playbook*

**Senior safety**
5. `senior-safety-app-guide` — "senior safety app" — *Senior Safety Apps: What to Look For (and What to Skip)*
6. `fall-detection-for-elderly` — long-tail — *Fall Detection for Elderly Parents: How It Works on a Phone*

**Emergency alerts**
7. `emergency-alert-app-for-seniors` — "emergency alert app" — *Emergency Alert Apps for Seniors: SOS Without a Pendant*
8. `what-to-do-in-medical-emergency-india` — long-tail — *What to Do in a Medical Emergency in India: First 10 Minutes*

Each post: ~900 words, H1 + 4–6 H2s, FAQ block at the bottom (rendered as `FAQPage` JSON-LD), single soft CTA card at the end linking to `/register`.

## Architecture

```
src/
  data/
    blogPosts.ts            ← typed array; title, slug, excerpt, keyword,
                              date, readTimeMin, sections[], faqs[]
  pages/
    Blog.tsx                ← /blog index — card grid, SeoMeta
    BlogPost.tsx            ← /blog/:slug — renders post by slug,
                              SeoMeta + Article + FAQPage JSON-LD,
                              CTA card to /register
  components/
    blog/
      BlogPostCard.tsx      ← card used on index
      BlogCTA.tsx           ← shared "Get Check-iN free" footer
```

Posts live as typed data (not MDX) — keeps the bundle small, no extra deps, content is a structured array of `{ heading, paragraphs[] }` sections plus an `faqs` array. Easy to extend later.

## Routing & navigation
- Add `/blog` and `/blog/:slug` routes in `src/App.tsx`, public (no auth guard), placed alongside `/help`, `/contact`.
- **No in-app link** (per user choice). Discoverable only via Google + direct URL. Optional: a small footer link on `/` only — leave out unless asked.

## SEO wiring
- Use existing `SeoMeta` component for title/description/canonical/og.
- `BlogPost.tsx` additionally injects two JSON-LD blocks via `<Helmet>`: `Article` (headline, datePublished, author=Check-iN) and `FAQPage` (question/answer pairs from the post's `faqs[]`).
- Update `scripts/generate-sitemap.ts` to add `/blog` and one entry per post slug (priority 0.7, changefreq monthly). Auto-runs on `predev`/`prebuild`.
- One H1 per post, semantic `<article>`, internal links between related posts (e.g. medication-reminder ↔ how-to-never-miss).

## CTA
Shared `BlogCTA` card at the bottom of every post: navy headline "Try Check-iN free", one-line value prop, `<Link to="/register">` primary button. No popups, no scroll interrupts.

## Out of scope
- No MDX/markdown pipeline, no CMS, no comments, no author profiles, no images (reduce noise; can add hero images later if requested).
- No changes to in-app navigation, dashboards, or any role-gated logic.
- No translation — English only (matches current site).

## Files to create
- `src/data/blogPosts.ts`
- `src/pages/Blog.tsx`
- `src/pages/BlogPost.tsx`
- `src/components/blog/BlogPostCard.tsx`
- `src/components/blog/BlogCTA.tsx`

## Files to edit
- `src/App.tsx` — register two routes
- `scripts/generate-sitemap.ts` — append blog entries
