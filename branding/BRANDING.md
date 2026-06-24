# Check-iN — Brand & Design Reference

A single source of truth for designers working on Check-iN. Mirrors the live design tokens defined in `src/index.css` and `tailwind.config.ts`. If this file and the code disagree, **the code wins** — please file a PR to update this doc.

---

## 1. Brand basics

- **Product name:** Check-iN
- **Tagline:** *Medication Reminder & Senior Safety App for India*
- **Maker:** Future Wave (`https://futurewave.in`)
- **Audience:** Indian seniors and their guardians — accessibility & legibility come first.

### Logo files (already in repo)

| File | Use |
|---|---|
| `public/Check-iN_Letterhead.png` | Reports, PDFs, letterhead |
| `public/Final_Check-iN_Letterhead.png` / `.pdf` | Print / formal docs |
| `public/pwa-512x512.png`, `public/pwa-192x192.png` | App icon (Android / iOS install) |
| `public/favicon.ico` | Browser tab |

---

## 2. Color palette

All colors are defined as **HSL** CSS variables and consumed through Tailwind semantic tokens. **Never hard-code hex or `text-white`/`bg-black` in components** — always use the semantic class (`bg-primary`, `text-foreground`, etc.).

### 2.1 Brand core (light mode)

| Token | Role | HSL | Hex | Notes |
|---|---|---|---|---|
| `--primary` | Brand navy, primary buttons & headings | `213 53% 23%` | `#1C3D5A` | Core Check-iN navy blue |
| `--primary-foreground` | Text on primary | `0 0% 100%` | `#FFFFFF` | |
| `--background` | App background | `0 0% 100%` | `#FFFFFF` | |
| `--foreground` | Default text | `213 53% 23%` | `#1C3D5A` | Same as primary navy |
| `--ring` | Focus ring | `213 53% 23%` | `#1C3D5A` | |

### 2.2 Status / feedback

| Token | Role | HSL | Hex | When to use |
|---|---|---|---|---|
| `--success` | Success state | `134 63% 48%` | `#2EC04A` | Confirmed check-ins, healthy vitals |
| `--success-foreground` | Text on success | `0 0% 100%` | `#FFFFFF` | |
| `--warning` | Warnings | `38 92% 50%` | `#F5A302` | Missed reminders, low battery hints |
| `--warning-foreground` | Text on warning | `0 0% 100%` | `#FFFFFF` | |
| `--destructive` | Destructive actions | `0 84% 60%` | `#EF4444` | Delete confirmations |
| `--destructive-foreground` | Text on destructive | `0 0% 100%` | `#FFFFFF` | |
| `--sos` | **SOS / emergency only** | `0 84% 60%` | `#EF4444` | Reserved for SOS button, fall-detection, active emergency overlays. Do not reuse for normal delete or error states. |
| `--sos-foreground` | Text on SOS | `0 0% 100%` | `#FFFFFF` | |

### 2.3 Surfaces & chrome (light mode)

| Token | HSL | Hex |
|---|---|---|
| `--card` | `0 0% 100%` | `#FFFFFF` |
| `--card-foreground` | `213 53% 23%` | `#1C3D5A` |
| `--popover` | `0 0% 100%` | `#FFFFFF` |
| `--popover-foreground` | `213 53% 23%` | `#1C3D5A` |
| `--secondary` | `210 40% 96%` | `#F1F5F9` |
| `--secondary-foreground` | `213 53% 23%` | `#1C3D5A` |
| `--muted` | `210 40% 96%` | `#F1F5F9` |
| `--muted-foreground` | `215 16% 47%` | `#64748B` |
| `--accent` | `210 40% 96%` | `#F1F5F9` |
| `--accent-foreground` | `213 53% 23%` | `#1C3D5A` |
| `--border` | `214 32% 91%` | `#E2E8F0` |
| `--input` | `214 32% 91%` | `#E2E8F0` |

### 2.4 Dark mode overrides

Dark mode flips **primary to emerald green** to keep the calming navy out of glare-free environments.

| Token | HSL | Hex |
|---|---|---|
| `--background` | `213 53% 10%` | `#0C1E30` |
| `--foreground` | `210 40% 96%` | `#F1F5F9` |
| `--card` | `213 53% 14%` | `#112A42` |
| `--popover` | `213 53% 14%` | `#112A42` |
| `--primary` | `134 63% 48%` | `#2EC04A` (emerald) |
| `--primary-foreground` | `0 0% 100%` | `#FFFFFF` |
| `--secondary` / `--muted` / `--accent` | `213 40% 20%` | `#1E3A55` |
| `--muted-foreground` | `215 20% 65%` | `#94A3B8` |
| `--destructive` | `0 63% 31%` | `#822323` |
| `--success`, `--sos`, `--warning` | unchanged from light | — |
| `--border`, `--input` | `213 32% 20%` | `#22425E` |
| `--ring` | `213 27% 84%` | `#CBD5E1` |

---

## 3. Typography

Check-iN ships **no custom webfont** by design — we rely on the operating system's native UI font for fastest paint and best legibility on every device a senior might use.

### 3.1 Font stack

```
-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif
```

This is the stack used in generated PDFs (`src/lib/reportPdf.ts`) and WhatsApp share pages (`src/lib/whatsapp.ts`). The browser default in the app resolves to the same system font on every supported platform (iOS → SF Pro, Android → Roboto, Windows → Segoe UI).

> **Designers:** when mocking in Figma, use **SF Pro Text** (iOS) or **Roboto** (Android) — they are the two real-world renderings.

### 3.2 Base size & accessibility

- **Body base:** `16px` (`body { font-size: 16px }` in `src/index.css`).
- **Minimum readable size:** **18px** for any user-facing content (Core accessibility rule — elderly readability).
- Use the `.text-accessible` utility (`@apply text-lg` → 18px) for primary content blocks.

### 3.3 Type scale (Tailwind classes in use)

| Role | Tailwind | Size / weight |
|---|---|---|
| Card / dialog title | `text-2xl font-semibold tracking-tight` | 24px / 600 |
| Section heading | `text-lg font-semibold` | 18px / 600 |
| Body | `text-base` | 16px / 400 |
| Caption / helper | `text-sm` | 14px / 400 |
| Micro label | `text-xs` | 12px / 500 — use sparingly, never for content |

### 3.4 Weight palette

`400` regular · `500` medium · `600` semibold · `700` bold. Avoid `800/900` — system fonts render them inconsistently.

---

## 4. Spacing, radius & layout

- **Border radius:** `--radius: 0.75rem` (12px)
  - `rounded-lg` → 12px · `rounded-md` → 10px · `rounded-sm` → 8px
- **Mobile-first max width:** **430px** (Core constraint — design and review at this width).
- **Container padding:** `2rem` (32px) at `2xl` breakpoint, `1rem` (16px) on mobile.
- **Cell / button padding:** keep ≥ `py-3` (12px) on tappable elements so seniors can hit targets comfortably.

---

## 5. Iconography

- **Library:** [`lucide-react`](https://lucide.dev) — the **only** icon set in the app.
- **Default size:** 20–24px in UI, 32–48px on hero / feature tiles.
- **Stroke width:** 2 (Lucide default). Do not mix outline + filled icon sets.

---

## 6. Motion

Custom animations defined in `src/index.css` and `tailwind.config.ts`:

| Class | Purpose | Duration |
|---|---|---|
| `animate-pulse-heart` | Check-in heart | 1.2s ease-in-out infinite |
| `animate-sos-pulse` | Active SOS ring | 1.5s ease-in-out infinite |
| `animate-flash-red` | Critical alert background | 1s infinite |
| `animate-accordion-down` / `-up` | Radix accordion | 0.2s ease-out |

Respect `prefers-reduced-motion` — the `.a11y-pause-animations` utility pauses everything.

---

## 7. Usage rules (non-negotiable)

1. **Always use semantic tokens.** Never `text-white`, `bg-black`, `bg-[#xxx]`, or raw hex inside components — they break dark mode and theming.
2. **SOS red is reserved.** Only emergency UI (SOS button, fall overlay, active SOS bar) may use `--sos`. Use `--destructive` for delete / dangerous actions.
3. **Test both themes.** Every new screen must be reviewed in light **and** dark mode.
4. **Mobile-first, max 430px.** Layouts wider than that are out of scope.
5. **Minimum 18px** for any text a senior reads. Captions can drop to 14px only for metadata.
6. **One icon set.** Lucide only.
7. **Destructive actions need an `AlertDialog`.** No silent deletes.

---

## 8. Companion files

- [`tokens.css`](./tokens.css) — copy-paste-ready CSS variables for designers and Figma plugins.
- [`style-guide.png`](./style-guide.png) — one-page visual reference (color swatches + typography sample).
