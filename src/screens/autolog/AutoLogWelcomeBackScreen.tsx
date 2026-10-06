import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { History, GraduationCap, CheckCircle2 } from 'lucide-react-native';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily, LineHeight, BorderRadius } from '../../config/theme';
import { AppButton } from '../../components/ui/AppButton';
import { Body, Bullet, Card, Heading, ProgressBar, Reassurance, ScreenHeader } from '../../components/autolog/AutoLogUi';
import * as service from '../../features/autoLog/service';
import { formatGap, MAX_RECOVERY_DAYS } from '../../features/autoLog/matching';
import { dateTime, STATE_COPY } from '../../features/autoLog/copy';
import { useAutoLogStore } from '../../features/autoLog/store';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogWelcomeBack'>;
type Choice = 'recover' | 'learn';

/**
 * Spec §27–29. After sign-in (or resuming a pause) the user decides what happens to the gap.
 * MVP shows Recovery + Learn only. A future "Skip" option fits here without a redesign.
 */
export const AutoLogWelcomeBackScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const { from, to, reason } = route.params;
  const gap = to - from;
  const recoveryAllowed = gap <= MAX_RECOVERY_DAYS * 86400_000;
  const [choice, setChoice] = useState<Choice>(recoveryAllowed ? 'recover' : 'learn');
  const [phase, setPhase] = useState<'choose' | 'recovering' | 'done'>('choose');
  const [progress, setProgress] = useState({ checked: 0, total: 0 });
  const [result, setResult] = useState<service.ScanSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  // A decision is required: hardware back does nothing while choosing/recovering.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => phase !== 'done');
    return () => sub.remove();
  }, [phase]);

  const proceed = async () => {
    if (!userId) return;
    Haptics.selectionAsync().catch(() => {});
    if (choice === 'learn') {
      navigation.replace('AutoLogSetup', { mode: 'learn', from, to });
      return;
    }
    setPhase('recovering');
    setError(null);
    try {
      const r = await service.runRecovery(userId, from, to, (p) => setProgress({ checked: p.checked, total: p.total }));
      await service.resumeLive(userId);
      setResult(r);
      setPhase('done');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      useAutoLogStore.getState().refresh(userId);
    } catch (e: any) {
      setError(e?.message || 'Could not check messages.');
      setPhase('choose');
    }
  };

  const option = (key: Choice, icon: React.ReactNode, title: string, text: string, disabled?: string) => {
    const active = choice === key;
    return (
      <Pressable
        disabled={!!disabled}
        onPress={() => setChoice(key)}
        style={[
          styles.option,
          { backgroundColor: colors.card, borderColor: active ? colors.mintGreenDark : colors.border, opacity: disabled ? 0.5 : 1 },
        ]}
      >
        <View style={styles.optionHead}>
          {icon}
          <Text style={[styles.optionTitle, { color: colors.textPrimary }]}>{title}</Text>
          <View style={[styles.radio, { borderColor: active ? colors.mintGreenDark : colors.border }]}>
            {active ? <View style={[styles.radioDot, { backgroundColor: colors.mintGreenDark }]} /> : null}
          </View>
        </View>
        <Body muted>{disabled || text}</Body>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader title={phase === 'recovering' ? STATE_COPY.recovery.title : 'Automatic Logging'} />
      <ScrollView contentContainerStyle={styles.content}>
        {phase === 'choose' ? (
          <>
            <Heading style={styles.big}>{reason === 'pause' ? 'Resume Automatic Logging' : 'Welcome back 👋'}</Heading>
            <Body>
              {reason === 'pause' ? 'Automatic Logging was paused for ' : 'You were signed out for '}
              <Text style={{ fontFamily: FontFamily.bold }}>{formatGap(gap)}</Text>.
            </Body>
            <Body muted style={{ marginTop: Spacing.micro }}>
              {dateTime(from)} → {dateTime(to)}
            </Body>
            <Body style={{ marginTop: Spacing.block, marginBottom: Spacing.block }}>
              Automatic Logging was paused during this time. What would you like to do?
            </Body>
            {option(
              'recover',
              <History size={20} color={colors.textPrimary} />,
              'Recover missed transactions',
              "We'll check bank messages from this period. Potential transactions will go through the normal detection and review process.",
              recoveryAllowed ? undefined : `Recovery is available for gaps up to ${MAX_RECOVERY_DAYS} days. For a longer gap, Arthik can only learn from it.`
            )}
            {option(
              'learn',
              <GraduationCap size={20} color={colors.textPrimary} />,
              'Learn from this period',
              "We'll use these messages only to understand transaction formats and improve detection. Nothing from this period will be added to your history."
            )}
            {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          </>
        ) : phase === 'recovering' ? (
          <>
            <Heading style={styles.big}>Recovering missed activity</Heading>
            <Body muted>{dateTime(from)} → {dateTime(to)}</Body>
            <Card style={{ marginTop: Spacing.block }}>
              <Text style={[styles.counter, { color: colors.textPrimary }]}>
                {progress.checked.toLocaleString('en-IN')} / {progress.total.toLocaleString('en-IN')}
              </Text>
              <Body muted style={{ marginBottom: Spacing.group }}>messages checked</Body>
              <ProgressBar value={progress.total ? progress.checked / progress.total : 0} />
            </Card>
            <Body muted>{STATE_COPY.recovery.body}</Body>
            <View style={{ marginTop: Spacing.surface }}><ActivityIndicator color={colors.mintGreenDark} /></View>
          </>
        ) : (
          <>
            <View style={styles.hero}><CheckCircle2 size={44} color={colors.mintGreenDark} /></View>
            <Heading style={[styles.big, { textAlign: 'center' }]}>Recovery complete</Heading>
            <Body muted style={{ textAlign: 'center' }}>{dateTime(from)} → {dateTime(to)}</Body>
            <Card style={{ marginTop: Spacing.block }}>
              <Bullet tone="ok">{result?.found ?? 0} transaction{result?.found === 1 ? '' : 's'} found</Bullet>
              <Bullet tone="ok">{result?.logged ?? 0} automatically logged</Bullet>
              <Bullet tone={result?.needsReview ? 'dot' : 'ok'}>{result?.needsReview ?? 0} need{result?.needsReview === 1 ? 's' : ''} review</Bullet>
            </Card>
            <Reassurance>⚡ Automatic Logging is active again.</Reassurance>
          </>
        )}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.block, borderTopColor: colors.borderSubtle }]}>
        {phase === 'choose' ? (
          <AppButton label="Continue" size="cta" onPress={proceed} />
        ) : phase === 'done' ? (
          <>
            {result?.needsReview ? (
              <AppButton label={`Review ${result.needsReview} now`} size="cta" onPress={() => navigation.replace('AutoLogReview')} />
            ) : null}
            <AppButton
              label="Done"
              size="cta"
              variant={result?.needsReview ? 'ghost' : 'primary'}
              style={result?.needsReview ? { marginTop: Spacing.element } : undefined}
              onPress={() => navigation.goBack()}
            />
          </>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.section },
  footer: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.group, borderTopWidth: 1 },
  big: { fontSize: FontSize.titleLarge, lineHeight: LineHeight.titleLarge },
  option: { borderWidth: 2, borderRadius: BorderRadius.card, padding: Spacing.surface, marginBottom: Spacing.group },
  optionHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, marginBottom: Spacing.element },
  optionTitle: { flex: 1, fontSize: FontSize.body, fontFamily: FontFamily.bold },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
  counter: { fontSize: FontSize.display, lineHeight: LineHeight.display, fontFamily: FontFamily.bold },
  hero: { alignItems: 'center', marginTop: Spacing.surface, marginBottom: Spacing.element },
  error: { fontSize: FontSize.caption, fontFamily: FontFamily.semibold, marginTop: Spacing.element },
});
