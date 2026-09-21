import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable, Switch, Alert,
  Modal, TextInput, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  Camera, Tag, ChevronRight, Bell, Moon,
  CircleAlert, LogOut, Check, X, ArrowLeft, Trash2, ShieldCheck
} from 'lucide-react-native';

import Constants from 'expo-constants';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import { useExpenseStore, getPendingSyncCount } from '../store/expenseStore';
import { useNetworkStore } from '../store/networkStore';
import { RootStackParamList } from '../types';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { scheduleDailyReminder, cancelDailyReminder } from '../lib/notificationService';
import { useAppLockStore } from '../store/appLockStore';
import { useOtaStore } from '../store/otaStore';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, updateProfile, deleteAccount } = useAuthStore();
  const syncPendingExpenses = useExpenseStore((s) => s.syncPendingExpenses);
  const isOffline = useNetworkStore((s) => s.isOffline);
  const [isDeleting, setIsDeleting] = useState(false);
  const { colors, isDark, toggleTheme, setThemeMode } = useTheme();
  const handleScroll = useScrollDirection();
  const appVersion = Constants.expoConfig?.version ? `v${Constants.expoConfig.version}` : 'v1.2.3';

  // Local state for toggles with AsyncStorage persistence
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const isAppLockEnabled = useAppLockStore((s) => s.isAppLockEnabled);
  const isSupported = useAppLockStore((s) => s.isSupported);
  const isEnrolled = useAppLockStore((s) => s.isEnrolled);
  const setAppLockEnabled = useAppLockStore((s) => s.setAppLockEnabled);

  const handleToggleAppLock = async (val: boolean) => {
    if (val && !isSupported && !isEnrolled) {
      Alert.alert(
        'Not Supported',
        'Device me biometric ya screen lock (PIN/Pattern) setup nahi hai. Please pehle apne phone ki settings me screen lock enable karein.'
      );
      return;
    }

    const success = await setAppLockEnabled(val, user?.id);
    if (!success && val) {
      Alert.alert('Authentication Failed', 'App lock verify karne me problem hui.');
    }
  };

  useEffect(() => {
    AsyncStorage.getItem('@arthik_notifications_enabled').then((val) => {
      if (val !== null) {
        setNotificationsEnabled(val === 'true');
      }
    });
  }, []);

  const handleToggleNotifications = async (val: boolean) => {
    setNotificationsEnabled(val);
    await AsyncStorage.setItem('@arthik_notifications_enabled', val ? 'true' : 'false');
    if (val) {
      scheduleDailyReminder(20, 0);
    } else {
      cancelDailyReminder();
    }
  };

  // Edit Profile modal state
  const [editVisible, setEditVisible] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete Account confirmation modal state
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteEmailInput, setDeleteEmailInput] = useState('');
  const [deleteEmailError, setDeleteEmailError] = useState<string | null>(null);

  const handleLogout = async () => {
    const userId = user?.id;
    const pendingCount = userId ? await getPendingSyncCount(userId) : 0;

    const performSignOut = async () => {
      await signOut();
      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    };

    if (pendingCount > 0) {
      if (!isOffline) {
        Alert.alert(
          'Unsynced Data',
          `${pendingCount} entries abhi sync nahi hui hain. Logout karne par ye tab tak sync nahi hongi jab tak aap wapas login nahi karte.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sync Now',
              onPress: async () => {
                await syncPendingExpenses();
                Alert.alert('Synced', 'Aapka data sync ho gaya hai.', [
                  { text: 'OK' }
                ]);
              },
            },
            {
              text: 'Logout Anyway',
              style: 'destructive',
              onPress: performSignOut,
            },
          ]
        );
      } else {
        Alert.alert(
          'Unsynced Data',
          `${pendingCount} entries abhi sync nahi hui hain. Aap abhi offline hain. Logout karne par ye tab tak sync nahi hongi jab tak aap wapas login nahi karte.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Logout Anyway',
              style: 'destructive',
              onPress: performSignOut,
            },
          ]
        );
      }
      return;
    }

    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Log Out", 
          style: "destructive",
          onPress: performSignOut,
        }
      ]
    );
  };

  const handleDeleteAccount = () => {
    setDeleteEmailInput('');
    setDeleteEmailError(null);
    setDeleteModalVisible(true);
  };

  const handleConfirmEmailForDelete = () => {
    const targetEmail = (user?.email || '').trim().toLowerCase();
    const enteredEmail = deleteEmailInput.trim().toLowerCase();

    if (!enteredEmail) {
      setDeleteEmailError('Please enter your email to proceed.');
      return;
    }

    if (enteredEmail !== targetEmail) {
      setDeleteEmailError('Email does not match your registered account email.');
      return;
    }

    // Email confirmed. Close modal and prompt final confirmation.
    setDeleteModalVisible(false);

    Alert.alert(
      "Are you absolutely sure?",
      "This is your final confirmation. All your recorded expenses, daily budgets, savings, and custom categories will be completely erased. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, Delete Account",
          style: "destructive",
          onPress: executeDeleteAccount,
        },
      ]
    );
  };

  const executeDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteAccount();
      (navigation as any).reset({
        index: 0,
        routes: [{ name: 'Auth' }],
      });
    } catch (err: any) {
      Alert.alert(
        'Delete Account Failed',
        err?.message || 'Could not delete your account. Please check your network connection and try again or contact support.'
      );
    } finally {
      setIsDeleting(false);
    }
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
            <Text style={[styles.modalTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>Edit Profile</Text>
            <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>First Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border, fontFamily: FontFamily.medium }]}
              value={editFirstName}
              onChangeText={setEditFirstName}
              placeholder="First name"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
            <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>Last Name</Text>
            <TextInput
              style={[styles.modalInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border, fontFamily: FontFamily.medium }]}
              value={editLastName}
              onChangeText={setEditLastName}
              placeholder="Last name (optional)"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
            />
            <View style={styles.modalActions}>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.cardSubtle }]} onPress={() => setEditVisible(false)}>
                <X size={16} color={colors.textSecondary} />
                <Text style={[styles.modalCancelText, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.modalBtn, { backgroundColor: colors.mintGreen }]} onPress={handleSaveProfile} disabled={editSaving}>
                {editSaving ? <ActivityIndicator size="small" color={colors.forestGreen} /> : <Check size={16} color={colors.forestGreen} />}
                <Text style={[styles.modalSaveText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Delete Account Email Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isDeleting) setDeleteModalVisible(false);
        }}
      >
        <Pressable
          style={[styles.modalOverlay, { backgroundColor: isDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.5)' }]}
          onPress={() => {
            if (!isDeleting) setDeleteModalVisible(false);
          }}
        >
          <Pressable
            style={[styles.modalCard, { backgroundColor: colors.card, borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : '#FEE2E2' }]}
            onPress={() => {}}
          >
            {/* Warning Icon Badge */}
            <View style={[styles.deleteWarningIconWrap, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' }]}>
              <Trash2 size={22} color="#DC2626" />
            </View>

            <Text style={[styles.deleteModalTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Delete Account
            </Text>
            <Text style={[styles.deleteModalDesc, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              This action is permanent and cannot be undone. All your recorded expenses, daily budgets, savings, and custom categories will be completely erased.
            </Text>

            <Text style={[styles.modalLabel, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              Confirm by typing your registered email:
            </Text>

            {user?.email ? (
              <View style={[styles.deleteEmailBadge, { backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : colors.cardSubtle, borderColor: colors.border }]}>
                <Text style={[styles.deleteEmailBadgeText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                  {user.email}
                </Text>
              </View>
            ) : null}

            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.inputBg,
                  color: colors.textPrimary,
                  borderColor: deleteEmailError ? '#DC2626' : colors.border,
                  fontFamily: FontFamily.medium,
                  marginTop: Spacing.nano,
                },
              ]}
              value={deleteEmailInput}
              onChangeText={(text) => {
                setDeleteEmailInput(text);
                if (deleteEmailError) setDeleteEmailError(null);
              }}
              placeholder="Enter your email"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              editable={!isDeleting}
            />

            {deleteEmailError ? (
              <Text style={[styles.deleteErrorText, { color: '#DC2626', fontFamily: FontFamily.medium }]}>
                {deleteEmailError}
              </Text>
            ) : null}

            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: colors.cardSubtle }]}
                onPress={() => setDeleteModalVisible(false)}
                disabled={isDeleting}
              >
                <X size={16} color={colors.textSecondary} />
                <Text style={[styles.modalCancelText, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor:
                      (user?.email && deleteEmailInput.trim().toLowerCase() === user.email.trim().toLowerCase())
                        ? '#DC2626'
                        : (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2'),
                  },
                ]}
                onPress={handleConfirmEmailForDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator
                    size="small"
                    color={
                      (user?.email && deleteEmailInput.trim().toLowerCase() === user.email.trim().toLowerCase())
                        ? '#FFFFFF'
                        : '#DC2626'
                    }
                  />
                ) : (
                  <>
                    <Trash2
                      size={16}
                      color={
                        (user?.email && deleteEmailInput.trim().toLowerCase() === user.email.trim().toLowerCase())
                          ? '#FFFFFF'
                          : '#DC2626'
                      }
                    />
                    <Text
                      style={[
                        styles.modalSaveText,
                        {
                          color:
                            (user?.email && deleteEmailInput.trim().toLowerCase() === user.email.trim().toLowerCase())
                              ? '#FFFFFF'
                              : '#DC2626',
                          fontFamily: FontFamily.bold,
                        },
                      ]}
                    >
                      Continue
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
      
      <ScrollView 
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, Spacing.block) + Spacing.section },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        <View style={styles.headerRow}>
          <Pressable 
            style={styles.backBtn}
            onPress={() => navigation.goBack()}
          >
            <ArrowLeft size={28} color={colors.textPrimary} strokeWidth={2.5} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            Profile
          </Text>
        </View>

        {/* Profile Info Card */}
        <View style={[styles.profileCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          <View style={styles.avatarWrapper}>
            <View style={[styles.avatarCircle, { backgroundColor: colors.mintGreen }]}>
              {/* TODO: Render Image here if user has uploaded an avatar_url */}
              <Text style={[styles.avatarText, { fontFamily: FontFamily.bold }]}>
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

          <Text style={[styles.fullName, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            {fullName}
          </Text>
          <Text style={[styles.email, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
            {profile?.email || 'user@example.com'}
          </Text>

          <Pressable
            style={[styles.editProfileBtn, { borderColor: colors.mintGreenDark }]}
            onPress={openEditProfile}
          >
            <Text style={[styles.editProfileText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Edit Profile
            </Text>
          </Pressable>
        </View>

        {/* Account Settings Card */}
        <View style={[styles.settingsCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
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
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Manage Categories
            </Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>

          {/* 2. Notifications */}
          <View style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <Bell size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Notifications
            </Text>
            <Switch
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
              trackColor={{ false: colors.border, true: colors.mintGreen }}
              thumbColor={colors.white}
            />
          </View>

          {/* 3. Dark Mode */}
          <View style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <Moon size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
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

          {/* 4. App Lock (Biometric) */}
          <View style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <ShieldCheck size={18} color={colors.textPrimary} />
            </View>
            <View style={{ flex: 1, marginRight: Spacing.element }}>
              <Text style={[{ color: colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.body }]}>
                App Lock
              </Text>
              <Text style={{ fontSize: 12, color: colors.textSecondary, fontFamily: FontFamily.medium, marginTop: Spacing.nano }}>
                Fingerprint or Device PIN
              </Text>
            </View>
            <Switch
              value={isAppLockEnabled}
              onValueChange={handleToggleAppLock}
              trackColor={{ false: colors.border, true: colors.mintGreen }}
              thumbColor={colors.white}
            />
          </View>

          {/* 5. App Version */}
          <Pressable
            style={[styles.settingRow, styles.lastSettingRow]}
            onPress={() => useOtaStore.getState().showUpdateModal()}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <CircleAlert size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              App Version
            </Text>
            <Text style={[styles.versionText, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
              {appVersion}
            </Text>
          </Pressable>
        </View>

        {/* Log Out Button */}
        <Pressable style={[styles.logoutBtn, { backgroundColor: colors.peachSoft }]} onPress={handleLogout}>
          <LogOut size={18} color={colors.peachCoral} />
          <Text style={[styles.logoutText, { color: colors.peachCoral, fontFamily: FontFamily.bold }]}>
            Log Out
          </Text>
        </Pressable>

        {/* Delete Account Button (Required for Play Store / App Store compliance) */}
        <Pressable
          style={[styles.deleteAccountBtn, { borderColor: isDark ? 'rgba(239, 68, 68, 0.25)' : '#FEE2E2', backgroundColor: isDark ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2' }]}
          onPress={handleDeleteAccount}
          disabled={isDeleting}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color="#DC2626" />
          ) : (
            <>
              <Trash2 size={16} color="#DC2626" />
              <Text style={[styles.deleteAccountText, { color: '#DC2626', fontFamily: FontFamily.bold }]}>
                Delete Account
              </Text>
            </>
          )}
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
    paddingHorizontal: Spacing.gutter,
    paddingTop: Spacing.block,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.element,
  },
  backBtn: {
    marginRight: Spacing.block,
    marginTop: Spacing.micro,
  },
  headerTitle: {
    fontSize: FontSize.screenTitle,
  },

  // Profile Card
  profileCard: {
    borderRadius: BorderRadius.card,
    marginTop: Spacing.gutter,
    padding: Spacing.gutter,
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
    borderRadius: 40, // Circle geometry: width / 2
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
    borderRadius: 16, // Circle geometry: width / 2
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  fullName: {
    fontSize: 20,
    marginTop: Spacing.block,
  },
  email: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.micro,
  },
  editProfileBtn: {
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.gutter,
    paddingVertical: 10,
    marginTop: Spacing.block,
  },
  editProfileText: {
    fontSize: FontSize.bodySmall,
  },

  // Settings Card
  settingsCard: {
    borderRadius: BorderRadius.card,
    marginTop: Spacing.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    overflow: 'hidden',
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.surface,
    paddingTop: Spacing.surface,
    paddingBottom: Spacing.element,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.block,
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
    marginRight: Spacing.group,
  },
  settingLabel: {
    flex: 1,
    fontSize: FontSize.body,
  },
  versionText: {
    fontSize: FontSize.bodySmall,
  },

  // Logout
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.pill,
    paddingVertical: Spacing.surface,
    marginTop: Spacing.gutter,
    gap: Spacing.element,
  },
  logoutText: {
    fontSize: FontSize.body,
  },
  // Edit Profile Modal
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  modalCard: {
    borderRadius: BorderRadius.card,
    padding: Spacing.gutter,
    borderWidth: 1,
  },
  modalTitle: {
    fontSize: FontSize.sectionTitle,
    marginBottom: Spacing.surface,
  },
  modalLabel: {
    fontSize: FontSize.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.element,
    marginTop: Spacing.group,
  },
  modalInput: {
    borderRadius: 14,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.row,
    fontSize: FontSize.body,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.group,
    marginTop: Spacing.gutter,
  },
  modalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: BorderRadius.pill,
    paddingVertical: Spacing.row,
  },
  modalCancelText: {
    fontSize: 15,
  },
  modalSaveText: {
    color: '#1A2B4C',
    fontSize: 15,
  },
  deleteAccountBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.row,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    marginTop: 14,
    marginBottom: 40,
    gap: Spacing.element,
  },
  deleteAccountText: {
    fontSize: 15,
  },
  deleteWarningIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24, // Circle geometry: width / 2
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.element,
  },
  deleteModalTitle: {
    fontSize: FontSize.sectionTitle,
    marginBottom: Spacing.nano,
  },
  deleteModalDesc: {
    fontSize: FontSize.bodySmall,
    lineHeight: 18,
    marginBottom: Spacing.element,
  },
  deleteEmailBadge: {
    paddingHorizontal: Spacing.element,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    marginBottom: Spacing.element,
  },
  deleteEmailBadgeText: {
    fontSize: 13,
  },
  deleteErrorText: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.micro,
  },
});
