import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { StyleSheet, View, StatusBar, AppState } from 'react-native';
import { AppNavigation, navigationRef, navigateTo } from './src/navigation';
import { useTheme } from './src/store/themeStore';
import { supabase } from './src/config/supabase';
import { useAuthStore } from './src/store/authStore';
import { useCategoryStore } from './src/store/categoryStore';
import { useExpenseStore } from './src/store/expenseStore';
import { useDailyBudgetStore } from './src/store/dailyBudgetStore';
import {
  registerNotificationResponseListener,
  setupNotifications,
} from './src/lib/notificationService';
import { startNotificationSync } from './src/lib/notificationSync';
import { startQuickCategorySync } from './src/lib/quickCategories';
import Constants from 'expo-constants';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { SyncFailedBanner } from './src/components/SyncFailedBanner';
import { useNetworkStore } from './src/store/networkStore';
import { checkAppVersionStatus, VersionCheckResult } from './src/lib/versionCheck';
import { resolveSavingsRoute } from './src/lib/budgetModeUtils';
import { UpdateRequiredScreen } from './src/screens/UpdateRequiredScreen';
import { useAppLockStore } from './src/store/appLockStore';
import { AppLockOverlay } from './src/components/AppLockOverlay';
import { SplashCover } from './src/components/SplashCover';
import { OtaUpdateModal } from './src/components/OtaUpdateModal';
import { useOtaStore } from './src/store/otaStore';
import { onBeforeSignOut } from './src/features/autoLog/service';
import { AppAlertModal } from './src/components/ui/AppAlertModal';
import { patchNativeAlert } from './src/store/alertStore';
import { perfMark } from './src/lib/perfMarks';

perfMark('js_start');
patchNativeAlert();

const ConnectedOtaModal: React.FC = () => {
  const visible = useOtaStore((s) => s.visible);
  const status = useOtaStore((s) => s.status);
  const info = useOtaStore((s) => s.info);
  const isDownloading = useOtaStore((s) => s.isDownloading);
  const downloadText = useOtaStore((s) => s.downloadText);
  const error = useOtaStore((s) => s.error);
  const applyUpdate = useOtaStore((s) => s.applyUpdate);
  const hideUpdateModal = useOtaStore((s) => s.hideUpdateModal);

  if (!visible) return null;

  return (
    <OtaUpdateModal
      visible={visible}
      status={status}
      updateInfo={info}
      isDownloading={isDownloading}
      downloadProgressText={downloadText}
      error={error}
      onUpdate={applyUpdate}
      onDismiss={hideUpdateModal}
      onRetry={applyUpdate}
    />
  );
};

export default function App() {
  const { colors, isDark } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const initAppLock = useAppLockStore((s) => s.init);
  const lockApp = useAppLockStore((s) => s.lock);

  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded) perfMark('fonts_ready');
  }, [fontsLoaded]);

  const [updateRequirement, setUpdateRequirement] = useState<VersionCheckResult>({
    isRequired: false,
    minVersion: '',
    releaseUrl: '',
  });

  useEffect(() => {
    const currentVersion = Constants.expoConfig?.version || '1.2.3';
    checkAppVersionStatus(supabase, useNetworkStore.getState().isOffline, currentVersion).then((res) => {
      if (res.isRequired) {
        setUpdateRequirement(res);
      }
    });

    const unsubNetwork = useNetworkStore.subscribe((state, prevState) => {
      if (prevState.isOffline && !state.isOffline) {
        checkAppVersionStatus(supabase, false, currentVersion).then((res) => {
          if (res.isRequired) {
            setUpdateRequirement(res);
          }
        });
      }
    });

    // Re-check when the app returns to the foreground (users rarely cold-start the app).
    const versionAppStateSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        checkAppVersionStatus(supabase, useNetworkStore.getState().isOffline, currentVersion).then((res) => {
          if (res.isRequired) setUpdateRequirement(res);
        });
      }
    });

    if (!__DEV__ && !updateRequirement.isRequired) {
      useOtaStore.getState().checkForUpdates();
    }

    // Smart notifications: the schedule is rebuilt from the user's data whenever it changes (see notificationPolicy.ts)
    const stopNotificationSync = startNotificationSync();
    // Keeps the user's top categories saved on the phone for the Automatic Logging notification buttons.
    const stopQuickCategorySync = startQuickCategorySync();

    // Handle user tapping on a device notification in notification shade
    const unregisterNotif = registerNotificationResponseListener((data, response) => {
      // A category button on an Automatic Logging notification: save it quietly, never navigate.
      if (typeof (response as any)?.actionIdentifier === 'string' && (response as any).actionIdentifier.startsWith('cat:')) {
        import('./src/features/autoLog/notificationActions').then((m) => m.handleCategoryResponse(response)).catch(() => {});
        return;
      }
      const isBudgetModeEnabled = useDailyBudgetStore.getState().isBudgetModeEnabled;
      if (data?.type === 'autolog') {
        if (data?.screen === 'ExpenseDetail' && data?.expenseId) navigateTo('ExpenseDetail', { expenseId: data.expenseId });
        else if (data?.screen === 'AutoLogReview') navigateTo('AutoLogReview');
        else navigateTo('AutoLogCenter');
      } else if (data?.type === 'log_nudge' || data?.screen === 'AddExpense') {
        navigateTo('AddExpense');
      } else if (data?.screen === 'Insights') {
        navigateTo('AppTabs', { screen: 'Insights' });
      } else if (data?.type === 'daily_reminder') {
        navigateTo('AppTabs', { screen: 'Home' });
      } else if (
        data?.screen === 'Savings' ||
        data?.type === 'budget_warning' ||
        data?.type === 'budget_exceeded' ||
        data?.type === 'savings_rollover' ||
        data?.type === 'gullak_reward'
      ) {
        const target = resolveSavingsRoute(isBudgetModeEnabled, data?.type);
        if (target === 'Home') {
          navigateTo('AppTabs', { screen: 'Home' });
        } else {
          navigateTo('Savings');
        }
      } else {
        navigateTo('Notifications');
      }
    });

    // P0.9 & P0.10: Global Auth Listener without deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Wrap in setTimeout(0) to avoid deadlocking Supabase internal auth lock
      setTimeout(async () => {
        if (event === 'SIGNED_OUT') {
          // Automatic Logging: session ended without the Log Out button (e.g. expired) — still mark the boundary.
          const prevUserId = useAuthStore.getState().user?.id;
          if (prevUserId) await onBeforeSignOut(prevUserId);
          await setSession(null);
          navigationRef.reset({
            index: 0,
            routes: [{ name: 'Auth' }],
          });
          return;
        }

        if (event === 'PASSWORD_RECOVERY') {
          navigateTo('ResetPassword');
          return;
        }

        if (event === 'TOKEN_REFRESHED') {
          await setSession(session);
          return;
        }

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
          await setSession(session);
          if (session?.user?.id) {
            // Skip full hydration for INITIAL_SESSION during Splash — SplashScreen handles it.
            // This prevents duplicate competing Supabase requests on slow connections.
            const currentRoute = navigationRef.getCurrentRoute()?.name;
            if (event === 'INITIAL_SESSION' && (!currentRoute || currentRoute === 'Splash')) {
              initAppLock(session.user.id);
              return;
            }

            // P0.3: load pending expenses after user is restored
            await useExpenseStore.getState().loadPendingExpenses();
            await fetchCategories(true);
            await Promise.all([
              fetchExpenses(),
              useDailyBudgetStore.getState().hydrateFromSupabase(session.user.id),
            ]);

            // Flush offline queue if online
            const isOffline = useNetworkStore.getState().isOffline;
            if (!isOffline) {
              useExpenseStore.getState().syncPendingExpenses();
            }

            // P1.5: Ask permission after login, not on cold app start
            if (event === 'SIGNED_IN') {
              setupNotifications();
            }
            initAppLock(session.user.id);
          }
        }
      }, 0);
    });

    // Initialize App Lock immediately on app launch
    initAppLock(useAuthStore.getState().user?.id);

    // AppState listener for auto-syncing and app lock (P0.3)
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      const loggedInUser = useAuthStore.getState().user;
      const { isAppLockEnabled: lockEnabled } = useAppLockStore.getState();

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (loggedInUser && lockEnabled) {
          lockApp();
        }
      } else if (nextAppState === 'active') {
        const isOffline = useNetworkStore.getState().isOffline;
        if (!isOffline && loggedInUser) {
          useExpenseStore.getState().syncPendingExpenses();
          useDailyBudgetStore.getState().uploadPendingDailyRecords();
        }
      }
    });

    // Start network listener
    const cleanupNetwork = useNetworkStore.getState().initNetworkListener();

    return () => {
      subscription.unsubscribe();
      appStateSub.remove();
      unregisterNotif();
      stopNotificationSync();
      stopQuickCategorySync();
      cleanupNetwork();
      unsubNetwork();
      versionAppStateSub.remove();
    };
  }, []);

  // Fonts load in a few ms from the bundle. Show the plain splash background meanwhile (no spinner flash
  // between the native splash and the animated Splash screen).
  if (!fontsLoaded) {
    return <View style={[styles.container, { backgroundColor: colors.background }]} />;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
    <SafeAreaProvider>
      <ErrorBoundary>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <OfflineBanner />
          <SyncFailedBanner />
          {updateRequirement.isRequired ? (
            <UpdateRequiredScreen
              currentVersion={Constants.expoConfig?.version || '1.2.3'}
              minVersion={updateRequirement.minVersion}
              releaseUrl={updateRequirement.releaseUrl}
              apkUrl={updateRequirement.apkUrl}
              title={updateRequirement.title}
              highlights={updateRequirement.highlights}
            />
          ) : (
            <AppNavigation />
          )}
          {/* Splash → app handoff cover (above the navigator, below the lock overlay) */}
          <SplashCover />
          <AppLockOverlay />
          <ConnectedOtaModal />
          <AppAlertModal />
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            translucent={true}
            backgroundColor="transparent"
          />
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
