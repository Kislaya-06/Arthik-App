import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { ActivityIndicator, StyleSheet, View, StatusBar } from 'react-native';
import { AppNavigation } from './src/navigation';
import { Theme } from './src/config/theme';

export default function App() {
  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Theme.colors.mintGreen} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <View style={styles.container}>
        <AppNavigation />
        <StatusBar barStyle="dark-content" translucent={true} backgroundColor="transparent" />
      </View>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Theme.colors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Theme.colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
