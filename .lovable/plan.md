# Add iOS permission usage strings to Info.plist

Apple rejects any build that requests a permission without an explicit, human-readable reason. `ios/App/App/Info.plist` currently has five generic strings and is missing five required ones. This replaces the generic text with Check-iN-specific wording and adds the missing keys.

## What changes

One file: `ios/App/App/Info.plist`. No app code, UI, or backend changes.

### Rewritten (currently generic placeholder text)

| Key | New string |
|---|---|
| `NSCameraUsageDescription` | Check-iN uses the camera to scan prescriptions, medicines and health test strips. |
| `NSPhotoLibraryUsageDescription` | Check-iN lets you attach photos of prescriptions and reports to your medical vault. |
| `NSPhotoLibraryAddUsageDescription` | Check-iN saves your reports to your photo library when you choose to export them. |
| `NSMicrophoneUsageDescription` | Check-iN uses the microphone so you can speak to the voice assistant. |
| `NSLocationWhenInUseUsageDescription` | Check-iN uses your location so your guardians can find you if you send an SOS. |

### Added (missing entirely)

| Key | String |
|---|---|
| `NSLocationAlwaysAndWhenInUseUsageDescription` | Check-iN uses your location in the background to alert your guardians if you leave a safe zone or send an SOS while the app is closed. |
| `NSSpeechRecognitionUsageDescription` | Check-iN converts your speech to text so the assistant can answer your question. |
| `NSMotionUsageDescription` | Check-iN uses motion data to detect a possible fall and ask if you are okay. |
| `NSContactsUsageDescription` | Check-iN can read your contacts so you can pick a guardian without typing their number. |
| `NSFaceIDUsageDescription` | Check-iN uses Face ID to unlock your medical vault. |

### Background modes

Add `UIBackgroundModes` with `location` and `remote-notification`, since safe-zone monitoring and guardian alerts run while the app is backgrounded. The App Review notes in `docs/appstore-submission.md` already carry the justification Apple will ask for.

## After the change

You need to pull the project locally and run `npx cap sync ios` before building in Xcode — the plist lives in the native project, so the change only reaches a device after a sync and rebuild.
