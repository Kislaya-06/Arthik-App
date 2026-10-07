import React, { useMemo } from 'react';
import { NavigationContainer, LinkingOptions, getStateFromPath, DefaultTheme, DarkTheme, useFocusEffect, CommonActions, CompositeScreenProps } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';
import { createBottomTabNavigator, BottomTabBarProps, BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { RootStackParamList, TabParamList } from '../types';
import { handleAuthDeepLink } from '../lib/authLinkHandler';
import { navigationRef, navigateTo } from './navigationRef';
import { useTheme } from '../store/themeStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';

// Import Screens
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { ExpenseFormScreen } from '../screens/ExpenseFormScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { CategoryDetailScreen } from '../screens/CategoryDetailScreen';
import { ManageCategoriesScreen } from '../screens/ManageCategoriesScreen';
import { AddEditCategoryScreen } from '../screens/AddEditCategoryScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ResetPasswordScreen } from '../screens/ResetPasswordScreen';
import { SavingsScreen } from '../screens/SavingsScreen';
import { FaqScreen } from '../screens/FaqScreen';
import { GullakDepositDetailScreen } from '../screens/GullakDepositDetailScreen';
import { AutoLogCenterScreen } from '../screens/autolog/AutoLogCenterScreen';
import { AutoLogIntroScreen } from '../screens/autolog/AutoLogIntroScreen';
import { AutoLogEmailScreen } from '../screens/autolog/AutoLogEmailScreen';
import { AutoLogSetupScreen } from '../screens/autolog/AutoLogSetupScreen';
import { AutoLogWelcomeBackScreen } from '../screens/autolog/AutoLogWelcomeBackScreen';
import { AutoLogReviewScreen } from '../screens/autolog/AutoLogReviewScreen';
import { AutoLogAccountsScreen } from '../screens/autolog/AutoLogAccountsScreen';
import { AutoLogInfoScreen } from '../screens/autolog/AutoLogInfoScreen';
import { AutoLogGate } from '../components/autolog/AutoLogGate';

// Custom Tab Bar
import { BottomNavBar } from '../components/BottomNavBar';

export { navigationRef, navigateTo };

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const renderTabBar = (props: BottomTabBarProps) => <BottomNavBar {...props} />;

const GuardedSavingsTabScreen: React.FC<BottomTabScreenProps<TabParamList, 'Savings'>> = (props) => {
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const navigation = props.navigation;

  const redirectToHome = React.useCallback(() => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.navigate({
          name: 'AppTabs',
          params: { screen: 'Home' },
        })
      );
    } else {
      navigation.navigate('Home');
    }
  }, [navigation]);

  React.useEffect(() => {
    if (!isBudgetModeEnabled) {
      redirectToHome();
    }
  }, [isBudgetModeEnabled, redirectToHome]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isBudgetModeEnabled) {
        redirectToHome();
      }
    }, [isBudgetModeEnabled, redirectToHome])
  );

  if (!isBudgetModeEnabled) {
    return null;
  }

  return <SavingsScreen {...(props as unknown as CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Savings'>, NativeStackScreenProps<RootStackParamList>>)} />;
};

const GuardedSavingsStackScreen: React.FC<NativeStackScreenProps<RootStackParamList, 'Savings'>> = (props) => {
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const navigation = props.navigation;

  const redirectToHome = React.useCallback(() => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(
        CommonActions.navigate({
          name: 'AppTabs',
          params: { screen: 'Home' },
        })
      );
    } else {
      try {
        navigation.navigate('AppTabs', { screen: 'Home' });
      } catch {
        navigation.navigate('AppTabs', { screen: 'Home' });
      }
    }
  }, [navigation]);

  React.useEffect(() => {
    if (!isBudgetModeEnabled) {
      redirectToHome();
    }
  }, [isBudgetModeEnabled, redirectToHome]);

  useFocusEffect(
    React.useCallback(() => {
      if (!isBudgetModeEnabled) {
        redirectToHome();
      }
    }, [isBudgetModeEnabled, redirectToHome])
  );

  if (!isBudgetModeEnabled) {
    return null;
  }

  return <SavingsScreen {...(props as unknown as CompositeScreenProps<BottomTabScreenProps<TabParamList, 'Savings'>, NativeStackScreenProps<RootStackParamList>>)} />;
};

function TabNavigator() {
  return (
    <>
    <AutoLogGate />
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{
        headerShown: false,
        freezeOnBlur: true,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="History" component={HistoryScreen} />
      <Tab.Screen name="Savings" component={GuardedSavingsTabScreen} />
      <Tab.Screen name="Insights" component={InsightsScreen} />
    </Tab.Navigator>
    </>
  );
}

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['arthik://', 'https://arthik.app'],
  config: {
    screens: {
      ResetPassword: 'reset-password',
      Auth: 'auth',
      AppTabs: 'tabs',
    },
  },
  async getInitialURL() {
    const url = await Linking.getInitialURL();
    if (url) {
      await handleAuthDeepLink(url);
    }
    return url;
  },
  subscribe(listener) {
    const onReceiveURL = async ({ url }: { url: string }) => {
      const handled = await handleAuthDeepLink(url);
      if (!handled) {
        listener(url);
      }
    };
    const eventListener = Linking.addEventListener('url', onReceiveURL);
    return () => {
      eventListener.remove();
    };
  },
  getStateFromPath: (path, options) => {
    const lower = path.toLowerCase();
    if (lower.includes('reset-password') || lower.includes('recovery')) {
      return {
        routes: [{ name: 'ResetPassword' }],
      };
    }
    return getStateFromPath(path, options);
  },
};

export function AppNavigation({
  onStateChange,
  onReady,
}: {
  onStateChange?: () => void;
  onReady?: () => void;
} = {}) {
  const { isDark, colors } = useTheme();

  const navTheme = useMemo(() => ({
    ...(isDark ? DarkTheme : DefaultTheme),
    colors: {
      ...(isDark ? DarkTheme.colors : DefaultTheme.colors),
      background: colors.background,
      card: colors.card,
      text: colors.textPrimary,
      border: colors.border,
      primary: colors.mintGreen,
    },
  }), [isDark, colors]);

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      theme={navTheme}
      onStateChange={onStateChange}
      onReady={onReady}
    >
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right',
        }}
        initialRouteName="Splash"
      >
        <Stack.Screen name="Splash" component={SplashScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="Auth" component={AuthScreen} options={{ animation: 'fade' }} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="AppTabs" component={TabNavigator} options={{ animation: 'fade' }} />

        {/* Sub pages stack */}
        <Stack.Screen name="AddExpense" component={ExpenseFormScreen as React.ComponentType<NativeStackScreenProps<RootStackParamList, 'AddExpense'>>} />
        <Stack.Screen name="EditExpense" component={ExpenseFormScreen as React.ComponentType<NativeStackScreenProps<RootStackParamList, 'EditExpense'>>} />
        <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
        <Stack.Screen name="GullakDepositDetail" component={GullakDepositDetailScreen} />
        <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
        <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
        <Stack.Screen name="AddEditCategory" component={AddEditCategoryScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Savings" component={GuardedSavingsStackScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
        <Stack.Screen name="Faq" component={FaqScreen} />

        {/* Automatic Logging */}
        <Stack.Screen name="AutoLogCenter" component={AutoLogCenterScreen} />
        <Stack.Screen name="AutoLogIntro" component={AutoLogIntroScreen} options={{ animation: 'fade_from_bottom' }} />
        <Stack.Screen name="AutoLogSetup" component={AutoLogSetupScreen} options={{ gestureEnabled: false }} />
        <Stack.Screen name="AutoLogWelcomeBack" component={AutoLogWelcomeBackScreen} options={{ gestureEnabled: false, animation: 'fade_from_bottom' }} />
        <Stack.Screen name="AutoLogReview" component={AutoLogReviewScreen} />
        <Stack.Screen name="AutoLogEmail" component={AutoLogEmailScreen} />
        <Stack.Screen name="AutoLogAccounts" component={AutoLogAccountsScreen} />
        <Stack.Screen name="AutoLogInfo" component={AutoLogInfoScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
