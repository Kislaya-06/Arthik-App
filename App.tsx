import React, { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { ActivityIndicator, StyleSheet, View, StatusBar, Alert, AppState } from 'react-native';
import * as Updates from 'expo-updates';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppNavigation, navigationRef, navigateTo } from './src/navigation';
import { Theme } from './src/config/theme';
import { useTheme } from './src/store/themeStore';
import { supabase } from './src/config/supabase';
import { useAuthStore } from './src/store/authStore';
import { useCategoryStore } from './src/store/categoryStore';
import { useExpenseStore } from './src/store/expenseStore';
import { useDailyBudgetStore } from './src/store/dailyBudgetStore';
import {
  scheduleDailyReminder,
  registerNotificationResponseListener,
  setupNotifications,
} from './src/lib/notificationService';
import Constants from 'expo-constants';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { OfflineBanner } from './src/components/OfflineBanner';
import { SyncFailedBanner } from './src/components/SyncFailedBanner';
import { useNetworkStore } from './src/store/networkStore';
import { checkAppVersionStatus, VersionCheckResult } from './src/lib/versionCheck';
import { UpdateRequiredScreen } from './src/screens/UpdateRequiredScreen';

export default function App() {
  const { colors, isDark } = useTheme();
  const setSession = useAuthStore((s) => s.setSession);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);

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

    async function checkForUpdates() {
      if (updateRequirement.isRequired) {
        return;
      }
      try {
        const update = await Updates.checkForUpdateAsync();
        if (update.isAvailable) {
          Alert.alert(
            'New Update Available 🎉',
            'We have squashed some bugs and added new features. Update now for the best experience!',
            [
              { text: 'Later', style: 'cancel' },
              {
                text: 'Update Now',
                onPress: async () => {
                  try {
                    await Updates.fetchUpdateAsync();
                    await Updates.reloadAsync();
                  } catch (e) {
                    Alert.alert('Update Failed', 'Could not apply the update. Please try again later.');
                  }
                },
              },
            ]
          );
        }
      } catch (e) {
        // Silently fail in case of network issues so it doesn't block the app
        if (__DEV__) console.log('Update check failed:', e);
      }
    }

    if (!__DEV__) {
      checkForUpdates();
    }

    // P1.5: Only schedule daily reminder if notifications toggle is enabled
    AsyncStorage.getItem('@arthik_notifications_enabled').then((val) => {
      if (val !== 'false') {
        scheduleDailyReminder(20, 0);
      }
    });

    // Handle user tapping on a device notification in notification shade
    const unregisterNotif = registerNotificationResponseListener((data) => {
      if (
        data?.screen === 'Savings' ||
        data?.type === 'budget_warning' ||
        data?.type === 'budget_exceeded' ||
        data?.type === 'savings_rollover'
      ) {
        navigateTo('Savings' as any);
      } else {
        navigateTo('Notifications' as any);
      }
    });

    // P0.9 & P0.10: Global Auth Listener without deadlock
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Wrap in setTimeout(0) to avoid deadlocking Supabase internal auth lock
      setTimeout(async () => {
        if (event === 'SIGNED_OUT') {
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
          }
        }
      }, 0);
    });

    // AppState listener for auto-syncing when returning to foreground (P0.3)
    const appStateSub = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        const isOffline = useNetworkStore.getState().isOffline;
        const currentUser = useAuthStore.getState().user;
        if (!isOffline && currentUser) {
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
      cleanupNetwork();
      unsubNetwork();
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
            />
          ) : (
            <AppNavigation />
          )}
          <StatusBar
            barStyle={isDark ? 'light-content' : 'dark-content'}
            translucent={true}
            backgroundColor="transparent"
          />
        </View>
      </ErrorBoundary>
    </SafeAreaProvider>
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
