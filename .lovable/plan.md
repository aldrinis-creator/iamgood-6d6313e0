

## Add Terms of Service Page

### New file: `src/pages/TermsOfService.tsx`
- Mirrors the structure of `PrivacyPolicy.tsx` — uses `AppLayout`, same styling
- Sections: Acceptance of Terms, Description of Service, User Accounts, Emergency Services Disclaimer, Subscription & Payments, Limitation of Liability, Termination, Governing Law, Contact
- Content tailored to Check-iN (Indian market, INR references)

### Edit: `src/App.tsx`
- Import `TermsOfService` and add route `/terms-of-service`

### Edit: `src/components/AppLayout.tsx`
- Add a "Terms of Service" link in the footer alongside the existing Privacy Policy and Cookie Settings links

