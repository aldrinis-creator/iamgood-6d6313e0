# App Store submission pack for Check-iN

Recommendation: do the full pack, with conservative health wording. Apple rejects senior-safety apps most often for (a) unverifiable medical/emergency claims, (b) reviewers unable to test a phone-OTP login, and (c) privacy labels that miss location or health data. All four pieces below address one of those.

## What gets drafted

1. **Listing copy** — app name + subtitle (30 chars), promotional text (170 chars), full description (~3,000 chars) organised as: what it does, For Seniors, For Guardians, Health tools, Safety net, Subscription terms; plus a 100-character keyword string.
2. **App Review notes + demo account** — a reviewer walkthrough: how to sign in, how to trigger a check-in, SOS, medication reminder and guardian alert without waiting for real schedules, and a note that no real emergency services are contacted in test mode.
3. **Privacy nutrition labels** — a table mapping each data type actually collected (precise location, health, contact info, phone number, photos/medical documents, usage) to purpose, linkage to identity, and tracking status.
4. **Screenshot plan + release notes** — a 6-screen sequence with caption text, plus a "What's New" entry for v1.1.0.

## Tone and compliance rules applied

- Positioned as a personal safety and reminder companion, not a medical device, diagnosis tool, or emergency service. AI health tools described as informational screening with a see-a-doctor prompt.
- No claims of life-saving, guaranteed response, or clinical accuracy. No invented ratings, user counts, or testimonials.
- Explicit statement that SOS alerts notify chosen contacts and do not dial emergency services on the user's behalf.
- Subscription pricing stated in INR exactly as configured (Basic Rs 99/mo or Rs 999/yr, Pro Rs 199/mo or Rs 1999/yr) with auto-renew disclosure, as required for apps with in-app or external billing.
- Background location and health data usage explained in-copy, since Apple requires justification for those permissions.

## Deliverable

Everything is written to a single reference file in the repo, `docs/appstore-submission.md`, so it can be copied field by field into App Store Connect. No app code, UI, or backend changes.

## Open items I will flag rather than invent

- A reviewer demo phone number and OTP bypass path (if none exists, the notes will say a test account must be provisioned).
- Support URL and marketing URL to list on the product page.
