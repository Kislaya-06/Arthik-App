import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { ActivityIndicator, StyleSheet, View, StatusBar, AppState } from 'react-native';
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
import { OtaUpdateModal } from './src/components/OtaUpdateModal';
import { useOtaStore } from './src/store/otaStore';
import { onBeforeSignOut } from './src/features/autoLog/service';

export default function App() {
  const { colors, isDark } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const isAppLockEnabled = useAppLockStore((s) => s.isAppLockEnabled);
  const isLocked = useAppLockStore((s) => s.isLocked);
  const initAppLock = useAppLockStore((s) => s.init);
  const lockApp = useAppLockStore((s) => s.lock);
  const authenticateAppLock = useAppLockStore((s) => s.authenticate);
  const currentUser = useAuthStore((s) => s.user);
  const [currentRoute, setCurrentRoute] = useState<string>('Splash');
  const ota = useOtaStore();

  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

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

    // Handle user tapping on a device notification in notification shade
    const unregisterNotif = registerNotificationResponseListener((data) => {
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

        if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') {
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
    let authTimeout: NodeJS.Timeout | null = null;
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      const loggedInUser = useAuthStore.getState().user;
      const { isAppLockEnabled: lockEnabled } = useAppLockStore.getState();

      if (nextAppState === 'background' || nextAppState === 'inactive') {
        if (authTimeout) {
          clearTimeout(authTimeout);
          authTimeout = null;
        }
        if (loggedInUser && lockEnabled) {
          lockApp();
        }
      } else if (nextAppState === 'active') {
        const isOffline = useNetworkStore.getState().isOffline;
        if (!isOffline && loggedInUser) {
          useExpenseStore.getState().syncPendingExpenses();
          useDailyBudgetStore.getState().uploadPendingDailyRecords();
        }
        const isSplash = (navigationRef.getCurrentRoute()?.name || 'Splash') === 'Splash';
        if (loggedInUser && lockEnabled && useAppLockStore.getState().isLocked && !isSplash) {
          if (authTimeout) clearTimeout(authTimeout);
          authTimeout = setTimeout(() => {
            if (AppState.currentState === 'active' && useAppLockStore.getState().isLocked) {
              authenticateAppLock();
            }
          }, 200);
        }
      }
    });

    // Start network listener
    const cleanupNetwork = useNetworkStore.getState().initNetworkListener();

    return () => {
      if (authTimeout) clearTimeout(authTimeout);
      subscription.unsubscribe();
      appStateSub.remove();
      unregisterNotif();
      stopNotificationSync();
      cleanupNetwork();
      unsubNetwork();
      versionAppStateSub.remove();
    };
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.mintGreen} />
      </View>
    );
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
            <AppNavigation
              onReady={() => {
                const route = navigationRef.getCurrentRoute()?.name || 'Splash';
                setCurrentRoute(route);
              }}
              onStateChange={() => {
                const route = navigationRef.getCurrentRoute()?.name || 'Splash';
                setCurrentRoute(route);
              }}
            />
          )}
          {Boolean((currentUser || useAuthStore.getState().user) && isAppLockEnabled && isLocked && currentRoute !== 'Splash') && (
            <AppLockOverlay />
          )}
          <OtaUpdateModal
            visible={ota.visible}
            updateInfo={ota.info}
            isDownloading={ota.isDownloading}
            downloadProgressText={ota.downloadText}
            error={ota.error}
            onUpdate={ota.applyUpdate}
            onDismiss={ota.hideUpdateModal}
            onRetry={ota.applyUpdate}
          />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
