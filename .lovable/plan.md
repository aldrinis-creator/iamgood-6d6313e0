

## Plan — Independent Contact Us form in dropdown

Keep the dropdown "Contact Us" item, but instead of routing to the Help page's "Get in Touch" tab, open the Contact Us form as a standalone surface. Help's "Get in Touch" remains untouched and unrelated.

### Changes

**1. New file: `src/pages/ContactUs.tsx`**
- Standalone page wrapped in `AppLayout`.
- Page header: "Contact Us" with short subtitle ("Have a question, found a bug, or want to suggest a feature? Send us a message.").
- Renders the existing `<ContactUsForm />` (already matches the screenshot: Full Name, Email, Phone with country code, Subject dropdown, Message with `0/1000` counter, Send Message button).
- No VaultGate — public-facing form, accessible to any authenticated user.

**2. `src/App.tsx` — Register route**
- Add `/contact-us` route inside `ProtectedRoute` (shared by both user and guardian roles, like `/my-profile` and `/help`).

**3. `src/components/AppHeader.tsx` — Update dropdown link**
- Change the "Contact Us" dropdown item's navigation from `/help?tab=contact` to `/contact-us`.
- Keep `Send` icon and label.

**4. `src/pages/Help.tsx` — De-link from Contact Us**
- Remove the "Get in Touch" tab entirely (it was the renamed Contact Us tab and is now redundant).
- Remove `"contact"` from the `HelpTab` union and from the `tabs` array.
- Remove the `useSearchParams` `?tab=contact` handling for that value.
- Help retains FAQ, Settings, Privacy, Terms tabs only.

**5. `src/pages/MyProfile.tsx` — No change**
- Already cleaned up in previous step (no Contact Us tab, no Tabs wrapper). Leave as is.

### Files

**Create**
- `src/pages/ContactUs.tsx`

**Edit**
- `src/App.tsx`
- `src/components/AppHeader.tsx`
- `src/pages/Help.tsx`

### Out of scope
- No DB / RLS / edge function changes — `contact_submissions` and `admin-contacts` stay as-is.
- No changes to `ContactUsForm.tsx` — it already matches the screenshot exactly.
- No changes to `MyProfile.tsx`.

