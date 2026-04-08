

## App Store & Play Store Migration Plan

Your Check-iN app is currently a PWA (Progressive Web App). To publish it on the Apple App Store and Google Play Store, you need to wrap it in a native shell using **Capacitor** — a bridge that runs your existing web app inside a native iOS/Android container.

### What I Will Do (in Lovable)

1. **Install Capacitor dependencies** — `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`, `@capacitor/android`
2. **Initialize Capacitor** — create `capacitor.config.ts` with your app ID (`app.lovable.c08453f9a77243a6ab7c53dcaa1d84f2`) and name (`Check-iN`), configured for live reload from the sandbox during development
3. **Adjust Vite config** — set `base: './'` for native file:// loading compatibility
4. **Add native plugin wrappers** (optional, as needed) — e.g., `@capacitor/push-notifications` for native push, `@capacitor/geolocation` for background location

### What You Need To Do (on your machine)

| Requirement | iOS | Android |
|---|---|---|
| **Computer** | Mac (required) | Mac, Windows, or Linux |
| **IDE** | Xcode 15+ (free from Mac App Store) | Android Studio (free download) |
| **Developer Account** | Apple Developer Program — **$99/year** | Google Play Console — **$25 one-time** |
| **Device or Emulator** | iPhone simulator (in Xcode) or physical device | Android emulator (in Android Studio) or physical device |

### Steps You'll Run Locally

```text
1. Export project to GitHub (via Lovable "Export to GitHub" button)
2. git clone <your-repo> && cd <your-repo>
3. npm install
4. npx cap add ios          ← adds native iOS project
5. npx cap add android      ← adds native Android project
6. npm run build            ← build the web app
7. npx cap sync             ← copy web assets into native projects
8. npx cap open ios         ← opens Xcode
9. npx cap open android     ← opens Android Studio
```

### App Store Submission Checklist

**Apple App Store:**
- App icon: 1024×1024 PNG (no transparency, no rounded corners)
- Screenshots: at least 1 set for iPhone 6.7" display
- Privacy policy URL (you have this: `/privacy-policy`)
- App description, keywords, category (Health & Fitness / Medical)
- Review may take 1-3 days; Apple may ask about health data handling

**Google Play Store:**
- App icon: 512×512 PNG
- Feature graphic: 1024×500 PNG
- Screenshots: at least 2 phone screenshots
- Privacy policy URL
- Data safety form (declare what data you collect)
- Review typically takes hours to 1 day

### Important Considerations

- **Push Notifications**: Your current web push will need to be supplemented with native push via `@capacitor/push-notifications` + Firebase Cloud Messaging (Android) and APNs (iOS). I can set this up in the codebase.
- **Background Location**: For geofencing to work when the app is closed, you'll need `@capacitor/geolocation` with background mode — requires additional App Store justification for Apple.
- **App Store Review**: Apple scrutinizes health/emergency apps. Your emergency disclaimer and "not a replacement for 112" language is good — keep it prominent.
- **Deep Links**: Your emergency profile share links (`/e/:token`) will need Universal Links (iOS) and App Links (Android) configuration.

### Cost Summary

| Item | Cost |
|---|---|
| Apple Developer Account | $99/year |
| Google Play Developer Account | $25 one-time |
| Lovable (your existing plan) | Current plan |

Shall I proceed with the Capacitor setup in the codebase?

