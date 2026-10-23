import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, ScrollView, Pressable, Alert,
  ActivityIndicator,
} from 'react-native';
import { formatCurrency } from '../lib/formatters';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import Tag from 'lucide-react-native/icons/tag';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Bell from 'lucide-react-native/icons/bell';
import Moon from 'lucide-react-native/icons/moon';
import Sun from 'lucide-react-native/icons/sun';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Palette from 'lucide-react-native/icons/palette';
import CircleAlert from 'lucide-react-native/icons/circle-alert';
import LogOut from 'lucide-react-native/icons/log-out';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Trash2 from 'lucide-react-native/icons/trash';
import ShieldCheck from 'lucide-react-native/icons/shield-check';
import HelpCircle from 'lucide-react-native/icons/circle-question-mark';
import Waves from 'lucide-react-native/icons/waves-horizontal';
import Zap from 'lucide-react-native/icons/zap';
import SquarePen from 'lucide-react-native/icons/square-pen';

import Constants from 'expo-constants';
import { Spacing, FontSize, FontFamily, ControlHeight } from '../config/theme';
import { useAuthStore } from '../store/authStore';
import { useTheme } from '../store/themeStore';
import { useAmbientStore } from '../store/ambientStore';
import { useExpenseStore, getPendingSyncCount } from '../store/expenseStore';
import { useNetworkStore } from '../store/networkStore';
import { RootStackParamList } from '../types';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { setupNotifications } from '../lib/notificationService';
import { setNotificationsEnabled as applyNotificationsEnabled } from '../lib/notificationSync';
import { useAppLockStore } from '../store/appLockStore';
import { useOtaStore } from '../store/otaStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { BudgetEditModal } from '../components/BudgetEditModal';
import { MoneyHelpBadge, MoneyExplainerModal } from '../components/MoneyExplainerModal';
import { formatCadenceBudgetSubtitle } from '../lib/budgetModeUtils';
import { AnimatedToggle } from '../components/AnimatedToggle';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { useAutoLogStore } from '../features/autoLog/store';
import { onBeforeSignOut } from '../features/autoLog/service';
import { modeCopy } from '../features/autoLog/copy';
import { BetaPill } from '../components/autolog/AutoLogUi';
import { PauseBudgetModal } from '../components/profile/PauseBudgetModal';
import { EditProfileModal } from '../components/profile/EditProfileModal';
import { DeleteAccountModal } from '../components/profile/DeleteAccountModal';
import { getDisplayName, validateProfileName } from '../lib/profileUtils';
import { styles } from './ProfileScreen.styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Profile'>;

export const ProfileScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const signOut = useAuthStore((s) => s.signOut);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const deleteAccount = useAuthStore((s) => s.deleteAccount);
  const autoLogMode = useAutoLogStore((s) => s.mode);
  const autoLogAttention = useAutoLogStore((s) => s.attention);
  const autoLogPending = useAutoLogStore((s) => s.pendingCount);
  const autoLogAvailable = useAutoLogStore((s) => s.available);
  const syncPendingExpenses = useExpenseStore((s) => s.syncPendingExpenses);
  const isOffline = useNetworkStore((s) => s.isOffline);
  const [isDeleting, setIsDeleting] = useState(false);
  const { colors, isDark, setThemeMode, themeMode, effectiveScheme } = useTheme();
  const activeTheme = themeMode === 'system' ? effectiveScheme : themeMode;
  const handleScroll = useScrollDirection();
  const appVersion = Constants.expoConfig?.version ? `v${Constants.expoConfig.version}` : 'v1.2.3';

  // Local state for toggles with AsyncStorage persistence
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const ambientEnabled = useAmbientStore((s) => s.enabled);
  const setAmbientEnabled = useAmbientStore((s) => s.setEnabled);
  const isAppLockEnabled = useAppLockStore((s) => s.isAppLockEnabled);
  const isSupported = useAppLockStore((s) => s.isSupported);
  const isEnrolled = useAppLockStore((s) => s.isEnrolled);
  const setAppLockEnabled = useAppLockStore((s) => s.setAppLockEnabled);
  const [showMoneyExplainer, setShowMoneyExplainer] = useState(false);

  // Smart Budget & Gullak mode state
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const weeklyBudgetAmount = useDailyBudgetStore((s) => s.weeklyBudgetAmount);
  const monthlyBudgetAmount = useDailyBudgetStore((s) => s.monthlyBudgetAmount);
  const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);
  const savingsStreak = useDailyBudgetStore((s) => s.savingsStreak);
  const setBudgetModeEnabled = useDailyBudgetStore((s) => s.setBudgetModeEnabled);
  const getCarryableAmount = useDailyBudgetStore((s) => s.getCarryableAmount);
  const getPendingPlanChange = useDailyBudgetStore((s) => s.getPendingPlanChange);
  const cancelPendingPlanChange = useDailyBudgetStore((s) => s.cancelPendingPlanChange);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);

  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [pauseModalVisible, setPauseModalVisible] = useState(false);

  const pendingPlanChange = useMemo(() => getPendingPlanChange(), [getPendingPlanChange, planChanges]);
  const isScheduledSwitch = Boolean(pendingPlanChange && pendingPlanChange.isEnabled !== isBudgetModeEnabled);
  const toggleValue = isScheduledSwitch ? pendingPlanChange!.isEnabled : isBudgetModeEnabled;

  const currentCadenceAmount =
    budgetCadence === 'weekly'
      ? weeklyBudgetAmount
      : budgetCadence === 'monthly'
      ? monthlyBudgetAmount
      : dailyBudgetAmount;

  let budgetSubtitle = formatCadenceBudgetSubtitle(
    isBudgetModeEnabled,
    budgetCadence,
    currentCadenceAmount
  );

  if (isScheduledSwitch && pendingPlanChange) {
    if (pendingPlanChange.isEnabled) {
      const cLabel = pendingPlanChange.cadence.charAt(0).toUpperCase() + pendingPlanChange.cadence.slice(1);
      const amtStr = pendingPlanChange.amount > 0 ? ` · ${formatCurrency(pendingPlanChange.amount)}` : '';
      budgetSubtitle = `Activating tomorrow (${cLabel}${amtStr}) · Tap to cancel`;
    } else {
      budgetSubtitle = 'Switching to Pure Mode tomorrow · Tap to cancel';
    }
  }

  const handleToggleBudgetMode = (val: boolean) => {
    if (isScheduledSwitch) {
      setBudgetModeEnabled(val);
      return;
    }

    if (!val) {
      if (totalAccumulatedSavings > 0 || savingsStreak > 0) {
        setPauseModalVisible(true);
      } else {
        setBudgetModeEnabled(false);
      }
    } else {
      setBudgetModalVisible(true);
    }
  };

  const handleToggleAppLock = async (val: boolean) => {
    if (val && !isSupported && !isEnrolled) {
      Alert.alert(
        'Not Supported',
        'Device lock (Biometric/PIN/Pattern) is not set up on this device. Please enable screen lock in your device settings.'
      );
      return;
    }

    const success = await setAppLockEnabled(val, user?.id);
    if (!success && val) {
      Alert.alert('Authentication Failed', 'Could not verify app lock credentials.');
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
    if (val) {
      await setupNotifications(); // asks for the OS permission if it was never granted
    }
    // Saves the preference and rebuilds (on) or cancels (off) every scheduled notification.
    await applyNotificationsEnabled(val);
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
    const autoLogActive = ['live', 'paused'].includes(useAutoLogStore.getState().mode);

    const performSignOut = async () => {
      // Automatic Logging: record the sign-out boundary and stop capturing BEFORE the session ends.
      if (userId) await onBeforeSignOut(userId);
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
          `${pendingCount} entries have not synced yet. If you log out now, they will not sync until you log back in.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sync Now',
              onPress: async () => {
                await syncPendingExpenses();
                Alert.alert('Synced', 'Your data has been synced successfully.', [
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
          `${pendingCount} entries have not synced yet and you are currently offline. If you log out now, they will not sync until you log back in.`,
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
      autoLogActive ? "Automatic Logging will stop" : "Log Out",
      autoLogActive
        ? "While you're signed out:\n• No transactions will be logged.\n• New SMS won't create transactions.\n• Payment notifications won't be logged.\n\nWhen you sign in again, you can decide what to do about the time you were away."
        : "Are you sure you want to log out?",
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
      "This is your final confirmation. All your recorded expenses, budgets, savings, and custom categories will be completely erased. This action cannot be undone.",
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
    const validation = validateProfileName(editFirstName, editLastName);
    if (!validation.isValid) return;
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

  const fullName = getDisplayName(profile, user?.user_metadata, user?.email);

  const isEmailMatching = Boolean(user?.email && deleteEmailInput.trim().toLowerCase() === user.email.trim().toLowerCase());
  const deleteBtnBg = isEmailMatching ? '#DC2626' : (isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2');
  const deleteBtnColor = isEmailMatching ? '#FFFFFF' : '#DC2626';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Budget Edit Modal */}
      <BudgetEditModal
        visible={budgetModalVisible}
        initialAmount={currentCadenceAmount}
        onClose={() => setBudgetModalVisible(false)}
      />

      {/* Pause Smart Budget & Gullak Confirmation Modal */}
      <PauseBudgetModal
        visible={pauseModalVisible}
        onClose={() => setPauseModalVisible(false)}
        totalAccumulatedSavings={totalAccumulatedSavings}
        budgetCadence={budgetCadence}
        getCarryableAmount={getCarryableAmount}
        onTurnOff={() => {
          setPauseModalVisible(false);
          setBudgetModeEnabled(false);
        }}
        onOpenMoneyExplainer={() => setShowMoneyExplainer(true)}
        colors={colors}
        isDark={isDark}
        styles={styles}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        visible={editVisible}
        onClose={() => setEditVisible(false)}
        userEmail={profile?.email || user?.email}
        editFirstName={editFirstName}
        setEditFirstName={setEditFirstName}
        editLastName={editLastName}
        setEditLastName={setEditLastName}
        editSaving={editSaving}
        onSave={handleSaveProfile}
        colors={colors}
        isDark={isDark}
        styles={styles}
      />

      {/* Delete Account Email Confirmation Modal */}
      <DeleteAccountModal
        visible={deleteModalVisible}
        onClose={() => setDeleteModalVisible(false)}
        userEmail={user?.email}
        deleteEmailInput={deleteEmailInput}
        onChangeEmail={(text) => {
          setDeleteEmailInput(text);
          if (deleteEmailError) setDeleteEmailError(null);
        }}
        deleteEmailError={deleteEmailError}
        isDeleting={isDeleting}
        deleteBtnBg={deleteBtnBg}
        deleteBtnColor={deleteBtnColor}
        onConfirm={handleConfirmEmailForDelete}
        colors={colors}
        isDark={isDark}
        styles={styles}
      />
      
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
          <Pressable
            onPress={openEditProfile}
            style={styles.avatarWrapper}
            hitSlop={6}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <View style={[styles.avatarCircle, { backgroundColor: colors.mintGreen }]}>
              <Text style={styles.avatarText}>
                {getInitials()}
              </Text>
            </View>
          </Pressable>

          <View style={styles.profileInfo}>
            <Text
              style={[styles.fullName, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
              numberOfLines={1}
            >
              {fullName}
            </Text>
            <Text
              style={[styles.accountSubtitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}
              numberOfLines={1}
            >
              Personal Account
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.editProfileBtn,
              {
                backgroundColor: colors.cardSubtle,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                opacity: pressed ? 0.75 : 1,
                transform: [{ scale: pressed ? 0.94 : 1 }],
              }
            ]}
            onPress={openEditProfile}
            hitSlop={6}
            accessible
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <SquarePen size={13} color={colors.textPrimary} strokeWidth={2.2} />
            <Text style={[styles.editProfileText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Edit
            </Text>
          </Pressable>
        </View>

        {/* Smart Budget & Gullak Card */}
        <View style={[styles.budgetCard, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: isDark ? 1 : 0 }]}>
          <Pressable
            style={({ pressed }) => [
              styles.budgetPressableArea,
              { opacity: pressed && (isBudgetModeEnabled || isScheduledSwitch) ? 0.75 : 1 }
            ]}
            onPress={() => {
              if (isScheduledSwitch) {
                Alert.alert(
                  'Cancel Scheduled Switch?',
                  pendingPlanChange?.isEnabled
                    ? 'Do you want to stay in Pure Mode and cancel activating Smart Budget & Gullak tomorrow?'
                    : 'Do you want to keep Smart Budget & Gullak and cancel switching to Pure Mode tomorrow?',
                  [
                    { text: 'Keep Scheduled', style: 'cancel' },
                    {
                      text: 'Cancel Switch',
                      style: 'destructive',
                      onPress: () => cancelPendingPlanChange(),
                    },
                  ]
                );
              } else if (isBudgetModeEnabled) {
                setBudgetModalVisible(true);
              }
            }}
            disabled={!isBudgetModeEnabled && !isScheduledSwitch}
            accessible
            accessibilityRole="button"
            accessibilityLabel={
              isBudgetModeEnabled || isScheduledSwitch
                ? `Smart Budget & Gullak. ${budgetSubtitle}. Tap to edit budget plan.`
                : 'Smart Budget & Gullak disabled'
            }
          >
            <View
              style={[
                styles.budgetIconContainer,
                {
                  backgroundColor: colors.cardSubtle,
                },
              ]}
            >
              <PiggyBankCoinIcon
                size={22}
                color={colors.textPrimary}
              />
            </View>

            <View style={styles.budgetInfo}>
              <View style={styles.budgetTitleRow}>
                <Text
                  style={[styles.budgetModeTitleText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}
                  numberOfLines={1}
                >
                  Smart Budget & Gullak
                </Text>
                <MoneyHelpBadge
                  size={16}
                  style={styles.budgetHelpBadge}
                  onPress={() => setShowMoneyExplainer(true)}
                />
              </View>

              <Text
                style={[styles.budgetModeSubtitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}
                numberOfLines={1}
              >
                {budgetSubtitle}
                {(isBudgetModeEnabled || isScheduledSwitch) && !isScheduledSwitch && (
                  <Text style={{ color: isDark ? colors.mintGreen : colors.forestGreen, fontFamily: FontFamily.semibold }}>
                    {' '}· Edit ✎
                  </Text>
                )}
              </Text>
            </View>
          </Pressable>

          <AnimatedToggle
            value={toggleValue}
            onValueChange={handleToggleBudgetMode}
          />
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

          {/* 1b. Automatic Logging (Beta) — visible per server rollout (see features/autoLog/rollout.ts) */}
          {(autoLogAvailable || autoLogMode !== 'off') && (
          <Pressable
            style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}
            onPress={() => navigation.navigate('AutoLogCenter')}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <Zap size={18} color={colors.textPrimary} />
            </View>
            <View style={{ flex: 1, marginRight: Spacing.element }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.element }}>
                <Text style={[{ color: colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.body }]}>
                  Automatic Logging
                </Text>
                <BetaPill small />
              </View>
              <Text style={{ fontSize: FontSize.caption, color: autoLogMode === 'live' && !autoLogAttention ? colors.mintGreenDark : colors.textSecondary, fontFamily: FontFamily.medium, marginTop: Spacing.nano }}>
                {autoLogMode === 'off' ? 'Log bank SMS & UPI payments automatically' : modeCopy(autoLogMode, autoLogAttention).title}
                {autoLogPending > 0 ? ` · ${autoLogPending} to review` : ''}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>
          )}

          {/* 2. Notifications */}
          <View style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <Bell size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              Notifications
            </Text>
            <AnimatedToggle
              value={notificationsEnabled}
              onValueChange={handleToggleNotifications}
            />
          </View>

          {/* 3. Theme Mode (Light, Dark, AMOLED) */}
          <View style={[styles.themeSettingContainer, { borderBottomColor: colors.borderSubtle }]}>
            <View style={styles.themeSettingHeader}>
              <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
                <Palette size={18} color={colors.textPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                  Theme
                </Text>
                <Text style={{ fontSize: FontSize.caption, color: colors.textSecondary, fontFamily: FontFamily.medium, marginTop: Spacing.nano }}>
                  {activeTheme === 'amoled'
                    ? 'AMOLED (Pure Black)'
                    : activeTheme === 'dark'
                    ? 'Dark (Midnight)'
                    : 'Light (Clean & Bright)'}
                </Text>
              </View>
            </View>

            {/* 3 Theme Choice Cards using unified SegmentedControl */}
            <View style={{ marginTop: Spacing.group }}>
              <SegmentedControl
                options={[
                  { key: 'light', label: 'Light', icon: Sun },
                  { key: 'dark', label: 'Dark', icon: Moon },
                  { key: 'amoled', label: 'AMOLED', icon: Sparkles, badge: 'Recommended' },
                ]}
                selectedKey={activeTheme}
                onChange={(key) => setThemeMode(key as 'light' | 'dark' | 'amoled')}
                height={ControlHeight.standard}
              />
            </View>
          </View>

          {/* 3b. Ambient Background (soft moving light at the top of screens) */}
          <View style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}>
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <Waves size={18} color={colors.textPrimary} />
            </View>
            <View style={{ flex: 1, marginRight: Spacing.element }}>
              <Text style={[{ color: colors.textPrimary, fontFamily: FontFamily.bold, fontSize: FontSize.body }]}>
                Ambient Background
              </Text>
              <Text style={{ fontSize: FontSize.caption, color: colors.textSecondary, fontFamily: FontFamily.medium, marginTop: Spacing.nano }}>
                Soft moving light at the top of screens
              </Text>
            </View>
            <AnimatedToggle
              value={ambientEnabled}
              onValueChange={setAmbientEnabled}
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
              <Text style={{ fontSize: FontSize.caption, color: colors.textSecondary, fontFamily: FontFamily.medium, marginTop: Spacing.nano }}>
                Fingerprint or Device PIN
              </Text>
            </View>
            <AnimatedToggle
              value={isAppLockEnabled}
              onValueChange={handleToggleAppLock}
            />
          </View>

          {/* 5. FAQs & Help */}
          <Pressable 
            style={[styles.settingRow, { borderBottomColor: colors.borderSubtle }]}
            onPress={() => navigation.navigate('Faq')}
          >
            <View style={[styles.iconContainer, { backgroundColor: colors.cardSubtle }]}>
              <HelpCircle size={18} color={colors.textPrimary} />
            </View>
            <Text style={[styles.settingLabel, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
              FAQs & Help
            </Text>
            <ChevronRight size={18} color={colors.textSecondary} />
          </Pressable>

          {/* 6. App Version */}
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

      <MoneyExplainerModal
        visible={showMoneyExplainer}
        topic="budget_pause"
        onClose={() => setShowMoneyExplainer(false)}
      />
    </View>
  );
};

