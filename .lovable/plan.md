

## Plan — Add Client-Side Validation to Contact Us Form

Enhance the ContactUsForm with real-time field-level validation, inline error messages, and a disabled submit button when the form is invalid.

### Changes to `src/components/ContactUsForm.tsx`

**1. Add validation state tracking**
- Add `touched` state to track which fields have been interacted with
- Add `errors` state derived from zod schema validation
- Compute `isFormValid` boolean from schema validation

**2. Real-time validation on change/blur**
- Validate on field blur (mark field as touched)
- Re-validate all fields on any change to keep error states current
- Show inline error messages below each invalid field

**3. Visual error states**
- Add `data-error` attribute or conditional class for invalid fields
- Style: red border (`border-destructive`), red error text below field
- Keep existing `maxLength` indicators

**4. Disable submit button when invalid**
- Change `disabled={submitting}` to `disabled={submitting || !isFormValid}`
- Add visual distinction for disabled state (already handled by Button component)

**5. Error message display**
- Below each field: `<p className="text-xs text-destructive mt-1">{errors.full_name}</p>` (conditional)
- Keep toast error as fallback for any unexpected validation failures

### Implementation details

```typescript
// New state
const [touched, setTouched] = useState<Record<string, boolean>>({});

// Derived validation
const validation = contactSchema.safeParse({ full_name: fullName, email, phone, subject, message });
const errors = validation.success ? {} : validation.error.issues.reduce((acc, i) => {
  acc[i.path[0]] = i.message;
  return acc;
}, {} as Record<string, string>);
const isFormValid = validation.success;

// Field blur handler
const handleBlur = (field: string) => setTouched(p => ({ ...p, [field]: true }));
```

### Out of scope
- No server-side changes — validation remains client-side only (server has RLS)
- No changes to `contact_submissions` table schema
- No changes to admin-contacts edge function

