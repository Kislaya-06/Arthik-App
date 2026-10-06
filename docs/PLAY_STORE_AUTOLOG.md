# Play Store readiness — Automatic Logging

Today Arthik ships as an APK from GitHub Releases, so `READ_SMS` / `RECEIVE_SMS` are fine. Google Play restricts these permissions. This file is the checklist for when you want Play Store.

## 1. What Google requires
SMS permissions are allowed only for apps whose **core feature** fits an approved exception. Arthik fits **"SMS-based money management"** (apps that track and manage budget). Approval is by a human reviewer and is **not guaranteed** — several expense trackers have been rejected because "manual entry is an alternative".

## 2. Already done in code (no change needed)
- **Prominent disclosure** before the permission prompt (Setup → intro + SMS screens).
- **Minimum permissions**: only `READ_SMS`, `RECEIVE_SMS`, `WAKE_LOCK`. No `SEND_SMS`, no call log.
- **No `REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`** (also Play-restricted). We only open App info.
- **No foreground service** (would need its own Play declaration).
- **On-device processing**, SMS never uploaded — matches what you will write in the Data Safety form.
- Notification listener reads only an allow-list of payment apps.

## 3. Plan A — apply for the SMS exception
1. Privacy policy page (public URL) describing exactly section "Privacy" in the app.
2. Play Console → App content → **Sensitive permissions → SMS & Call Log** → choose *SMS-based money management*.
3. Upload a short screen recording: Profile → Automatic Logging → setup → a bank SMS becoming a transaction.
4. Data safety: "SMS messages: collected? **No** (processed on device only)". Financial info: transactions you log are stored in your account.
5. Build: `eas build -p android --profile production` (AAB).

## 4. Plan B — if Google rejects: notification-only Play build
The same codebase can drop SMS for Play only. Steps:

1. Create `plugins/withoutSmsPermissions.js`:
```js
const { withAndroidManifest } = require('expo/config-plugins');
module.exports = (config) =>
  withAndroidManifest(config, (c) => {
    const m = c.modResults.manifest;
    m.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    m['uses-permission'] = [
      ...(m['uses-permission'] || []),
      { $: { 'android:name': 'android.permission.READ_SMS', 'tools:node': 'remove' } },
      { $: { 'android:name': 'android.permission.RECEIVE_SMS', 'tools:node': 'remove' } },
    ];
    const app = m.application[0];
    app.receiver = [
      ...(app.receiver || []),
      { $: { 'android:name': 'expo.modules.arthikautolog.SmsReceiver', 'tools:node': 'remove' } },
    ];
    return c;
  });
```
2. Convert `app.json` → `app.config.js` and add the plugin only when `process.env.ARTHIK_STORE === 'play'`.
3. In `eas.json` production profile add `"env": { "ARTHIK_STORE": "play" }`.
4. JS side: in `AutoLogSetupScreen`, when `hasSmsPermission()` can never be granted (permission not declared → request returns denied immediately), skip the SMS + Discovery steps and go straight to notifications. Every notification-only detection already ends in **Pending Review** (no account digits → never auto-logged), so trust rules still hold.
5. Update the Setup and Privacy copy to say "notifications only" for that build.

Effort: about half a day. No database or engine changes needed.

## 5. In-app updater must go for Play
v2.0 added `REQUEST_INSTALL_PACKAGES` (in-app APK updates for GitHub users). Google Play **rejects** apps that use it to update themselves. For the Play build:
- Remove `REQUEST_INSTALL_PACKAGES` from `app.json` (via the same `ARTHIK_STORE=play` config switch as Plan B).
- On Play builds, make `UpdateRequiredScreen` open the Play Store listing instead of downloading (`canInstallInApp()` in `src/lib/apkInstaller.ts` → return `false` when `Constants.expoConfig.extra.store === 'play'`), or use Play In-App Updates.
- Keep `version_control` per store (e.g. a separate `version_control_play` row) so GitHub and Play users can be forced independently.

## 6. Don't forget
- Target SDK requirements (Expo SDK upgrade handles this).
- `allowBackup` stays `false` — reinstall must not restore the encrypted DB.
