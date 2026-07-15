import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';
import { ActivityIndicator, StyleSheet, View, StatusBar, Alert } from 'react-native';
import * as Updates from 'expo-updates';
import { AppNavigation } from './src/navigation';
import { Theme } from './src/config/theme';

export default function App() {
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
  }, []);

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
