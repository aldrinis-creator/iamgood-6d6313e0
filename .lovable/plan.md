
## Plan — Move Contact Us to Profile Dropdown

Move the Contact Us form from the My Profile page tabs into the profile dropdown menu (AppHeader), and rename the Help page tab from "Contact Us" to "Get in Touch".

### Changes

**1. AppHeader.tsx — Add Contact Us to dropdown**
- Import `Send` icon from lucide-react
- Add new dropdown menu item between "My Profile" and "Accessibility":
  - Icon: `<Send className="w-4 h-4 mr-2" />`
  - Label: "Contact Us"
  - On click: navigate to `/help?tab=contact`

**2. Help.tsx — Rename tab label**
- Change tab label from "Contact Us" to "Get in Touch" (line 52)
- Update CardTitle from "Contact Us" to "Get in Touch" (line 243)

**3. MyProfile.tsx — Remove Contact Us tab**
- Remove the Tabs wrapper and Contact Us tab
- Keep only the Profile tab content wrapped in VaultGate
- Remove `Tabs`, `TabsContent`, `TabsList`, `TabsTrigger` imports and usage
- Keep `ContactUsForm` import (no longer needed here, can be removed)

### Files to Edit
- `src/components/AppHeader.tsx`
- `src/pages/Help.tsx`
- `src/pages/MyProfile.tsx`
