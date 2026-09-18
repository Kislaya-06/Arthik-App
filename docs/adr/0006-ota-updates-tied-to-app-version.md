# 0006. Over-The-Air (OTA) Updates Tied to App Version Policy

## Context
Arthik ships directly as an Android APK via EAS Build and delivers fast bug fixes and UI updates to user devices using Expo's EAS Update service. 

In React Native apps, shipping JavaScript updates over-the-air that expect native modules not present in the installed binary causes immediate fatal app crashes on launch (e.g. attempting to invoke an unlinked native method or mismatched native library ABI). Expo offers multiple `runtimeVersion` policies, including hash-based fingerprints, custom strings, and `appVersion`.

## Decision
We configured `app.json` with `"runtimeVersion": { "policy": "appVersion" }`.

1. **Strict Version Parity**: An OTA update branch (e.g. `preview` or `production`) only targets devices that are currently executing the exact matching `expo.version` string defined in `app.json` (e.g. `1.2.3`).
2. **Binary Bump Gate**: Whenever native dependencies, Android permissions, native plugins, or major architectural changes occur, the developer bumps `expo.version` in `app.json` and cuts a new full binary build (`eas build -p android`). Existing installed binaries on older versions will never receive the incompatible JS bundle.
3. **Automatic Update Check**: On app startup, `App.tsx` listens for available updates on launch via `Updates.checkForUpdateAsync()` and prompts the user to reload gracefully when an update is downloaded.

## Consequences
- **Positive**: Complete prevention of native ABI mismatch crashes. Predictable update targeting. Fast, frictionless patch deployment for TS/JS and UI changes without requiring full APK downloads or manual sideloading.
- **Negative**: Bumping `expo.version` without building and distributing a new APK means any subsequent OTA update will not reach previously installed devices. The developer must strictly coordinate version bumps with binary builds.

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- Expo Fingerprint policy (`runtimeVersion: { policy: "fingerprint" }`) stabilizes to a point where automated CI/CD reliably verifies native compatibility hashes across varying build machines, allowing safe OTAs across patch version increments that share identical native signatures.
