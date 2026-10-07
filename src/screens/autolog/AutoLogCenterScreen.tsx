import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, AppState, Linking } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Mail, Inbox, Landmark, BookOpen, Lock, PauseCircle, PlayCircle, Power, Zap, ShieldCheck, Smartphone } from 'lucide-react-native';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily, LineHeight, BorderRadius } from '../../config/theme';
import { AppButton } from '../../components/ui/AppButton';
import { BetaPill, Body, Card, CheckLine, NavRow, ScreenHeader, SectionLabel, StatusDot } from '../../components/autolog/AutoLogUi';
import { useAutoLogStore } from '../../features/autoLog/store';
import * as service from '../../features/autoLog/service';
import { fetchRemoteProfile } from '../../features/autoLog/remote';
import { openBatterySettings, openNotificationAccess } from '../../features/autoLog/permissions';
import { accountLabel, eventTitle, modeCopy, money, relative, statusLine, dateTime } from '../../features/autoLog/copy';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogCenter'>;

export const AutoLogCenterScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const s = useAutoLogStore();
  const [busy, setBusy] = useState(false);
  const [devMsg, setDevMsg] = useState<string | null>(null);

  const sync = useCallback(async () => {
    if (!userId) return;
    if (useAutoLogStore.getState().mode === 'live') await service.processQueue(userId, { notify: false });
    await useAutoLogStore.getState().refresh(userId);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      sync();
      const t = setInterval(sync, 20_000); // "Last checked: Just now" while you watch
      return () => clearInterval(t);
    }, [sync])
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => st === 'active' && sync());
    return () => sub.remove();
  }, [sync]);

  const copy = modeCopy(s.mode, s.attention);
  const tracked = s.accounts.filter((a) => a.tracked);
  const newAccounts = s.accounts.filter((a) => a.isNew && !a.tracked);
  const tone = s.mode === 'live' ? (s.attention ? 'attention' : 'live') : s.mode === 'paused' || s.mode === 'signed_out' ? 'paused' : 'off';

  const startSetup = async () => {
    if (!userId) return;
    if (s.mode === 'setup_missing') {
      setBusy(true);
      const r = await fetchRemoteProfile(userId);
      setBusy(false);
      navigation.navigate('AutoLogSetup', {
        mode: 'resetup',
        previous: r.profile?.tracked_accounts ?? [],
        lastActiveAt: r.profile?.last_active_at ? Date.parse(r.profile.last_active_at) : null,
      });
      return;
    }
    navigation.navigate('AutoLogSetup', { mode: 'first' });
  };

  const pause = () => {
    if (!userId) return;
    Alert.alert('Pause Automatic Logging?', 'Nothing will be detected or logged while paused. When you resume, you can decide what to do about the paused time.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Pause',
        onPress: async () => {
          await service.pause(userId);
          await useAutoLogStore.getState().refresh(userId);
        },
      },
    ]);
  };

  const resume = async () => {
    if (!userId) return;
    const pausedAt = (await service.getPausedAt(userId)) ?? Date.now();
    navigation.navigate('AutoLogWelcomeBack', { from: pausedAt, to: Date.now(), reason: 'pause' });
  };

  const turnOff = () => {
    if (!userId) return;
    Alert.alert(
      'Turn off Automatic Logging?',
      'This removes the on-device setup: tracked accounts, learned formats and preferences. Transactions already logged stay in your history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Turn off',
          style: 'destructive',
          onPress: async () => {
            await service.turnOff(userId);
            useAutoLogStore.getState().setRemoteEnabled(false);
            await useAutoLogStore.getState().refresh(userId);
          },
        },
      ]
    );
  };

  const isSetUp = s.mode === 'live' || s.mode === 'paused' || s.mode === 'signed_out';

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader title="Automatic Logging" onBack={() => navigation.goBack()} right={<BetaPill />} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.section }]} showsVerticalScrollIndicator={false}>
        {!s.supported && s.loaded ? (
          <Card>
            <Smartphone size={22} color={colors.textPrimary} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Not available in this build</Text>
            <Body muted>Automatic Logging needs the Arthik Android app v2.0 or newer. Download the latest APK from GitHub Releases.</Body>
          </Card>
        ) : null}

        {/* ── Status ── */}
        {s.supported ? (
          <Card>
            <StatusDot tone={tone} label={s.mode === 'live' && !s.attention ? 'Active' : s.mode === 'live' ? 'Needs attention' : s.mode === 'paused' || s.mode === 'signed_out' ? 'Paused' : 'Off'} />
            <Text style={[styles.title, { color: colors.textPrimary }]}>{copy.title}</Text>
            <Body muted>{copy.body}</Body>
            {isSetUp ? (
              <>
                {tracked.length ? (
                  <View style={{ marginTop: Spacing.block }}>
                    {tracked.map((a) => (
                      <Text key={a.key} style={[styles.account, { color: colors.textPrimary }]}>{accountLabel(a)}</Text>
                    ))}
                  </View>
                ) : null}
                <View style={[styles.metaRow, { borderTopColor: colors.borderSubtle }]}>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>Last checked: {relative(s.lastChecked)}</Text>
                  <View style={styles.lockRow}>
                    <Lock size={12} color={colors.mintGreenDark} />
                    <Text style={[styles.meta, { color: colors.mintGreenDark }]}>Processed on this device</Text>
                  </View>
                </View>
              </>
            ) : (
              <AppButton
                label={s.mode === 'setup_missing' ? 'Set up again' : 'Set up Automatic Logging'}
                size="cta"
                loading={busy}
                style={{ marginTop: Spacing.block }}
                icon={<Zap size={18} color={colors.textPrimary} />}
                onPress={startSetup}
              />
            )}
          </Card>
        ) : null}

        {/* ── New account found (never tracked silently) ── */}
        {s.mode === 'live' &&
          newAccounts.map((a) => (
            <Card key={a.key} tone="peach">
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>New account found</Text>
              <Body>{accountLabel(a)}</Body>
              <Body muted>This account wasn't part of your setup. Its transactions are not being logged.</Body>
              <View style={styles.row2}>
                <AppButton label="Not now" variant="outline" size="compact" style={{ flex: 1 }} onPress={async () => { if (userId) { await service.setTracked(userId, a.key, false); await s.refresh(userId); } }} />
                <AppButton label="Track it" size="compact" style={{ flex: 1 }} onPress={async () => { if (userId) { await service.setTracked(userId, a.key, true); await s.refresh(userId); } }} />
              </View>
            </Card>
          ))}

        {/* ── Health ── */}
        {s.mode === 'live' && s.health ? (
          <Card tone={s.attention ? 'peach' : 'default'}>
            {s.attention ? (
              <>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Auto-Logging needs attention</Text>
                <Body muted style={{ marginBottom: Spacing.element }}>
                  {!s.health.battery ? 'Your phone may be restricting Arthik from working in the background.' : 'Something below stops detection from working fully.'}
                </Body>
              </>
            ) : (
              <SectionLabel>Status</SectionLabel>
            )}
            <CheckLine ok={s.health.sms} label="SMS access" onFix={() => Linking.openSettings()} />
            <CheckLine ok={s.health.notifications} label="Notification access" optional onFix={openNotificationAccess} />
            {service.emailSupported() ? (
              <CheckLine ok={s.health.email} label="Email notifications" optional onFix={() => navigation.navigate('AutoLogEmail')} />
            ) : null}
            <CheckLine ok={s.health.accounts} label="Tracked accounts" onFix={() => navigation.navigate('AutoLogAccounts')} />
            <CheckLine ok={s.health.battery} label="Background access" onFix={openBatterySettings} />
          </Card>
        ) : null}

        {/* ── Today ── */}
        {isSetUp ? (
          <Card>
            <SectionLabel>Today</SectionLabel>
            <View style={styles.stats}>
              {[
                [s.today.detected, 'detected'],
                [s.today.matched, 'matched'],
                [s.pendingCount, 'pending review'],
              ].map(([n, l]) => (
                <View key={String(l)} style={styles.stat}>
                  <Text style={[styles.statNum, { color: colors.textPrimary }]}>{n}</Text>
                  <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{l}</Text>
                </View>
              ))}
            </View>
          </Card>
        ) : null}

        {/* ── Recent activity ── */}
        {isSetUp && s.recent.length ? (
          <Card>
            <SectionLabel>Recent activity</SectionLabel>
            {s.recent.map((e, i) => (
              <Pressable
                key={e.id}
                onPress={() => {
                  if (e.status === 'pending' || (e.status === 'logged' && e.needsCategory)) navigation.navigate('AutoLogReview');
                  else if (e.status === 'logged' && e.expenseId) navigation.navigate('ExpenseDetail', { expenseId: e.expenseId });
                }}
                style={[styles.activity, i < s.recent.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.activityTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {money(e.amount)} · {eventTitle(e)}
                  </Text>
                  <Text style={[styles.activitySub, { color: e.status === 'pending' ? colors.peachCoral : colors.textSecondary }]}>
                    {statusLine(e)} · {dateTime(e.occurredAt)}
                  </Text>
                </View>
                <Text style={[styles.src, { color: colors.textMuted }]}>{e.source === 'sms' ? 'SMS' : e.sender}</Text>
              </Pressable>
            ))}
          </Card>
        ) : null}

        {/* ── Developer test tools: compiled out of release/preview builds (__DEV__ is false there) ── */}
        {__DEV__ && s.mode === 'live' ? (
          <Card>
            <SectionLabel>Developer test tools (dev build only)</SectionLabel>
            <Body muted style={{ marginBottom: Spacing.group }}>
              Sends fake events through the real pipeline. Try 1 → 2 → 3 to see a notification, an SMS and an email become one transaction.
            </Body>
            {([
              ['notification_debit', '1. PhonePe notification · ₹349 Zomato'],
              ['sms_debit', '2. Bank SMS · ₹349 Zomato'],
              ['email_debit', '3. Bank email · ₹349 Zomato'],
              ['sms_credit_person', 'Bank SMS · ₹2,000 from Rahul (review)'],
              ['sms_unreadable', 'Unreadable bank message (review)'],
              ['expire_previews', 'Skip 20 min (expire waiting previews)'],
            ] as const).map(([k, label]) => (
              <AppButton
                key={k}
                label={label}
                variant="outline"
                size="compact"
                style={{ marginBottom: Spacing.element }}
                onPress={async () => {
                  if (!userId) return;
                  const msg = await service.devSimulate(userId, k);
                  await useAutoLogStore.getState().refresh(userId);
                  setDevMsg(msg);
                }}
              />
            ))}
            {devMsg ? <Text style={[styles.meta, { color: colors.mintGreenDark }]}>{devMsg}</Text> : null}
          </Card>
        ) : null}

        {/* ── Navigation ── */}
        <Card>
          {isSetUp ? (
            <>
              <NavRow icon={<Inbox size={18} color={colors.textPrimary} />} label="Pending Review" badge={s.pendingCount} onPress={() => navigation.navigate('AutoLogReview')} />
              <NavRow icon={<Landmark size={18} color={colors.textPrimary} />} label="Tracked Accounts" detail={`${tracked.length} tracked`} onPress={() => navigation.navigate('AutoLogAccounts')} />
              {service.emailSupported() ? (
                <NavRow
                  icon={<Mail size={18} color={colors.textPrimary} />}
                  label="Email notifications"
                  detail={s.emailEnabled ? (s.health?.email ? 'On' : 'On · needs notification access') : 'Off'}
                  onPress={() => navigation.navigate('AutoLogEmail')}
                />
              ) : null}
            </>
          ) : null}
          <NavRow icon={<BookOpen size={18} color={colors.textPrimary} />} label="How Automatic Logging Works" onPress={() => navigation.navigate('AutoLogInfo', { section: 'how' })} />
          <NavRow icon={<ShieldCheck size={18} color={colors.textPrimary} />} label="Privacy" onPress={() => navigation.navigate('AutoLogInfo', { section: 'privacy' })} last={!isSetUp} />
          {isSetUp ? (
            <>
              {s.mode === 'paused' ? (
                <NavRow icon={<PlayCircle size={18} color={colors.textPrimary} />} label="Resume" onPress={resume} />
              ) : (
                <NavRow icon={<PauseCircle size={18} color={colors.textPrimary} />} label="Pause" onPress={pause} />
              )}
              <NavRow icon={<Power size={18} color={colors.peachCoral} />} label="Turn off" danger last onPress={turnOff} />
            </>
          ) : null}
        </Card>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter },
  title: { fontSize: FontSize.titleMedium, lineHeight: LineHeight.titleMedium, fontFamily: FontFamily.bold, marginTop: Spacing.element, marginBottom: Spacing.micro },
  cardTitle: { fontSize: FontSize.body, fontFamily: FontFamily.bold, marginBottom: Spacing.micro },
  account: { fontSize: FontSize.body, fontFamily: FontFamily.semibold, marginBottom: Spacing.micro },
  metaRow: { borderTopWidth: 1, marginTop: Spacing.group, paddingTop: Spacing.group, gap: Spacing.micro },
  meta: { fontSize: FontSize.caption, fontFamily: FontFamily.semibold },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  row2: { flexDirection: 'row', gap: Spacing.group, marginTop: Spacing.group },
  stats: { flexDirection: 'row' },
  stat: { flex: 1 },
  statNum: { fontSize: FontSize.titleLarge, lineHeight: LineHeight.titleLarge, fontFamily: FontFamily.bold },
  statLabel: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
  activity: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.group, gap: Spacing.element },
  activityTitle: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  activitySub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: Spacing.nano },
  src: { fontSize: FontSize.micro, fontFamily: FontFamily.bold, borderRadius: BorderRadius.pill },
});
