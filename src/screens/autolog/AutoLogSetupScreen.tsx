import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Alert, AppState, Linking, ActivityIndicator, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Haptics from 'expo-haptics';
import { MessageSquareText, BellRing, BatteryCharging, ShieldCheck, Zap, Search, CheckCircle2, CloudOff } from 'lucide-react-native';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily, LineHeight, BorderRadius } from '../../config/theme';
import { AppButton } from '../../components/ui/AppButton';
import { GradientIconBadge } from '../../components/GradientIconBadge';
import { BetaPill, Body, Bullet, Card, Checkbox, Heading, ProgressBar, Reassurance, ScreenHeader, SectionLabel, StepDots } from '../../components/autolog/AutoLogUi';
import { ReviewSheet } from '../../components/autolog/ReviewSheet';
import * as service from '../../features/autoLog/service';
import * as db from '../../features/autoLog/db';
import {
  hasNotificationAccess, hasSmsPermission, isBatteryUnrestricted, openAppDetails, openBatterySettings,
  openNotificationAccess, requestSmsPermission,
} from '../../features/autoLog/permissions';
import { formatGap } from '../../features/autoLog/matching';
import { accountLabel, dateTime } from '../../features/autoLog/copy';
import { useAutoLogStore } from '../../features/autoLog/store';
import type { AutoLogEvent, TrackedAccount } from '../../features/autoLog/types';
import type { RemoteAccount } from '../../features/autoLog/remote';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogSetup'>;
type Step = 'dataLoss' | 'intro' | 'sms' | 'notifications' | 'battery' | 'discovery' | 'accounts' | 'review' | 'complete';

const keyOf = (a: RemoteAccount) => `${a.bankCode}:${a.last4}`;

export const AutoLogSetupScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const mode = route.params?.mode ?? 'first';
  const previous = route.params?.previous ?? [];

  const steps: Step[] = useMemo(
    () =>
      mode === 'learn'
        ? ['discovery', 'accounts', 'review', 'complete']
        : [...(mode === 'resetup' ? (['dataLoss'] as Step[]) : []), 'intro', 'sms', 'notifications', 'battery', 'discovery', 'accounts', 'review', 'complete'],
    [mode]
  );
  const [step, setStep] = useState<Step>(steps[0]);
  const stepIndex = steps.indexOf(step);

  // permissions
  const [smsState, setSmsState] = useState<'unknown' | 'granted' | 'denied' | 'blocked'>('unknown');
  const [notifOk, setNotifOk] = useState(false);
  const [batteryOk, setBatteryOk] = useState(false);

  // discovery
  const [progress, setProgress] = useState({ checked: 0, total: 0, phase: 'reading' as 'reading' | 'understanding' });
  const [summary, setSummary] = useState<service.ScanSummary | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const started = useRef(false);

  // accounts
  const [accounts, setAccounts] = useState<TrackedAccount[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [missingChoice, setMissingChoice] = useState<Record<string, 'keep' | 'remove'>>({});

  // review
  const [reviewEvent, setReviewEvent] = useState<AutoLogEvent | null>(null);
  const [handled, setHandled] = useState<Record<string, 'learned' | 'ignored'>>({});
  const [toast, setToast] = useState<string | null>(null);

  // completion
  const [finishing, setFinishing] = useState(false);
  const [finalCounts, setFinalCounts] = useState<{ formats: number } | null>(null);

  const refreshPermissions = useCallback(async () => {
    const sms = await hasSmsPermission();
    if (sms) setSmsState('granted');
    setNotifOk(hasNotificationAccess());
    setBatteryOk(isBatteryUnrestricted());
  }, []);

  useEffect(() => {
    refreshPermissions();
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refreshPermissions());
    return () => sub.remove();
  }, [refreshPermissions]);

  const leave = useCallback(() => {
    if (step === 'complete') {
      navigation.popTo('AutoLogCenter');
      return true;
    }
    Alert.alert(
      mode === 'learn' ? 'Stop for now?' : 'Stop setup?',
      mode === 'learn'
        ? 'Automatic Logging stays paused until you finish this step.'
        : 'Automatic Logging will not be turned on. Nothing has been added to your history.',
      [
        { text: 'Continue setup', style: 'cancel' },
        { text: 'Stop', style: 'destructive', onPress: () => navigation.goBack() },
      ]
    );
    return true;
  }, [mode, navigation, step]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', leave);
    return () => sub.remove();
  }, [leave]);

  const next = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    const i = steps.indexOf(step);
    let target = steps[i + 1];
    // Skip steps with nothing to show.
    if (target === 'accounts' && mode === 'learn' && summary && summary.newAccountKeys.length === 0) target = 'review';
    if (target === 'review' && summary && summary.suspicious.length === 0) target = 'complete';
    setStep(target);
  }, [mode, step, steps, summary]);

  // ── Discovery run ──
  const runDiscovery = useCallback(async () => {
    if (!userId) return;
    setScanError(null);
    setSummary(null);
    try {
      const range = mode === 'learn' ? { from: route.params?.from, to: route.params?.to } : {};
      const s = await service.runDiscovery(userId, range, (p) => setProgress(p));
      setSummary(s);
      const all = await db.listAccounts();
      setAccounts(all);
      const prevKeys = new Set(previous.map(keyOf));
      if (mode === 'resetup') setSelected(new Set(all.filter((a) => prevKeys.has(a.key)).map((a) => a.key)));
      if (mode === 'learn') setSelected(new Set());
    } catch (e: any) {
      setScanError(e?.message || 'Could not read messages.');
    }
  }, [mode, previous, route.params?.from, route.params?.to, userId]);

  useEffect(() => {
    if (step === 'discovery' && !started.current) {
      started.current = true;
      runDiscovery();
    }
  }, [runDiscovery, step]);

  const discoveredKeys = useMemo(() => new Set(accounts.map((a) => a.key)), [accounts]);
  const missingPrevious = useMemo(() => previous.filter((p) => !discoveredKeys.has(keyOf(p))), [previous, discoveredKeys]);
  const newKeys = useMemo(() => new Set(summary?.newAccountKeys ?? []), [summary]);

  const accountsForStep = useMemo(() => {
    if (mode === 'learn') return accounts.filter((a) => newKeys.has(a.key));
    return accounts;
  }, [accounts, mode, newKeys]);

  const grouped = useMemo(() => {
    const map = new Map<string, TrackedAccount[]>();
    for (const a of accountsForStep) map.set(a.bank, [...(map.get(a.bank) ?? []), a]);
    return Array.from(map.entries());
  }, [accountsForStep]);

  const toggle = (key: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  // ── Finish (enters Live automatically — no Start button, spec §13) ──
  const finish = useCallback(async () => {
    if (!userId || finishing) return;
    setFinishing(true);
    try {
      if (mode === 'learn') {
        for (const k of selected) await service.setTracked(userId, k, true);
        await service.resumeLive(userId);
      } else {
        const keep = missingPrevious.filter((p) => missingChoice[keyOf(p)] !== 'remove');
        await service.completeSetup(userId, { trackedKeys: Array.from(selected), keepAccounts: keep });
      }
      await db.openDb(userId);
      setFinalCounts({ formats: await db.countTemplates() });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      useAutoLogStore.getState().refresh(userId);
    } finally {
      setFinishing(false);
    }
  }, [finishing, missingChoice, missingPrevious, mode, selected, userId]);

  useEffect(() => {
    if (step === 'complete' && !finalCounts) finish();
  }, [finalCounts, finish, step]);

  const reviewedCount = Object.keys(handled).length;
  const ignoredCount = Object.values(handled).filter((v) => v === 'ignored').length;

  // ─── Render helpers ───
  const hero = (icon: React.ReactNode, title: string, subtitle?: string) => (
    <View style={styles.hero}>
      <GradientIconBadge size={64} isDark={isDark}>{icon}</GradientIconBadge>
      <Heading style={{ marginTop: Spacing.block, textAlign: 'center' }}>{title}</Heading>
      {subtitle ? <Body muted style={{ textAlign: 'center' }}>{subtitle}</Body> : null}
    </View>
  );

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  switch (step) {
    case 'dataLoss': {
      const gap = route.params?.lastActiveAt ? Date.now() - route.params.lastActiveAt : null;
      body = (
        <>
          {hero(<CloudOff size={30} color={colors.textPrimary} />, 'Your Automatic Logging setup is no longer available on this device.')}
          <Card>
            <Body>This can happen when the app is uninstalled or its app data is cleared.</Body>
            <Body style={{ marginTop: Spacing.element }}>
              For your privacy, we'll set it up again instead of assuming your previous device settings are still present.
            </Body>
          </Card>
          {gap && gap > 3600_000 ? (
            <Card tone="peach">
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Arthik was unavailable for {formatGap(gap)}.</Text>
              <Body>Messages from this period may still exist on your phone. We'll use them for discovery only.</Body>
              <Body style={{ marginTop: Spacing.element, fontFamily: FontFamily.bold }}>
                We will NOT add transactions from these {formatGap(gap)} to your history.
              </Body>
            </Card>
          ) : null}
        </>
      );
      footer = (
        <>
          <AppButton label="Set up again" size="cta" onPress={next} />
          <AppButton
            label="Not now"
            variant="ghost"
            style={{ marginTop: Spacing.element }}
            onPress={async () => {
              if (userId) await service.dismissDataLoss(userId);
              navigation.goBack();
            }}
          />
        </>
      );
      break;
    }
    case 'intro':
      body = (
        <>
          {hero(<Zap size={30} color={colors.textPrimary} />, 'Automatic Logging', 'Log expenses and income without typing them.')}
          <Card>
            <SectionLabel>How it works</SectionLabel>
            <Bullet tone="ok">Expenses and income are detected automatically from bank SMS and supported payment notifications.</Bullet>
            <Bullet tone="ok">Everything is processed on this phone.</Bullet>
            <Bullet tone="ok">You choose which bank accounts to track.</Bullet>
            <Bullet tone="ok">Anything uncertain waits for your review — Arthik never guesses.</Bullet>
            <Bullet tone="ok">You can pause or turn it off at any time.</Bullet>
          </Card>
          <Reassurance>
            Old messages will only help Arthik understand your bank/account formats. They will not be added as transactions.
          </Reassurance>
          <Card tone="peach">
            <View style={styles.liveRow}>
              <BetaPill />
              <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: 0 }]}>This feature is in Beta</Text>
            </View>
            <Body muted style={{ marginTop: Spacing.element }}>
              Some bank messages may be missed or read wrongly. Anything Arthik is unsure about waits for your review, and you can correct or report any automatic entry.
            </Body>
          </Card>
        </>
      );
      footer = <AppButton label="Continue" size="cta" onPress={next} />;
      break;
    case 'sms':
      body = (
        <>
          {hero(<MessageSquareText size={30} color={colors.textPrimary} />, 'Allow SMS access', 'Needed to detect bank transaction messages.')}
          <Card>
            <Bullet tone="ok">Only supported bank transaction messages are processed.</Bullet>
            <Bullet tone="no">Personal messages are not used — they are filtered out on the phone before anything else happens.</Bullet>
            <Bullet tone="no">OTP messages are ignored.</Bullet>
            <Bullet tone="no">SMS text is never uploaded.</Bullet>
          </Card>
          {smsState === 'denied' || smsState === 'blocked' ? (
            <Card tone="peach">
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>SMS access was not allowed</Text>
              <Body>Without it, Automatic Logging cannot work, because bank SMS are the main and most reliable signal.</Body>
              {smsState === 'blocked' ? (
                <Body style={{ marginTop: Spacing.element }}>
                  Open App info → Permissions → SMS → Allow. If the option is greyed out, tap ⋮ (top right) → "Allow restricted settings" first.
                </Body>
              ) : null}
            </Card>
          ) : null}
        </>
      );
      footer =
        smsState === 'granted' ? (
          <AppButton label="SMS access allowed ✓ — Continue" size="cta" onPress={next} />
        ) : smsState === 'blocked' ? (
          <AppButton label="Open App info" size="cta" onPress={() => Linking.openSettings()} />
        ) : (
          <AppButton
            label={smsState === 'denied' ? 'Try again' : 'Allow SMS access'}
            size="cta"
            onPress={async () => {
              const r = await requestSmsPermission();
              setSmsState(r);
              if (r === 'granted') next();
            }}
          />
        );
      break;
    case 'notifications':
      body = (
        <>
          {hero(<BellRing size={30} color={colors.textPrimary} />, 'Payment notifications', 'A fast preview, often before the bank SMS.')}
          <Card>
            <Bullet tone="ok">Google Pay, PhonePe, Paytm, Navi and other supported payment apps usually notify you first.</Bullet>
            <Bullet tone="ok">Arthik shows it as a preview: "Payment detected · Waiting for bank confirmation".</Bullet>
            <Bullet tone="ok">The bank SMS stays the source of truth. Both are combined into one transaction.</Bullet>
            <Bullet tone="no">Notifications from other apps (chats, social, email) are ignored.</Bullet>
          </Card>
          <Card>
            <Body muted>
              On the next screen, turn on "Arthik Automatic Logging". If the switch is greyed out: open App info → ⋮ → "Allow restricted settings", then try again.
            </Body>
          </Card>
        </>
      );
      footer = notifOk ? (
        <AppButton label="Notification access on ✓ — Continue" size="cta" onPress={next} />
      ) : (
        <>
          <AppButton label="Open notification access" size="cta" onPress={openNotificationAccess} />
          <View style={styles.row2}>
            <AppButton label="App info" variant="outline" style={{ flex: 1 }} onPress={openAppDetails} />
            <AppButton label="Skip for now" variant="ghost" style={{ flex: 1 }} onPress={next} />
          </View>
        </>
      );
      break;
    case 'battery':
      body = (
        <>
          {hero(<BatteryCharging size={30} color={colors.textPrimary} />, 'Background reliability')}
          <Card>
            <Body>
              Android may restrict apps from running in the background to save battery. This can prevent Arthik from detecting transactions while the app is closed.
            </Body>
            <View style={[styles.recommend, { backgroundColor: colors.mintGreenSoft }]}>
              <Text style={[styles.recommendText, { color: colors.textPrimary }]}>Recommended: Battery usage → Unrestricted</Text>
            </View>
            <Body muted>App info → App battery usage (or "Battery") → Unrestricted.</Body>
          </Card>
          <Reassurance>Arthik is optimized to use very little battery and does not continuously perform heavy processing in the background.</Reassurance>
          {batteryOk ? (
            <Card tone="mint">
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>✓ Background reliability is ready</Text>
            </Card>
          ) : null}
        </>
      );
      footer = batteryOk ? (
        <AppButton label="Continue" size="cta" onPress={next} />
      ) : (
        <>
          <AppButton label="Open battery settings" size="cta" onPress={openBatterySettings} />
          <AppButton label="I'll do it later" variant="ghost" style={{ marginTop: Spacing.element }} onPress={next} />
        </>
      );
      break;
    case 'discovery': {
      const pct = progress.total ? progress.checked / progress.total : 0;
      const learnRange = mode === 'learn' && route.params?.from && route.params?.to;
      body = (
        <>
          {hero(<Search size={30} color={colors.textPrimary} />, mode === 'learn' ? 'Understanding your activity' : 'Understanding your data')}
          {learnRange ? (
            <Body muted style={{ textAlign: 'center', marginBottom: Spacing.block }}>
              We're looking at messages from the period you were signed out ({dateTime(route.params!.from!)} → {dateTime(route.params!.to!)}).
            </Body>
          ) : null}
          <Card>
            {summary ? (
              <>
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>✓ {summary.scanned.toLocaleString('en-IN')} messages checked</Text>
                <Body muted>
                  {summary.financial} looked like bank messages · {accounts.length} account{accounts.length === 1 ? '' : 's'} found ·{' '}
                  {summary.formatsLearned} transaction format{summary.formatsLearned === 1 ? '' : 's'} understood
                </Body>
              </>
            ) : scanError ? (
              <>
                <Text style={[styles.cardTitle, { color: colors.danger }]}>Could not finish</Text>
                <Body muted>{scanError}</Body>
              </>
            ) : (
              <>
                <Text style={[styles.counter, { color: colors.textPrimary }]}>
                  {progress.checked.toLocaleString('en-IN')} / {progress.total.toLocaleString('en-IN')}
                </Text>
                <Body muted style={{ marginBottom: Spacing.group }}>
                  {progress.phase === 'reading' ? 'messages checked' : 'understanding formats…'}
                </Body>
                <ProgressBar value={progress.phase === 'reading' ? pct : 1} />
              </>
            )}
          </Card>
          <Reassurance>
            {mode === 'learn' ? 'This is discovery only. No transaction from this period will be added.' : 'This is discovery only. No old transaction is being added.'}
          </Reassurance>
        </>
      );
      footer = summary ? (
        <AppButton label="Continue" size="cta" onPress={next} />
      ) : scanError ? (
        <AppButton label="Try again" size="cta" onPress={runDiscovery} />
      ) : (
        <View style={styles.waiting}><ActivityIndicator color={colors.mintGreenDark} /></View>
      );
      break;
    }
    case 'accounts': {
      const decidedAllMissing = missingPrevious.every((p) => missingChoice[keyOf(p)]);
      body = (
        <>
          <Heading>{mode === 'learn' ? 'New account found' : 'Accounts found'}</Heading>
          <Body muted style={{ marginBottom: Spacing.block }}>
            {mode === 'learn'
              ? "These accounts weren't part of your setup. Choose any you want Arthik to track."
              : 'Choose which accounts Arthik should track. Unselected accounts are never logged.'}
          </Body>
          {grouped.length === 0 ? (
            <Card>
              <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>No bank accounts found yet</Text>
              <Body muted>
                That's okay. When a new bank SMS arrives, Arthik will show the account in Automatic Logging → Tracked Accounts so you can choose it.
              </Body>
            </Card>
          ) : (
            grouped.map(([bank, list]) => (
              <Card key={bank}>
                <Text style={[styles.bankName, { color: colors.textPrimary }]}>{bank}</Text>
                {list.map((a, idx) => {
                  const isPrev = previous.some((p) => keyOf(p) === a.key);
                  const isNew = mode === 'resetup' && !isPrev;
                  return (
                    <Pressable
                      key={a.key}
                      onPress={() => toggle(a.key)}
                      style={[styles.accRow, idx < list.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}
                    >
                      <Checkbox checked={selected.has(a.key)} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.accText, { color: colors.textPrimary }]}>
                          ••••{a.last4} <Text style={{ color: colors.textSecondary, fontSize: FontSize.caption }}>{a.kind === 'card' ? 'Card' : 'Account'}</Text>
                        </Text>
                        <Text style={[styles.accSub, { color: colors.textSecondary }]}>
                          {a.msgCount} message{a.msgCount === 1 ? '' : 's'}
                          {a.lastSeen ? ` · last seen ${dateTime(a.lastSeen)}` : ''}
                        </Text>
                      </View>
                      {isPrev ? <Text style={[styles.tag, { color: colors.mintGreenDark }]}>Previously tracked</Text> : null}
                      {isNew ? <Text style={[styles.tag, { color: colors.peachCoral }]}>New account found</Text> : null}
                    </Pressable>
                  );
                })}
              </Card>
            ))
          )}
          {missingPrevious.map((p) => {
            const k = keyOf(p);
            const choice = missingChoice[k];
            return (
              <Card key={k} tone="peach">
                <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>
                  We couldn't find recent activity for {accountLabel(p)}
                </Text>
                <Body muted>Your account has not been deleted. Do you want to keep tracking it?</Body>
                <View style={styles.row2}>
                  <AppButton label={choice === 'keep' ? '✓ Keep account' : 'Keep account'} variant={choice === 'keep' ? 'primary' : 'outline'} size="compact" style={{ flex: 1 }} onPress={() => setMissingChoice((m) => ({ ...m, [k]: 'keep' }))} />
                  <AppButton label={choice === 'remove' ? '✓ Remove account' : 'Remove account'} variant={choice === 'remove' ? 'danger' : 'outline'} size="compact" style={{ flex: 1 }} onPress={() => setMissingChoice((m) => ({ ...m, [k]: 'remove' }))} />
                </View>
              </Card>
            );
          })}
        </>
      );
      footer = (
        <AppButton
          label={
            selected.size > 0
              ? `Track ${selected.size} account${selected.size === 1 ? '' : 's'}`
              : grouped.length === 0 || mode === 'learn'
              ? 'Continue'
              : 'Select at least one account'
          }
          size="cta"
          disabled={(selected.size === 0 && grouped.length > 0 && mode !== 'learn') || !decidedAllMissing}
          onPress={next}
        />
      );
      break;
    }
    case 'review': {
      const items = summary?.suspicious ?? [];
      const remaining = items.filter((e) => !handled[e.id]);
      body = (
        <>
          <Heading>A few messages need your help</Heading>
          <Body muted style={{ marginBottom: Spacing.block }}>
            Arthik found messages that look financial but could not confidently understand them. Reviewing them helps Automatic Logging work better.
          </Body>
          <Reassurance>Reviewing only teaches Arthik. Nothing will be added to your history.</Reassurance>
          {items.map((e) => (
            <Card key={e.id} style={handled[e.id] ? { opacity: 0.55 } : undefined}>
              <Text style={[styles.reviewSender, { color: colors.textSecondary }]}>{e.sender} · {dateTime(e.occurredAt)}</Text>
              <Text style={[styles.reviewBody, { color: colors.textPrimary }]} numberOfLines={3}>{e.body}</Text>
              {handled[e.id] ? (
                <Text style={[styles.tag, { color: colors.mintGreenDark, marginTop: Spacing.element }]}>
                  {handled[e.id] === 'learned' ? "✓ We'll use this format for future transactions." : '✓ Ignored'}
                </Text>
              ) : (
                <View style={styles.row2}>
                  <AppButton label="Review" size="compact" style={{ flex: 1 }} onPress={() => setReviewEvent(e)} />
                </View>
              )}
            </Card>
          ))}
          <Body muted style={{ textAlign: 'center' }}>
            The more accurately you accept, correct, or reject detections, the better Automatic Logging becomes.
          </Body>
        </>
      );
      footer = <AppButton label={remaining.length ? `Skip ${remaining.length} & finish` : 'Finish'} size="cta" onPress={next} />;
      break;
    }
    case 'complete': {
      const trackedCount = mode === 'learn' ? selected.size : selected.size + missingPrevious.filter((p) => missingChoice[keyOf(p)] !== 'remove').length;
      body = finalCounts ? (
        <>
          {hero(<CheckCircle2 size={32} color={colors.textPrimary} />, mode === 'resetup' ? '✓ Setup complete' : '✓ Discovery complete')}
          <Card>
            {mode === 'learn' ? (
              <>
                <Bullet tone="ok">{summary?.formatsLearned ?? 0} new transaction format{summary?.formatsLearned === 1 ? '' : 's'} learned</Bullet>
                <Bullet tone="ok">{ignoredCount} message{ignoredCount === 1 ? '' : 's'} ignored</Bullet>
                <Bullet tone="ok">0 transactions added</Bullet>
              </>
            ) : (
              <>
                <Bullet tone="ok">{trackedCount} account{trackedCount === 1 ? '' : 's'} selected</Bullet>
                <Bullet tone="ok">{finalCounts.formats} transaction format{finalCounts.formats === 1 ? '' : 's'} understood</Bullet>
                {mode === 'resetup' && summary?.newAccountKeys.length ? (
                  <Bullet tone="ok">{summary.newAccountKeys.filter((k) => !previous.some((p) => keyOf(p) === k)).length} new account(s) found</Bullet>
                ) : null}
                <Bullet tone="ok">{reviewedCount} message{reviewedCount === 1 ? '' : 's'} reviewed</Bullet>
              </>
            )}
          </Card>
          <Reassurance>
            {mode === 'resetup'
              ? 'Nothing from the period when Arthik was unavailable was added.'
              : mode === 'learn'
              ? 'Nothing from the period you were signed out was added.'
              : 'Nothing from your old messages was added to your transaction history.'}
          </Reassurance>
          <Body muted style={{ textAlign: 'center' }}>Your choices will help Arthik detect future transactions better.</Body>
          <Card tone="mint" style={{ marginTop: Spacing.block }}>
            <View style={styles.liveRow}>
              <Zap size={20} color={colors.mintGreenDark} />
              <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: 0 }]}>
                {mode === 'learn' ? 'Automatic Logging has resumed' : 'Automatic Logging is now active'}
              </Text>
            </View>
          </Card>
        </>
      ) : (
        <View style={styles.waiting}><ActivityIndicator color={colors.mintGreenDark} /></View>
      );
      footer = finalCounts ? <AppButton label="Done" size="cta" onPress={() => navigation.popTo('AutoLogCenter')} /> : null;
      break;
    }
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader
        title={mode === 'learn' ? 'Discovery' : 'Set up'}
        onBack={step === 'complete' ? undefined : leave}
        right={<StepDots count={steps.length} index={stepIndex} />}
      />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 'discovery' || step === 'review' || step === 'accounts' ? (
          <View style={[styles.modePill, { backgroundColor: colors.cardSubtle }]}>
            <ShieldCheck size={14} color={colors.mintGreenDark} />
            <Text style={[styles.modePillText, { color: colors.textSecondary }]}>Discovery · Learning from messages. Nothing is logged.</Text>
          </View>
        ) : null}
        {body}
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.block, borderTopColor: colors.borderSubtle, backgroundColor: colors.background }]}>
        {toast ? <Text style={[styles.toast, { color: colors.mintGreenDark }]}>{toast}</Text> : null}
        {footer}
      </View>
      <ReviewSheet
        visible={!!reviewEvent}
        event={reviewEvent}
        accounts={accounts}
        discovery
        onClose={() => setReviewEvent(null)}
        onDone={(msg) => {
          if (reviewEvent) setHandled((h) => ({ ...h, [reviewEvent.id]: msg.startsWith('We') ? 'learned' : 'ignored' }));
          setReviewEvent(null);
          setToast(msg);
          setTimeout(() => setToast(null), 2500);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.section },
  footer: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.group, borderTopWidth: 1 },
  hero: { alignItems: 'center', marginVertical: Spacing.surface },
  cardTitle: { fontSize: FontSize.body, lineHeight: LineHeight.body, fontFamily: FontFamily.bold, marginBottom: Spacing.micro },
  counter: { fontSize: FontSize.display, lineHeight: LineHeight.display, fontFamily: FontFamily.bold },
  recommend: { borderRadius: BorderRadius.input, padding: Spacing.group, marginVertical: Spacing.group },
  recommendText: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  row2: { flexDirection: 'row', gap: Spacing.group, marginTop: Spacing.group },
  waiting: { height: 60, alignItems: 'center', justifyContent: 'center' },
  bankName: { fontSize: FontSize.titleSmall, fontFamily: FontFamily.bold, marginBottom: Spacing.micro },
  accRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, paddingVertical: Spacing.group },
  accText: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
  accSub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: Spacing.nano },
  tag: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
  reviewSender: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, marginBottom: Spacing.micro },
  reviewBody: { fontSize: FontSize.bodySmall, lineHeight: LineHeight.bodySmall + 2, fontFamily: FontFamily.medium },
  modePill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: BorderRadius.pill, paddingHorizontal: Spacing.group, paddingVertical: 6, marginBottom: Spacing.group },
  modePillText: { fontSize: FontSize.caption, fontFamily: FontFamily.semibold },
  toast: { textAlign: 'center', fontSize: FontSize.caption, fontFamily: FontFamily.bold, marginBottom: Spacing.element },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.element },
});
