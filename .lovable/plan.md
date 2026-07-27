## Save tech stack reference to project memory

Create a new memory file capturing the full Check-iN tech stack so future sessions can reference it without re-deriving from source.

### Files to write

1. **`mem://project/tech-stack-full.md`** — full tech stack breakdown organized by layer:
   - Frontend (React 18, TS 5, Vite 5, Tailwind v3, shadcn/ui, React Router v7, TanStack Query, Recharts v3, Leaflet, vite-plugin-pwa)
   - Mobile shells (Capacitor 8 → Android SDK 36, iOS 15+)
   - Backend / Lovable Cloud (Postgres + RLS, pg_cron, Edge Functions, Realtime, Storage, phone-first Auth)
   - AI & Voice (Lovable AI Gateway / Gemini 2.5 family, Sarvam.ai bulbul:v2 TTS + saarika:v2 STT, MCP server)
   - Communications (MSG91 SMS/OTP/WhatsApp, Resend + React Email via futurewave.in, Web Push VAPID)
   - Payments (Razorpay external checkout at futurewave.in/pay)
   - Video/Marketing (Remotion 4, ElevenLabs)
   - Tooling (Bun, Vitest, Playwright, ESLint)

2. **`mem://index.md`** — replace the existing `[Tech Stack Overview]` line under `## Memories` to point to the new, more detailed file.

### Notes

- Existing `mem://project/tech-stack` will be superseded by the new fuller file; the index entry is updated to reference the new path.
- No application code is touched — memory files only.
