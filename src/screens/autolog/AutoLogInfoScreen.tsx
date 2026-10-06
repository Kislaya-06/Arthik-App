import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Lock } from 'lucide-react-native';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { Spacing, FontSize, FontFamily } from '../../config/theme';
import { Body, Bullet, Card, ScreenHeader, SectionLabel, StatusDot } from '../../components/autolog/AutoLogUi';
import { useAutoLogStore } from '../../features/autoLog/store';
import { accountLabel, modeCopy, relative, STATE_COPY } from '../../features/autoLog/copy';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogInfo'>;

/** "How it works" + Privacy Center (spec §24, §25, §43, §44). Explains actual behaviour — no vague claims. */
export const AutoLogInfoScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const s = useAutoLogStore();
  const section = route.params?.section ?? 'how';
  const tracked = s.accounts.filter((a) => a.tracked);
  const copy = modeCopy(s.mode, s.attention);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader title={section === 'privacy' ? 'Privacy' : 'How it works'} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.section }]}>
        {section === 'privacy' ? (
          <>
            <Card>
              <Text style={[styles.h, { color: colors.textPrimary }]}>Automatic Logging</Text>
              <StatusDot tone={s.mode === 'live' ? (s.attention ? 'attention' : 'live') : s.mode === 'off' ? 'off' : 'paused'} label={copy.title} />
              {tracked.length ? (
                <View style={{ marginTop: Spacing.group }}>
                  {tracked.map((a) => <Text key={a.key} style={[styles.acc, { color: colors.textPrimary }]}>{accountLabel(a)}</Text>)}
                </View>
              ) : null}
              <Body muted style={{ marginTop: Spacing.element }}>Last checked: {relative(s.lastChecked)}</Body>
              <View style={styles.lock}>
                <Lock size={14} color={colors.mintGreenDark} />
                <Text style={[styles.lockText, { color: colors.mintGreenDark }]}>Processed on this device</Text>
              </View>
            </Card>
            <Card>
              <SectionLabel>On this phone</SectionLabel>
              <Bullet tone="ok">SMS content: Not uploaded for transaction detection</Bullet>
              <Bullet tone="ok">Personal messages: Not processed — SMS from phone numbers are dropped before anything else runs</Bullet>
              <Bullet tone="ok">OTP messages: Not processed</Bullet>
              <Bullet tone="ok">Detection data is stored in an encrypted database that only Arthik can open</Bullet>
              <Bullet tone="ok">Only the accounts you select can create transactions</Bullet>
            </Card>
            <Card>
              <SectionLabel>What Arthik reads</SectionLabel>
              <Text style={[styles.sub, { color: colors.textPrimary }]}>Used</Text>
              <Bullet tone="ok">Supported bank transaction SMS</Bullet>
              <Bullet tone="ok">Payment notifications from Google Pay, PhonePe, Paytm, Navi, BHIM, CRED, Amazon Pay, MobiKwik, super.money</Bullet>
              <Text style={[styles.sub, { color: colors.textPrimary, marginTop: Spacing.group }]}>Not used as transaction inputs</Text>
              <Bullet tone="no">OTP messages</Bullet>
              <Bullet tone="no">Personal SMS</Bullet>
              <Bullet tone="no">Promotional / unrelated messages</Bullet>
              <Bullet tone="no">Notifications from any other app</Bullet>
            </Card>
            <Card>
              <SectionLabel>What leaves your phone</SectionLabel>
              <Body>
                Only what Arthik needs to notice a re-install: whether Automatic Logging is on, a few timestamps (setup, last active, signed out), and your tracked accounts as bank name + last 4 digits. Never SMS text, notification text, senders or amounts.
              </Body>
              <Body muted style={{ marginTop: Spacing.element }}>
                The transactions themselves sync like any transaction you add by hand.
              </Body>
            </Card>
            <Card>
              <SectionLabel>Improve detection (sharing)</SectionLabel>
              <Body>Off. Arthik does not share messages to improve its parser. If this is ever offered, it will be opt-in, masked on your phone first, and you will see exactly what would be shared.</Body>
            </Card>
          </>
        ) : (
          <>
            <Card>
              <SectionLabel>The three modes</SectionLabel>
              {(['discovery', 'recovery', 'live'] as const).map((k) => (
                <View key={k} style={{ marginBottom: Spacing.group }}>
                  <Text style={[styles.h2, { color: colors.textPrimary }]}>{STATE_COPY[k].title}</Text>
                  <Body muted>{STATE_COPY[k].body}</Body>
                </View>
              ))}
              <Body style={{ fontFamily: FontFamily.bold }}>Discovery = learning, not logging.</Body>
            </Card>
            <Card>
              <SectionLabel>When a payment happens</SectionLabel>
              <Bullet>A payment app notification arrives → "Payment detected · Waiting for bank confirmation".</Bullet>
              <Bullet>The bank SMS arrives → Arthik checks amount, direction, time, account and reference.</Bullet>
              <Bullet>If both describe the same payment, they become one transaction ("Matched automatically").</Bullet>
              <Bullet>Sure about it → logged automatically. Not sure → Pending Review. Arthik never guesses.</Bullet>
              <Bullet>If no bank SMS comes within 20 minutes, the payment waits in Pending Review instead of being logged.</Bullet>
            </Card>
            <Card>
              <SectionLabel>Accuracy rules</SectionLabel>
              <Bullet tone="ok">An account balance is never read as a transaction amount.</Bullet>
              <Bullet tone="ok">"Will be debited", mandates, reminders, collect requests, failed or declined payments are not transactions.</Bullet>
              <Bullet tone="ok">Two real ₹20 payments a few minutes apart stay two transactions.</Bullet>
              <Bullet tone="ok">Moving money between your own tracked accounts is not an expense. Credit-card bill payments don't double count.</Bullet>
              <Bullet tone="ok">If a payment looks like one you already added by hand, Arthik asks first.</Bullet>
            </Card>
            <Card>
              <SectionLabel>Signing out, reinstalling</SectionLabel>
              <Bullet>Signed out → nothing is logged. When you sign in, choose: recover the missed period, or only learn from it.</Bullet>
              <Bullet>App uninstalled or data cleared → setup starts fresh. The unavailable period is never added as transactions.</Bullet>
              <Bullet>Clearing cache does not affect Automatic Logging.</Bullet>
            </Card>
            <Card>
              <SectionLabel>Teaching Arthik</SectionLabel>
              <Body>
                The more accurately you accept, correct, or reject detections, the better Automatic Logging becomes. "Remember Zomato → Food & Drinks" makes future Zomato payments log straight into that category. "Ignore similar" only ignores that exact message format from that sender.
              </Body>
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter },
  h: { fontSize: FontSize.titleSmall, fontFamily: FontFamily.bold, marginBottom: Spacing.element },
  h2: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  acc: { fontSize: FontSize.body, fontFamily: FontFamily.semibold, marginBottom: Spacing.micro },
  lock: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: Spacing.element },
  lockText: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
});
