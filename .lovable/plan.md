

## Plan — Polish the Premium Plus Smart Ring card

Single-file change to `src/pages/Subscription.tsx`, Premium Plus block (lines ~523-572).

### 1. Remove white background behind the ring + add gloss

- Drop the white radial glow (`bg-gradient-radial from-white/40 …`) and the white inner border ring. Let the ring sit directly on the navy card.
- Add a subtle **gloss highlight** on the ring image itself:
  - Wrap `<img>` in a relative container.
  - Overlay a top-left diagonal highlight: a small absolutely-positioned `div` with `bg-gradient-to-br from-white/40 via-white/0 to-transparent` clipped to a circle, `mix-blend-overlay`, sitting above the image.
  - Add a soft outer rim shadow via `drop-shadow-[0_0_18px_rgba(255,255,255,0.25)]` on the image for premium sheen (no white plate).
- Keep `Coming Soon` badge in top-right.

### 2. Add asterisk to "Tracking" + footnote under Notify Me

- In the caption (line 541) change the trailing word to `…24×7 mobile / satellite Tracking*`.
- Add a new line **below** the "We'll notify you when the Smart Ring is available" paragraph:
  - `* Data charges as applicable after Year 1.` — same `text-[10px] opacity-70 text-center` styling.

### 3. Add "Special Offer" label above "Pre-Register Now"

- Insert above the `<h3>Pre-Register Now</h3>` (line 543):
  - A centered pill: `Special Offer` — small uppercase tracking-wider, e.g. `bg-warning text-warning-foreground text-[10px] font-bold px-2.5 py-0.5 rounded-full` in a flex-center wrapper.

### 4. Make "Notify Me" a hyperlink (anchor) instead of a button-with-onClick

- Replace the `<Button onClick={…}>` with an `<a>` styled like the current secondary button (reusing `buttonVariants({ variant: "secondary", size: "sm" })` from `@/components/ui/button`).
- `href` is computed inline from `preRegisterEmail` state — when empty, render the anchor `aria-disabled` + `pointer-events-none opacity-60` and a tooltip-less guard; when filled, `href = "mailto:checkin_support@futurewave.in?subject=…&body=…"`.
- On click (when valid): show the existing `toast.success("Opening email client…")` via `onClick`. When email is empty, `preventDefault` + `toast.error("Please enter your email")`.
- Keeps the same Mail icon + label text.

### Files to edit

- `src/pages/Subscription.tsx` — Premium Plus card block only (no other plans / no logic outside this card).

### Out of scope

- Pricing, plan structure, coupons.
- Other plan cards.
- The Smart Ring image asset itself (no re-export — gloss is pure CSS overlay).

