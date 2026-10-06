import { Platform } from 'react-native';

/**
 * In-app APK update (Android, v2.0+).
 *
 * Why: Arthik is distributed as an APK (GitHub), not via Play. Opening the browser
 * made users hunt for the file in Downloads. Now: download inside the app with
 * progress, then hand the file to Android's own installer ("Do you want to update
 * this app?"). Android ALWAYS shows that system dialog — an app cannot install
 * itself silently, and that is correct.
 *
 * Needs: expo-file-system (download), expo-intent-launcher (open installer),
 * permission REQUEST_INSTALL_PACKAGES (app.json). The first time, Android may ask
 * the user to allow "Install unknown apps" for Arthik.
 */

export type InstallerEvent =
  | { kind: 'progress'; fraction: number; receivedMb: number; totalMb: number | null }
  | { kind: 'downloaded'; localUri: string };

const FLAG_GRANT_READ_URI_PERMISSION = 1;
const APK_MIME = 'application/vnd.android.package-archive';

export const canInstallInApp = (): boolean => Platform.OS === 'android';

const legacyFs = () => require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');

/** Downloads the APK into the app cache. Resolves with the local file URI. */
export async function downloadApk(
  url: string,
  version: string,
  onEvent: (e: InstallerEvent) => void
): Promise<string> {
  const FileSystem = legacyFs();
  const safe = (version || 'latest').replace(/[^0-9a-zA-Z.]/g, '');
  const target = `${FileSystem.cacheDirectory}arthik-update-${safe}.apk`;
  try {
    await FileSystem.deleteAsync(target, { idempotent: true }); // never install a half-downloaded file
  } catch {}

  const task = FileSystem.createDownloadResumable(url, target, {}, (p) => {
    const total = p.totalBytesExpectedToWrite > 0 ? p.totalBytesExpectedToWrite : null;
    onEvent({
      kind: 'progress',
      fraction: total ? Math.min(1, p.totalBytesWritten / total) : 0,
      receivedMb: p.totalBytesWritten / 1048576,
      totalMb: total ? total / 1048576 : null,
    });
  });

  const result = await task.downloadAsync();
  if (!result || result.status < 200 || result.status >= 300) {
    throw new Error(`Download failed (HTTP ${result?.status ?? 'no response'})`);
  }
  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists || (info.size ?? 0) < 1_000_000) {
    // A real Arthik APK is tens of MB. Tiny file = error page / wrong link.
    throw new Error('Downloaded file is not a valid APK. Please try again.');
  }
  onEvent({ kind: 'downloaded', localUri: result.uri });
  return result.uri;
}

/** Opens Android's system installer for a downloaded APK. */
export async function openInstaller(localUri: string): Promise<void> {
  const FileSystem = legacyFs();
  const IntentLauncher = require('expo-intent-launcher') as typeof import('expo-intent-launcher');
  const contentUri = await FileSystem.getContentUriAsync(localUri);
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: contentUri,
    type: APK_MIME,
    flags: FLAG_GRANT_READ_URI_PERMISSION,
  });
}

/** Opens "Install unknown apps" for Arthik (used when Android blocked the installer). */
export async function openUnknownSourcesSettings(packageName: string): Promise<void> {
  const IntentLauncher = require('expo-intent-launcher') as typeof import('expo-intent-launcher');
  await IntentLauncher.startActivityAsync('android.settings.MANAGE_UNKNOWN_APP_SOURCES', {
    data: `package:${packageName}`,
  });
}
