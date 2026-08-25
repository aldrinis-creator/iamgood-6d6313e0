# Vault: add Investments and Social Media tiles

Two new categories join the existing Vault tab strip (Identity Docs · Email Accounts · Bank Accounts · Insurance · Legal Will), using the same zero-knowledge flow: each entry is JSON, AES-256-GCM encrypted with the vault PIN before it leaves the device.

## 1. Investments tile

New tab labelled "Investments" (trending-up icon). Add/Edit form fields:

- Title (label) — required, placeholder "e.g., HDFC Securities Demat"
- Platform / Broker — required
- Account ID
- Demat Number
- Linked PAN
- Login ID
- Password (masked in list view)
- Notes (optional)
- Optional encrypted photo attachment (same field the other categories use)

List preview: "Platform · Account ID", password masked until the eye toggle is tapped.

## 2. Social Media tile

New tab labelled "Social Media" (share icon). Add/Edit form fields:

- Title (label) — required, placeholder "WhatsApp, Email, Messaging Services"
- Platform — required
- Username / Email
- Phone Number (new field, alongside Username / Email)
- Password (masked in list view)
- Registered Phone → covered by the Phone Number field above
- Recovery Email
- Notes (optional)
- Optional encrypted photo attachment

List preview: "Platform · username or phone", password masked until revealed.

## Technical notes

- `src/lib/vaultCategories.ts`: extend `VaultCategory` with `"investment" | "social"`, add both to `VAULT_CATEGORIES` (label + empty hint), and add `InvestmentEntry` / `SocialEntry` interfaces (both including the optional `attachment`).
- `src/components/vault/VaultCategorisedSection.tsx`:
  - add icons to `CATEGORY_ICONS`, add both keys to the `grouped` accumulator;
  - add `blankDraft` cases and `validateDraft` rules (title + platform required);
  - add `EntryForm` branches and `EntryPreview` branches;
  - `AnyEntry` union extended.
- No database migration needed — `encrypted_documents.category` is a free-text column, and no reminder rows are created for these two categories.
- Existing entries and all other categories are untouched; nothing new is sent unencrypted.
