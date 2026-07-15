# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Deployment & OTA Updates Workflow

Arthik uses **Expo EAS Build** for generating APKs and **Expo Updates** for Over-The-Air (OTA) patches. 
Whenever working on deployment or updates, follow these strict rules:

- **Full APK Build (New Binaries):** Required ONLY when making changes to native code, adding new native plugins (like `expo-image-picker`), or altering `app.json` configurations (like package names or splash screens).
  - Command: `eas build -p android --profile preview`
- **OTA Updates (Code/UI Patches):** Use this for pushing JS/TS changes, UI tweaks, or bug fixes directly to users without a new APK.
  - Command: `eas update --branch preview --message "Your update description"`
- **Update Logic:** The app has a built-in listener in `App.tsx` that checks for updates on launch and prompts the user with an alert to reload the app when an update is available. Do not modify this listener unless explicitly requested.
