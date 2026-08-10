# Info.plist permission strings for App Store submission

Yes — this is required. Apple rejects any build that triggers a permission prompt without a usage string, and an app that requests one with no description crashes on iOS. Check-iN asks for location, camera, photo library and microphone today, so those strings must exist before submission.

Only the iOS native config file changes. No app code, UI or backend changes.

## What gets added

`ios/App/App/Info.plist` currently has 5 generic strings ("This app requires access to your camera to take photos"). Those are replaced with feature-specific wording, and the missing keys are added.

| Key | Feature in Check-iN that needs it | Status |
|---|---|---|
| `NSLocationWhenInUseUsageDescription` | SOS location, live journey, nearest hospital finder | replace generic text |
| `NSLocationAlwaysAndWhenInUseUsageDescription` | Safe-zone enter/exit alerts to guardians while app is closed | add |
| `NSCameraUsageDescription` | Prescription/report scanning, health tool photos, pill identifier, meal photos | replace generic text |
| `NSPhotoLibraryUsageDescription` | Attaching existing reports to Medical Vault | replace generic text |
| `NSPhotoLibraryAddUsageDescription` | Saving exported PDF reports / receipts | replace generic text |
| `NSMicrophoneUsageDescription` | Voice assistant and voice query | replace generic text |
| `NSSpeechRecognitionUsageDescription` | Speech-to-text for the assistant | add |
| `NSMotionUsageDescription` | Fall detection | add |
| `NSContactsUsageDescription` | Picking a guardian from contacts | add only if the contact picker is kept; otherwise omit |
| `NSFaceIDUsageDescription` | Medical Vault unlock | add only if biometric unlock is enabled on iOS; otherwise omit |

Wording follows Apple's rule of naming the concrete benefit to the user, e.g. "Check-iN uses your location in the background to alert your guardians if you leave a safe zone or send an SOS while the app is closed."

## Also added

- `UIBackgroundModes` with `location` and `remote-notification`, needed for safe-zone monitoring and push alerts while backgrounded.
- `ITSAppUsesNonExemptEncryption` set to `false` so App Store Connect stops asking the export-compliance question on every upload.

## Notes

- Ask-only-when-needed still applies: iOS shows each prompt the first time the feature is used, and the app stays usable if a permission is denied.
- Background location will draw reviewer scrutiny; the justification is already written in the App Review notes in `docs/appstore-submission.md`.
- After the change, pull the project and run `npx cap sync` before building in Xcode.
- Two keys (Contacts, Face ID) depend on whether those flows ship in the iOS build — confirm and I will include or drop them.
