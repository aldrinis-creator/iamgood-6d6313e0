# Financial Healthcare — Expense Tracker

A new tile inside **My Health** that lets seniors and caregivers log healthcare expenses (manual, voice note, or photo of a bill), see a clean monthly dashboard, and share a PDF report with their Guardian.

## 1. New tile in My Health

Add an 8th top-level tile to `src/pages/MyHealth.tsx`:

- Label: **Financial Healthcare**
- Icon: `Wallet` (lucide)
- Color: emerald (matches "insured/paid" theme)
- Placement: Row 3, next to Vault and Emergency First Aid

Tapping it opens a new page `src/pages/FinancialHealth.tsx` (routed under the existing AppLayout, like other My Health tools).

## 2. Database — single table

One new table `public.healthcare_expenses` with full RLS (user_id = auth.uid()). Fields:

- `amount` (numeric), `currency` (text, default 'INR')
- `category` (enum: `medication`, `doctor_fees`, `insurance`, `diagnostics`, `equipment_caregiving`, `other`)
- `merchant` (text), `expense_date` (date), `notes` (text)
- `source` (enum: `manual`, `voice`, `bill_scan`)
- `bill_image_path` (text, points to private storage)
- `ai_extracted` (jsonb, raw extraction for audit)

Plus a **private** storage bucket `healthcare-bills` with per-user-folder RLS (same pattern as `medical-documents`).

**Privacy note shown in UI:** "Your financial logs are private and encrypted at rest. Only you and your nominated Guardian (if you export and share) can see them."

## 3. Three ways to log an expense

A single bottom-sheet "Add Expense" with three tabs:

1. **Manual** — big-text form: amount, category dropdown (the 5 standard headers above + Other), date (defaults today), merchant, notes.
2. **Voice / Notes** — large textarea + mic button (reuses existing `useVoiceRecognition` hook). Saved as a manual entry with `source='voice'`.
3. **Scan Bill** — camera/file upload. Image uploaded to `healthcare-bills`, then an edge function `extract-bill` calls **Lovable AI** (`google/gemini-3-flash-preview`, vision) with this strict prompt:
  > Extract from this healthcare bill and return JSON only: `{ amount, currency, merchant, date (YYYY-MM-DD), category }` where category is one of `medication | doctor_fees | insurance | diagnostics | equipment_caregiving | other`.
   Result pre-fills the Manual form so the user can confirm before saving — no silent writes.

## 4. Dashboard (the focus — clean & senior-friendly)

`FinancialHealth.tsx` shows, top to bottom:

- **This Month vs Last Month** hero card: big amount, delta arrow (green ↓ / amber ↑).
- **By Category** — horizontal bars (recharts) for the 5 headers, color-coded.
- **Upcoming Premiums** strip — any `insurance` entry whose notes include a renewal date surfaces here in amber.
- **Recent Entries** list — last 10, swipe/tap to edit or delete (with the standard `AlertDialog` confirm per project rule).
- Period toggle: Week / Month / Year.
- A small **"Ways to save"** card with 2–3 static, conservative tips (Jan Aushadhi generics link, annual vs monthly premium reminder, preventive check-up reminder). No AI advice in v1 to avoid liability.

Typography: min 18px (project rule). Colors: Emerald for paid/insured, Amber for upcoming, project Navy for headings.

## 5. PDF export for Guardian

Reuse `src/lib/reportPdf.ts` letterhead + `ReportShareButtons` so the user gets PDF / WhatsApp / Email share — same pattern as other reports. Report contains the period totals, category breakdown, and itemised list. The bill image is **not** included by default (privacy).

## 6. Out of scope for v1

- No auto-sync with banks, UPI, or insurers.
- No editing of OCR'd bill image after upload.
- No automatic spending advice from AI (only static tips).
- Guardian app does **not** get a live view — sharing is explicit, via exported PDF only (matches Guardian Profile Scope rule: identity-only, no health/finance data pushed).

## Technical notes

- Page: `src/pages/FinancialHealth.tsx`; components under `src/components/financial/` (`ExpenseForm`, `BillScanner`, `SpendDashboard`, `CategoryBars`, `RecentEntriesList`).
- Edge function: `supabase/functions/extract-bill/index.ts` — accepts `{ imagePath }`, downloads via service role, calls Lovable AI gateway, returns parsed JSON. CORS + zod validation per project rules.
- Migration creates table + GRANTs + RLS + storage bucket policies in one file.
- Tile gated as a **free** feature (no `useFeatureGate` lock) so seniors can try it without hitting upgrade walls.
- Only the `user` role sees the tile (guardians don't track ward finances).

## Open questions before I build

1. Currency — lock to INR, or allow the user to pick per entry? Allow User to pick per entry with INR as default
2. Should the tile be available to **guardians** too (to log expenses *for* a ward), or strictly the `user` role? Yes
3. Voice narration — transcribe to text on-device (current `useVoiceRecognition`) is fine, or do you want server-side Whisper for better accuracy? Use Whisper 
  &nbsp;

&nbsp;