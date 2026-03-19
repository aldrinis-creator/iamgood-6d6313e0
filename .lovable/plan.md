

# Three Fixes: Profile Dropdown, Document Analyzer Photo, Meal Photo Upload

## 1. User icon (top-right) → Dropdown with Settings + Logout

**Current**: The User icon navigates directly to `/settings`.
**Change**: Replace with a `DropdownMenu` containing "Settings" and "Logout" options.

### File: `src/components/AppHeader.tsx`
- Import `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuTrigger` from UI components
- Import `useAuth` from AuthContext, `LogOut`, `Settings` icons
- Replace the `<button onClick={() => navigate("/settings")}>` with a `DropdownMenu` trigger
- Add two menu items: "Settings" (navigates to `/settings`) and "Logout" (calls `signOut()`, navigates to `/login`)

---

## 2. Fix Document Analyzer Photo/Upload not working

**Current**: The file input has `capture="environment"` which on some browsers forces camera-only and prevents gallery/file picker. The `<label>` wraps a hidden `<input>`, which should work — but the issue is likely the `capture` attribute blocking upload on desktop/some mobile browsers.

### File: `src/components/health-tools/DocumentAnalyzer.tsx`
- Remove the `capture="environment"` attribute from the file input so it opens the standard file picker (which on mobile still offers camera as an option)
- This allows both camera capture and gallery/file upload to work across devices

---

## 3. Add meal photo upload to "Analyze This Meal"

**Current**: Tapping "Analyze This Meal" immediately sends a text-only request to the AI with no photo input. The edge function doesn't accept images either.

### File: `src/components/NutritionAdvisor.tsx`
- When user taps "Analyze This Meal", instead of immediately calling the AI, show a photo capture/upload UI (similar to Document Analyzer)
- Add state for `mealImage` (base64) and `mealImagePreview` (blob URL)
- Show a camera/upload area with preview and clear button
- On "Analyze", send the image to the edge function

### File: `supabase/functions/nutrition-advisor/index.ts`
- Accept an optional `image` field (base64 data URL) in the request body
- When image is present for `analyze_meal`, use a vision-capable model (`google/gemini-2.5-flash`) and pass the image as a multimodal message part
- Fall back to text-only analysis if no image provided

---

## Technical Details

**Dropdown menu** uses existing `src/components/ui/dropdown-menu.tsx` components already in the project.

**Vision model for meal analysis**: The edge function will send the image as a `image_url` content part in the OpenAI-compatible format, using `google/gemini-2.5-flash` which supports image+text.

