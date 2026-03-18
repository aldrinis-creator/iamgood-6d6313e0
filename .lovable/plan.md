

## Move Care Journal to Guardian Dashboard

### Overview
Remove Care Journal from My Health and add it to the Guardian Dashboard. Guardians will log mood, symptoms, and notes about their ward. The database schema needs a small update so entries are linked to the ward (not the guardian).

### Database Changes

**Alter `care_journal` table:**
- Add `created_by UUID` column (the guardian who wrote the entry)
- `user_id` will now represent the **ward** (the person being observed)
- Update RLS policies: guardians can CRUD entries where they are the `created_by` and the `user_id` is their ward (matched via `guardians` table)
- Remove old user-only RLS policies

### Component Changes

**`src/components/CareJournal.tsx`**
- Update to accept a `wardUserId` prop instead of using the logged-in user as `user_id`
- On save, set `user_id = wardUserId` and `created_by = session.user.id`
- Query entries filtered by `user_id = wardUserId`

**`src/pages/GuardianDashboard.tsx`**
- Import and render `<CareJournal />` below existing cards
- Pass the resolved `wardUserId` (already fetched via guardian lookup logic)
- Extract ward-user-id resolution into a reusable piece so CareJournal can use it

**`src/pages/MyHealth.tsx`**
- Remove Care Journal from `healthTools` array
- Remove `CareJournal` import and conditional render

### Files Changed
1. **Migration** -- Add `created_by` column, update RLS policies for guardian access
2. **`src/components/CareJournal.tsx`** -- Accept `wardUserId` prop, save `created_by`
3. **`src/pages/GuardianDashboard.tsx`** -- Add CareJournal section
4. **`src/pages/MyHealth.tsx`** -- Remove Care Journal tile and render

