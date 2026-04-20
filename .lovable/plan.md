

## Plan — Change trial period from 30 days to 7 days

Only **one** place in the app actually advertises a trial duration. Everything else mentioning "30 days" is unrelated (GDPR/DPDP data-request SLA, streak-badge milestone) and stays as-is.

### Single change

**`src/pages/Subscription.tsx`** — the trial banner block (lines ~343-356):

- Comment label: `30-DAY TRIAL BANNER` → `7-DAY TRIAL BANNER`.
- Headline: `Try Premium Free for 30 Days` → `Try Premium Free for 7 Days`.
- Sub-copy stays: "Access all features effortlessly. Cancel anytime."
- CTA button label stays: "Start Your Free Trial".

### Verified — NO change needed

- **FAQ** (`src/data/faqData.ts` line 849-850): answer doesn't mention any day count, so it's already correct.
- **Email templates** (`supabase/functions/_shared/...`): no transactional or auth template mentions a trial duration. Confirmed via search.
- **Welcome email / signup template**: no trial-period copy present.
- **Other "30 days" hits** (PrivacyPolicy, Settings, Help, badges in faqData): all refer to GDPR data-request response time or streak badges — unrelated to trials, leave untouched.
- **Backend**: there is no trial-tracking column or edge-function logic enforcing a 30-day trial — it's marketing copy only. No DB migration needed.

### Out of scope

- Implementing actual trial enforcement (start/end dates, auto-downgrade) — this is a separate feature, currently the banner is purely promotional.
- Touching unrelated "30 days" copy.

