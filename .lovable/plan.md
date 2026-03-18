

## Add Privacy Policy Page

### New file: `src/pages/PrivacyPolicy.tsx`
- Full privacy policy page with sections: Information Collection, Use of Cookies, Data Sharing, Data Security, Your Rights, Contact Information
- Styled consistently with the app (mobile-first, max-w-md centered)
- Uses AppLayout for consistent header/nav/footer
- Back navigation via a link to previous page or home

### Edit: `src/App.tsx`
- Add route: `/privacy-policy` → `<PrivacyPolicy />`

### Edit: `src/components/CookieConsent.tsx`
- Add a "Privacy Policy" link in the banner text that navigates to `/privacy-policy`
- Use React Router's `Link` component

### Edit: `src/components/AppLayout.tsx`
- Add a "Privacy Policy" link in the footer alongside "Cookie Settings"

