I found the current button already uses a `tel:` link, which mobile browsers can still show an OS confirmation sheet. That sheet is controlled by iOS/Android/browser security and cannot be fully suppressed from a normal web/PWA page.

Plan:
1. Update `CallGuardianButton` to prefer Capacitor native execution when the app is running as an installed native app.
   - Use `@capacitor/core` to detect native platform.
   - On Android, use the native intent path so the Ward tap hands off to the phone app more directly than a browser-created `tel:` anchor.
   - Keep the existing `tel:` fallback for browser/PWA/preview, because browser confirmation is unavoidable there.
2. Preserve the simple Ward UX.
   - Single tap on the green band immediately attempts to call the primary Guardian.
   - No custom in-app confirmation, no extra question, no dropdown on normal tap.
   - Long-press selection for multiple guardians can remain, but I’ll prevent accidental dropdown opening from interfering with normal tap.
3. Keep background side effects intact.
   - Continue logging the call attempt.
   - Continue sending the Guardian call notification.
4. Verify the code path.
   - Confirm the button still renders as `Call Don` and the bottom Messages tab stays unchanged.
   - Confirm there is no app-created modal/confirmation in the call flow.

Important limitation: in the web preview and PWA/browser mode, Android/iOS may still show the blue `Call +91...` OS sheet. The only way to avoid that class of browser prompt is to use the installed native app path; true automatic phone calls also require platform permissions and may still be restricted by the OS for safety.