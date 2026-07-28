import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, BellOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = NativeStackScreenProps<RootStackParamList, 'Notifications'>;

export const NotificationsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { marginTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <ArrowLeft size={24} color="#1A2B4C" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: 'Quicksand_700Bold' }]}>
          Notifications
        </Text>
      </View>

      {/* Empty State */}
      <View style={styles.emptyContainer}>
        <View style={styles.iconCircle}>
          <BellOff size={32} color="#8A8FA3" />
        </View>
        <Text style={[styles.emptyTitle, { fontFamily: 'Quicksand_700Bold' }]}>
          No new notifications
        </Text>
        <Text style={[styles.emptySubtitle, { fontFamily: 'Quicksand_500Medium' }]}>
          You're all caught up! We'll let you know when something new arrives.
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  backButton: {
    position: 'absolute',
    left: 24,
  },
  headerTitle: {
    fontSize: 20,
    color: '#1A2B4C',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    marginTop: -80, // slightly lift it up visually
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    color: '#1A2B4C',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: '#8A8FA3',
    textAlign: 'center',
    lineHeight: 22,
  },
});
