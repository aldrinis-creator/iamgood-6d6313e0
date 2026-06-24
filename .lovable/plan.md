# Branding Reference Package

Create a single source of truth designers can reference for Check-iN's colors and typography. Three deliverables under a new `branding/` folder at project root, plus one image asset.

## Deliverables

### 1. `branding/BRANDING.md` (markdown reference)
Human-readable doc covering:

- **Brand basics** — Product name "Check-iN", tagline, logo files (already at `public/Check-iN_Letterhead.png`, `public/pwa-512x512.png`, `public/favicon.ico`).
- **Color palette** — every semantic token from `src/index.css` documented with role, HSL, hex, and usage notes. Grouped:
  - Brand core: Primary Navy `hsl(213 53% 23%)` / `#1C3D5A`, Background `#FFFFFF`, Foreground (= Primary Navy).
  - Status/feedback: Success Emerald `hsl(134 63% 48%)` / `#2EC04A`, Warning Amber `hsl(38 92% 50%)` / `#F5A302`, Destructive / SOS Red `hsl(0 84% 60%)` / `#EF4444`.
  - Surfaces: Card, Popover, Secondary, Muted, Accent, Border, Input, Ring — each with token name + hex.
  - Dark mode variants — same table for `.dark` overrides (Primary flips to Emerald, surfaces darken to `hsl(213 53% 10%)` base).
- **Typography** — documents the current stack as-is (no custom font imported):
  - System sans-serif: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif` (used in `reportPdf.ts` / `whatsapp.ts`; browser default elsewhere).
  - Base size: **16px** body, **18px** minimum for elderly readability (Core rule).
  - Type scale derived from Tailwind classes actually used: H1 `text-2xl font-semibold` (cards), section titles `text-lg font-semibold`, body `text-base`, captions `text-sm`.
  - Weight palette: 400 / 500 / 600 / 700.
- **Spacing & radius** — `--radius: 0.75rem` (12px) with `lg / md / sm` variants; mobile-first max-width **430px**.
- **Iconography** — `lucide-react` is the only icon set; stroke 2px.
- **Usage rules** (mirrors Core memory):
  - Never use raw hex / `text-white` / `bg-black` in components — always semantic tokens.
  - Dark mode must work; test both.
  - SOS red is reserved for emergency UI only.

### 2. `branding/tokens.css` (developer/designer copy-paste reference)
Pure-CSS file mirroring `src/index.css` `:root` and `.dark` blocks, with comments naming each token's purpose and hex equivalent next to the HSL. Plain reference, not imported anywhere — designers can open it in Figma's CSS plugin or hand to a dev.

### 3. `branding/style-guide.png` (visual one-pager)
Generated via `imagegen` (premium tier, text legibility) — a single landscape PNG showing:

- Check-iN logo top-left, product name + tagline.
- Color swatch grid: large Primary Navy + Emerald + SOS Red tiles with hex/HSL labels; smaller row of surface/border tokens.
- Typography sample block: "Check-iN" display, "Section heading", body paragraph at 16px and 18px, caption — all in system sans-serif.
- Radius + spacing legend.

Saved to `branding/style-guide.png` (committed in repo, ~1600×1000).

## Out of scope
- No font installation or change.
- No edits to `src/index.css`, `tailwind.config.ts`, or any component.
- No new logo design — references existing logo assets.

## File tree after change
```text
branding/
  BRANDING.md
  tokens.css
  style-guide.png
```
