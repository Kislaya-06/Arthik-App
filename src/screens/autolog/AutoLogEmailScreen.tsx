import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, ScrollView, AppState, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { Mail, CheckCircle2, AlertTriangle, Smartphone } from 'lucide-react-native';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily } from '../../config/theme';
import { AppButton } from '../../components/ui/AppButton';
import { GradientIconBadge } from '../../components/GradientIconBadge';
import { BetaPill, Body, Card, Heading, ScreenHeader } from '../../components/autolog/AutoLogUi';
import { EmailSourceInfo } from '../../components/autolog/EmailSourceInfo';
import * as service from '../../features/autoLog/service';
import { hasNotificationAccess, openNotificationAccess, openAppDetails } from '../../features/autoLog/permissions';
import { useAutoLogStore } from '../../features/autoLog/store';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogEmail'>;

/** Turn email notification detection on / off (spec email §36–39). SMS and payment apps are unaffected. */
export const AutoLogEmailScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const [enabled, setEnabled] = useState(false);
  const [access, setAccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = service.emailSupported();

  const load = useCallback(async () => {
    setAccess(hasNotificationAccess());
    if (userId) setEnabled(await service.isEmailEnabled(userId));
  }, [userId]);

  useEffect(() => {
    load();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && load());
    return () => sub.remove();
  }, [load]);

  const toggle = async (on: boolean) => {
    if (!userId) return;
    setBusy(true);
    await service.setEmailEnabled(userId, on);
    setEnabled(on);
    setBusy(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    useAutoLogStore.getState().refresh(userId);
  };

  const working = enabled && access;

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader title="Email notifications" onBack={() => navigation.goBack()} right={<BetaPill />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Spacing.section }]} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <GradientIconBadge size={64} isDark={isDark}>
            <Mail size={30} color={colors.textPrimary} />
          </GradientIconBadge>
          <Heading style={{ marginTop: Spacing.block, textAlign: 'center' }}>Detect transactions from bank emails</Heading>
          <Body muted style={{ textAlign: 'center' }}>
            Useful when your bank or card sends an email but no SMS. One payment still becomes one transaction.
          </Body>
        </View>

        {!supported ? (
          <Card tone="peach">
            <View style={styles.row}>
              <Smartphone size={18} color={colors.textPrimary} />
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>Update Arthik to use this</Text>
            </View>
            <Body muted style={{ marginTop: Spacing.micro }}>Email detection needs Arthik 2.1 or newer.</Body>
          </Card>
        ) : (
          <Card tone={working ? 'mint' : enabled ? 'peach' : 'default'}>
            <View style={styles.row}>
              {working ? <CheckCircle2 size={18} color={colors.mintGreenDark} /> : enabled ? <AlertTriangle size={18} color="#F59E0B" /> : <Mail size={18} color={colors.textSecondary} />}
              <Text style={[styles.statusTitle, { color: colors.textPrimary }]}>
                {working ? 'Email notifications: On' : enabled ? 'Email notifications: Needs notification access' : 'Email notifications: Off'}
              </Text>
            </View>
            <Body muted style={{ marginTop: Spacing.micro }}>
              {working
                ? 'Bank and payment emails will be matched with your SMS and app notifications.'
                : enabled
                ? 'Turn on Notification access for "Arthik Automatic Logging". SMS and payment apps keep working meanwhile.'
                : 'SMS and payment-app detection work without this.'}
            </Body>
          </Card>
        )}

        <EmailSourceInfo />
      </ScrollView>

      {supported ? (
        <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.block, borderTopColor: colors.borderSubtle, backgroundColor: colors.background }]}>
          {enabled && !access ? (
            <>
              <AppButton label="Open notification access" size="cta" onPress={openNotificationAccess} />
              <View style={styles.row2}>
                <AppButton label="App info" variant="outline" style={{ flex: 1 }} onPress={openAppDetails} />
                <AppButton label="Turn off" variant="ghost" style={{ flex: 1 }} loading={busy} onPress={() => toggle(false)} />
              </View>
            </>
          ) : enabled ? (
            <AppButton label="Turn off email detection" variant="outline" size="cta" loading={busy} onPress={() => toggle(false)} />
          ) : (
            <AppButton label="Turn on email detection" size="cta" loading={busy} icon={<Mail size={18} color={colors.textPrimary} />} onPress={() => toggle(true)} />
          )}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter },
  hero: { alignItems: 'center', marginVertical: Spacing.surface },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element },
  row2: { flexDirection: 'row', gap: Spacing.group, marginTop: Spacing.group },
  statusTitle: { fontSize: FontSize.body, fontFamily: FontFamily.bold, flexShrink: 1 },
  footer: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.group, borderTopWidth: 1 },
});
