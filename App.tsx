import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { ActivityIndicator, StyleSheet, View, StatusBar, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import * as Linking from 'expo-linking';
import { AppNavigation, navigationRef, navigateTo } from './src/navigation';
import { handleAuthDeepLink } from './src/lib/authLinkHandler';
import { Theme } from './src/config/theme';
import { useTheme } from './src/store/themeStore';
import { supabase } from './src/config/supabase';
import { useAuthStore } from './src/store/authStore';
import { useCategoryStore } from './src/store/categoryStore';
import { useExpenseStore } from './src/store/expenseStore';
import { useDailyBudgetStore } from './src/store/dailyBudgetStore';
import {
  setupNotifications,
  scheduleDailyReminder,
  registerNotificationResponseListener,
} from './src/lib/notificationService';

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

  useEffect(() => {
    async function checkForUpdates() {
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
        console.log('Update check failed:', e);
      }
    }

    if (!__DEV__) {
      checkForUpdates();
    }

    // Initialize notification channels and prompt for permission on app start
    const notifTimer = setTimeout(() => {
      setupNotifications().then((granted) => {
        if (granted) {
          scheduleDailyReminder(20, 0);
        }
      });
    }, 1000);

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

    // Listen for incoming deep links while the app is active / foregrounded
    const urlSub = Linking.addEventListener('url', (event) => {
      handleAuthDeepLink(event.url);
    });

    // Global Auth Listener
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user?.id) {
        useDailyBudgetStore.getState().hydrateFromSupabase(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      await setSession(session);
      if (session?.user?.id) {
        await Promise.all([
          fetchCategories(true),
          fetchExpenses(),
          useDailyBudgetStore.getState().hydrateFromSupabase(session.user.id),
        ]);
      }
      if (event === 'PASSWORD_RECOVERY') {
        navigateTo('ResetPassword');
      }
    });

    return () => {
      clearTimeout(notifTimer);
      subscription.unsubscribe();
      urlSub.remove();
      unregisterNotif();
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
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <AppNavigation />
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          translucent={true}
          backgroundColor="transparent"
        />
      </View>
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
