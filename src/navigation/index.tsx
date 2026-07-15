import React from 'react';

import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { RootStackParamList } from '../types';

// Import Screens
import { SplashScreen } from '../screens/SplashScreen';
import { OnboardingScreen } from '../screens/OnboardingScreen';
import { AuthScreen } from '../screens/AuthScreen';
import { ProfileSetupScreen } from '../screens/ProfileSetupScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { InsightsScreen } from '../screens/InsightsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { AddExpenseScreen } from '../screens/AddExpenseScreen';
import { EditExpenseScreen } from '../screens/EditExpenseScreen';
import { ExpenseDetailScreen } from '../screens/ExpenseDetailScreen';
import { CategoryDetailScreen } from '../screens/CategoryDetailScreen';
import { ManageCategoriesScreen } from '../screens/ManageCategoriesScreen';
import { AddEditCategoryScreen } from '../screens/AddEditCategoryScreen';

// Custom Tab Bar
import { BottomNavBar } from '../components/BottomNavBar';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <BottomNavBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen as React.ComponentType<any>} />
      <Tab.Screen name="History" component={HistoryScreen as React.ComponentType<any>} />

      <Tab.Screen name="Insights" component={InsightsScreen as React.ComponentType<any>} />
      <Tab.Screen name="Profile" component={ProfileScreen as React.ComponentType<any>} />
    </Tab.Navigator>
  );
}

export function AppNavigation() {
  return (
    <NavigationContainer>
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
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
        <Stack.Screen name="AppTabs" component={TabNavigator} />

        {/* Sub pages stack */}
        <Stack.Screen name="AddExpense" component={AddExpenseScreen} />
        <Stack.Screen name="EditExpense" component={EditExpenseScreen} />
        <Stack.Screen name="ExpenseDetail" component={ExpenseDetailScreen} />
        <Stack.Screen name="CategoryDetail" component={CategoryDetailScreen} />
        <Stack.Screen name="ManageCategories" component={ManageCategoriesScreen} />
        <Stack.Screen name="AddEditCategory" component={AddEditCategoryScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
