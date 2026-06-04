## Goal
Make it crystal clear who each role-selection box is for, by adding bold italic text at the bottom of each option.

## Changes
File: `src/pages/Register.tsx`

### "To protect myself" box (user role)
Add a new paragraph inside the inner `<div>`:
```html
<p className="text-sm font-bold italic text-muted-foreground mt-1">(Seniors and Lone dwellers click this box)</p>
```

### "To protect someone else" box (guardian role)
Add a new paragraph inside the inner `<div>`:
```html
<p className="text-sm font-bold italic text-muted-foreground mt-1">(Guardians / Family members of Seniors and Lone dwellers click this box)</p>
```

## Why
The current boxes show a title and short description, but some users may still hesitate about which one to pick. A direct call-to-action in bold italics at the bottom of each box removes ambiguity.

## Technical details
- Uses existing Tailwind semantic tokens (`text-muted-foreground`, `mt-1`) and standard utility classes (`font-bold`, `italic`, `text-sm`).
- No new dependencies, no state changes, no routing changes.
- Single file, two small additions.