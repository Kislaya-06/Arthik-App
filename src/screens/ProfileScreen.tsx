import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert,
  Modal, TextInput, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Camera, Tag, ChevronRight, Bell, Moon,
  CircleAlert, LogOut, Check, X, ArrowLeft
} from 'lucide-react-native';

import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import { RootStackParamList } from '../types';
import { useScrollDirection } from '../hooks/useScrollDirection';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { profile, signOut, updateProfile } = useAuthStore();
  const { colors, isDark, toggleTheme, setThemeMode } = useTheme();
  const handleScroll = useScrollDirection();
  const appVersion = 'v1.2.0';

  // Local state for toggles
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Edit Profile modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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

  const openEditProfile = () => {
    setEditFirstName(profile?.first_name || '');
    setEditLastName(profile?.last_name || '');
    setEditVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!editFirstName.trim()) return;
    setEditSaving(true);
    try {
      await updateProfile(editFirstName.trim(), editLastName.trim());
      setEditVisible(false);
    } catch {
      Alert.alert('Error', 'Could not update profile. Please try again.');
    } finally {
      setEditSaving(false);
    }
  };

  let fullName = 'User';
  if (profile) {
    fullName = `${profile.first_name} ${profile.last_name || ''}`.trim();
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Edit Profile Modal */}
      <Modal visible={editVisible} transparent animationType="fade" onRequestClose={() => setEditVisible(false)}>
        <Pressable style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.4)' }]} onPress={() => setEditVisible(false)}>
          <Pressable style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>Edit Profile</Text>
            <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>First Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border, fontFamily: 'Quicksand_500Medium' }]}
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="First name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
            <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>Last Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border, fontFamily: 'Quicksand_500Medium' }]}
              value={editLastName}
              onChangeText={setEditLastName}
              placeholder="Last name (optional)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.cardSubtle }]} onPress={() => setEditVisible(false)}>
                <X size={16} color={colors.textSecondary} />
                <Text style={[styles.modalCancelText, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.mintGreen }]} onPress={handleSaveProfile} disabled={editSaving}>
                {editSaving ? <ActivityIndicator size="small" color={colors.forestGreen} /> : <Check size={16} color={colors.forestGreen} />}
                <Text style={[styles.modalSaveText, { color: colors.forestGreen, fontFamily: 'Quicksand_700Bold' }]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 16) + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <View style={styles.headerRow}>
          <Pressable 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={28} color={colors.textPrimary} strokeWidth={2.5} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
            Profile
          </Text>
        </View>

        {/* Profile Info Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.mintGreen }]}>
              {/* TODO: Render Image here if user has uploaded an avatar_url */}
              <Text style={[styles.avatarText, { fontFamily: 'Quicksand_700Bold' }]}>
                {getInitials()}
              </Text>
            </View>
            <Pressable
              style={[styles.cameraBadge, { backgroundColor: colors.cardSubtle, borderColor: colors.card }]}
              onPress={openEditProfile}
              hitSlop={8}
            >
              <Camera size={14} color={colors.textPrimary} />
            </Pressable>
          </View>

          <Text style={[styles.fullName, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
            {fullName}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
            {profile?.email || 'user@example.com'}
          </Text>

          <Pressable
            style={[styles.editProfileBtn, { borderColor: colors.mintGreenDark }]}
            onPress={openEditProfile}
          >
            <Text style={[styles.editProfileText, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
              Edit Profile
            </Text>
          </Pressable>
        </View>

        {/* Account Settings Card */}
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>
            ACCOUNT
          </Text>

          {/* 1. Manage Categories */}
          <Pressable 
            style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}
            onPress={() => navigation.navigate('ManageCategories')}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <Tag size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
              Manage Categories
            </Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>

          {/* 2. Notifications */}
          <View style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <Bell size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
              Notifications
            </Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
              trackColor={{ false: colors.border, true: colors.mintGreen }}
              thumbColor={colors.white}
            />
          </View>

          {/* 3. Dark Mode */}
          <View style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <Moon size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
              Dark Mode
            </Text>
            <Switch
              value={isDark}
              onValueChange={(val) => {
                setThemeMode(val ? 'dark' : 'light');
              }}
              trackColor={{ false: colors.border, true: colors.mintGreen }}
              thumbColor={colors.white}
            />
          </View>

          {/* 4. App Version */}
          <View style={[styles.settingRow, styles.lastSettingRow]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <CircleAlert size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
              App Version
            </Text>
            <Text style={[styles.versionText, { color: colors.textMuted, fontFamily: 'Quicksand_500Medium' }]}>
              {appVersion}
            </Text>
          </View>
        </View>

        {/* Log Out Button */}
        <Pressable style={[styles.logoutBtn, { backgroundColor: colors.peachSoft }]} onPress={handleLogout}>
          <LogOut size={18} color={colors.peachCoral} />
          <Text style={[styles.logoutText, { color: colors.peachCoral, fontFamily: 'Quicksand_700Bold' }]}>
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
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backBtn: {
    marginRight: 16,
    marginTop: 4,
  },
  headerTitle: {
    fontSize: 30,
  },

  // Profile Card
  profileCard: {
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
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  fullName: {
    fontSize: 20,
    marginTop: 16,
  },
  email: {
    fontSize: 14,
    marginTop: 4,
  },
  editProfileBtn: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 16,
  },
  editProfileText: {
    fontSize: 14,
  },

  // Settings Card
  settingsCard: {
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
  },
  lastSettingRow: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingLabel: {
    flex: 1,
    fontSize: 16,
  },
  versionText: {
    fontSize: 14,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    paddingVertical: 20,
    marginTop: 24,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
  },
  // Edit Profile Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: 20,
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 12,
  },
  modalInput: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 999,
    paddingVertical: 14,
  },
  modalCancelText: {
    fontSize: 15,
  },
  modalSaveText: {
    color: '#1A2B4C',
    fontSize: 15,
  },
});
