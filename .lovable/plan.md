

# Fix: Health Tools AI Analysis Failing Due to Oversized Payloads

## Root Cause

The edge function logs show: **"you requested about 2,424,377 tokens (max 1,048,576)"** — the payload sent to the AI is 2.4x over the limit.

Two components send excessively large payloads:

1. **DocumentAnalyzer** (`src/components/health-tools/DocumentAnalyzer.tsx`): When a user uploads an image or PDF, `file.text()` reads the entire binary file as raw text — producing megabytes of garbled content sent to the AI.

2. **PrescriptionScanner** (`src/components/medications/PrescriptionScanner.tsx`): Sends base64-encoded image data (truncated to 500 chars, but the approach is flawed — 500 chars of base64 is meaningless and the full file is still read into memory).

## Fix Plan

### 1. DocumentAnalyzer — Truncate and validate input
- For text files (`.txt`): read `file.text()` but **cap at 10,000 characters**
- For images/PDFs: show a message that only text input or `.txt` files are supported (since the AI model used doesn't accept image inputs via this text-only endpoint), OR extract text before sending
- Add a character limit warning on the textarea input
- Truncate any payload to a safe max (e.g., 15,000 chars) before calling the edge function

### 2. PrescriptionScanner — Remove fake base64 approach
- The current image upload sends a useless 500-char base64 snippet — the AI cannot actually "see" the image through this text-only endpoint
- Change image upload mode to inform users: "Please type the medication names from your prescription" (the manual mode already works)
- Alternatively, keep the upload UI but extract text via a proper OCR step, or just disable image mode and default to manual text entry
- Either way, cap payload size before sending

### 3. Edge function — Add server-side payload size guard
- In `supabase/functions/health-tools/index.ts`, truncate `userMessage` to a safe maximum (e.g., 20,000 characters) before sending to the AI gateway
- Return a clear error message if the payload exceeds the limit: "Input too large. Please reduce the text size."

### Files to modify
- `src/components/health-tools/DocumentAnalyzer.tsx` — cap file content, reject binary files
- `src/components/medications/PrescriptionScanner.tsx` — remove broken base64 approach, default to manual mode
- `supabase/functions/health-tools/index.ts` — add server-side payload size guard

