import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { CompositeScreenProps } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Camera, Tag, ChevronRight, Bell, Moon,
  Shield, FileText, CircleAlert, LogOut,
} from 'lucide-react-native';

import { useAuthStore } from '../store/authStore';
import { isMockMode } from '../config/supabase';
import { TabParamList, RootStackParamList } from '../types';
import { useScrollDirection } from '../hooks/useScrollDirection';

type Props = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, 'Profile'>,
  NativeStackScreenProps<RootStackParamList>
>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { profile, user, signOut } = useAuthStore();
  const handleScroll = useScrollDirection();

  // Local state for toggles
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: async () => {
            await signOut();
            // Reset nav stack and go to Auth (parent stack route)
            (navigation as any).reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            });
          }
        }
      ]
    );
  };

  const getInitials = () => {
    if (!profile) return 'U';
    const first = profile.first_name ? profile.first_name.charAt(0).toUpperCase() : '';
    const last = profile.last_name ? profile.last_name.charAt(0).toUpperCase() : '';
    return `${first}${last}` || 'U';
  };

  let fullName = 'User';
  if (profile) {
    fullName = `${profile.first_name} ${profile.last_name || ''}`.trim();
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Text style={[styles.headerTitle, { fontFamily: 'Quicksand_700Bold' }]}>
          Profile
        </Text>

        {/* Profile Info Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarCircle}>
              {/* TODO: Render Image here if user has uploaded an avatar_url */}
              <Text style={[styles.avatarText, { fontFamily: 'Quicksand_700Bold' }]}>
                {getInitials()}
              </Text>
            </View>
            <Pressable 
              style={styles.cameraBadge}
              onPress={() => {
                // TODO: Expo Image Picker integration
                console.log('Open image picker');
              }}
            >
              <Camera size={14} color="#FFFFFF" />
            </Pressable>
          </View>

          <Text style={[styles.fullName, { fontFamily: 'Quicksand_700Bold' }]}>
            {fullName}
          </Text>
          <Text style={[styles.email, { fontFamily: 'Quicksand_500Medium' }]}>
            {profile?.email || 'user@example.com'}
          </Text>

          <Pressable 
            style={styles.editProfileBtn}
            onPress={() => {
              // TODO: Navigate to Edit Profile screen
              console.log('Edit profile');
            }}
          >
            <Text style={[styles.editProfileText, { fontFamily: 'Quicksand_700Bold' }]}>
              Edit Profile
            </Text>
          </Pressable>
        </View>

        {/* Account Settings Card */}
        <View style={styles.settingsCard}>
          <Text style={[styles.sectionLabel, { fontFamily: 'Quicksand_700Bold' }]}>
            ACCOUNT
          </Text>

          {/* 1. Manage Categories */}
          <Pressable 
            style={styles.settingRow}
            onPress={() => navigation.navigate('ManageCategories')}
          >
            <View style={styles.iconContainer}>
              <Tag size={18} color="#1A2B4C" />
            </View>
            <Text style={[styles.settingLabel, { fontFamily: 'Quicksand_700Bold' }]}>
              Manage Categories
            </Text>
            <ChevronRight size={18} color="#8A8FA3" />
          </Pressable>

          {/* 2. Notifications */}
          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Bell size={18} color="#1A2B4C" />
            </View>
            <Text style={[styles.settingLabel, { fontFamily: 'Quicksand_700Bold' }]}>
              Notifications
            </Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: '#E0E2E8', true: '#B8E0C8' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 3. Dark Mode */}
          <View style={styles.settingRow}>
            <View style={styles.iconContainer}>
              <Moon size={18} color="#1A2B4C" />
            </View>
            <Text style={[styles.settingLabel, { fontFamily: 'Quicksand_700Bold' }]}>
              Dark Mode
            </Text>
            <Switch
              value={darkModeEnabled}
              onValueChange={setDarkModeEnabled}
              trackColor={{ false: '#E0E2E8', true: '#B8E0C8' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* 4. Privacy Policy */}
          <Pressable 
            style={styles.settingRow}
            onPress={() => {
              // TODO: Open Privacy Policy
            }}
          >
            <View style={styles.iconContainer}>
              <Shield size={18} color="#1A2B4C" />
            </View>
            <Text style={[styles.settingLabel, { fontFamily: 'Quicksand_700Bold' }]}>
              Privacy Policy
            </Text>
            <ChevronRight size={18} color="#8A8FA3" />
          </Pressable>

          {/* 5. Terms of Service */}
          <Pressable 
            style={styles.settingRow}
            onPress={() => {
              // TODO: Open Terms of Service
            }}
          >
            <View style={styles.iconContainer}>
              <FileText size={18} color="#1A2B4C" />
            </View>
            <Text style={[styles.settingLabel, { fontFamily: 'Quicksand_700Bold' }]}>
              Terms of Service
            </Text>
            <ChevronRight size={18} color="#8A8FA3" />
          </Pressable>

          {/* 6. App Version */}
          <View style={[styles.settingRow, styles.lastSettingRow]}>
            <View style={styles.iconContainer}>
              <CircleAlert size={18} color="#1A2B4C" />
            </View>
            <Text style={[styles.settingLabel, { fontFamily: 'Quicksand_700Bold' }]}>
              App Version
            </Text>
            <Text style={[styles.versionText, { fontFamily: 'Quicksand_500Medium' }]}>
              v1.0.0
            </Text>
          </View>
        </View>

        {/* Log Out Button */}
        <Pressable style={styles.logoutBtn} onPress={handleLogout}>
          <LogOut size={18} color="#F4B8AE" />
          <Text style={[styles.logoutText, { fontFamily: 'Quicksand_700Bold' }]}>
            Log Out
          </Text>
        </Pressable>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 120, // Bottom spacing for tab bar
  },
  headerTitle: {
    fontSize: 30,
    color: '#1A2B4C',
  },

  // Profile Card
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginTop: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#B8E0C8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 24,
    color: '#1A2B4C',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1A2B4C',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  fullName: {
    fontSize: 20,
    color: '#1A2B4C',
    marginTop: 16,
  },
  email: {
    fontSize: 14,
    color: '#8A8FA3',
    marginTop: 4,
  },
  editProfileBtn: {
    borderWidth: 1,
    borderColor: '#B8E0C8',
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 16,
  },
  editProfileText: {
    fontSize: 14,
    color: '#1A2B4C',
  },

  // Settings Card
  settingsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: 12,
    color: '#8A8FA3',
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  lastSettingRow: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F2F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
    color: '#1A2B4C',
  },
  versionText: {
    fontSize: 14,
    color: '#B0B4C0',
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDEEEC',
    borderRadius: 999,
    paddingVertical: 20,
    marginTop: 24,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    color: '#F4B8AE',
  },
});
