

## Add Terms of Service Link to Cookie Consent Banner

**Edit `src/components/CookieConsent.tsx`** (line 35):

Update the banner text to include a Terms of Service link alongside the existing Privacy Policy link. Change the sentence to:

```
Read our Privacy Policy and Terms of Service.
```

Both links use the same styling (`underline text-primary hover:text-primary/80`) and link to `/privacy-policy` and `/terms-of-service` respectively.

