/**
 * Home's inline "Offline · Changes saved locally" / "Syncing changes..." pill.
 * The app-wide top banner (OfflineBanner) says the same thing, so the pill waits until that banner is gone:
 * one message at a time, and being offline is never left unsaid.
 */
export function shouldShowHomeNetworkPill(s: { isOffline: boolean; isSyncing: boolean; bannerVisible: boolean }): boolean {
  return (s.isOffline || s.isSyncing) && !s.bannerVisible;
}
