import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { RootStackParamList } from '../../types';
import { useTheme } from '../../store/themeStore';
import { useAuthStore } from '../../store/authStore';
import { Spacing, FontSize, FontFamily } from '../../config/theme';
import { AnimatedToggle } from '../../components/AnimatedToggle';
import { AppButton } from '../../components/ui/AppButton';
import { Body, Card, ScreenHeader, SectionLabel } from '../../components/autolog/AutoLogUi';
import { PressableOpacity } from '../../components/ui/PressableOpacity';
import { RenameAccountSheet } from '../../components/autolog/RenameAccountSheet';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';
import { useAutoLogStore } from '../../features/autoLog/store';
import * as service from '../../features/autoLog/service';
import { dateTime } from '../../features/autoLog/copy';
import type { TrackedAccount } from '../../features/autoLog/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogAccounts'>;

/**
 * Only tracked accounts are eligible for Automatic Logging (spec §7). The user decides — always.
 * "Not my account" hides an account for good (AUT-005); hidden ones are listed at the bottom to undo.
 */
export const AutoLogAccountsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const accounts = useAutoLogStore((s) => s.accounts);
  const refresh = useAutoLogStore((s) => s.refresh);

  const [hidden, setHidden] = useState<TrackedAccount[]>([]);
  const [renaming, setRenaming] = useState<TrackedAccount | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    await refresh(userId);
    try {
      setHidden(await service.listHiddenAccounts(userId));
    } catch {
      setHidden([]);
    }
  }, [refresh, userId]);

  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const toggle = async (a: TrackedAccount, value: boolean) => {
    if (!userId) return;
    await service.setTracked(userId, a.key, value);
    await refresh(userId);
  };

  const remove = (a: TrackedAccount) => {
    if (!userId) return;
    Alert.alert(`Remove ${a.bank} ••••${a.last4}?`, 'It will no longer be tracked. Transactions already logged stay in your history. If a new message from it arrives, it will show up here again as a new account.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await service.removeTrackedAccount(userId, a.key); await refresh(userId); } },
    ]);
  };

  const hide = (a: TrackedAccount) => {
    if (!userId) return;
    Alert.alert(
      `Hide ${a.bank} ••••${a.last4}?`,
      'Arthik will stop showing and logging it, even when new messages mention it. Transactions already logged stay in your history. You can show it again at the bottom of this page.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Hide', style: 'destructive', onPress: async () => { await service.hideAccount(userId, a.key); await reload(); } },
      ]
    );
  };

  const unhide = async (a: TrackedAccount) => {
    if (!userId) return;
    await service.unhideAccount(userId, a.key);
    await reload();
  };

  const byBank = new Map<string, TrackedAccount[]>();
  for (const a of accounts) byBank.set(a.bank, [...(byBank.get(a.bank) ?? []), a]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader title="Tracked Accounts" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.section }]}>
        <Body muted style={{ marginBottom: Spacing.block }}>
          Turn on the accounts Arthik should log. Messages from other accounts are never turned into transactions. See one that isn't yours? Tap “Not my account”.
        </Body>
        {accounts.length === 0 ? (
          <Card><Body muted>No accounts found yet. They appear here as soon as a bank SMS arrives.</Body></Card>
        ) : null}
        {Array.from(byBank.entries()).map(([bank, list]) => (
          <Card key={bank}>
            <Text style={[styles.bank, { color: colors.textPrimary }]}>{bank}</Text>
            {list.map((a, i) => (
              <View key={a.key} style={[styles.row, i < list.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.acc, { color: colors.textPrimary }]}>
                    {a.nickname ? `${a.nickname} ` : ''}••••{a.last4} <Text style={{ color: colors.textSecondary, fontSize: FontSize.caption }}>{a.kind === 'card' ? 'Card' : 'Account'}</Text>
                    {a.isNew && !a.tracked ? <Text style={{ color: colors.coralText, fontSize: FontSize.caption }}>  · New</Text> : null}
                  </Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    {a.msgCount > 0 ? `Seen in ${a.msgCount} message${a.msgCount === 1 ? '' : 's'} · ` : ''}
                    {a.lastSeen ? `Last activity ${dateTime(a.lastSeen)}` : 'No recent activity found'}
                  </Text>
                  <View style={styles.links}>
                    <PressableOpacity
                      activeOpacity={PRESS_DIM_OPACITY}
                      onPress={() => setRenaming(a)}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Rename ${a.bank} ending ${a.last4}`}
                    >
                      <Text style={[styles.linkText, { color: colors.mintText }]}>{a.nickname ? 'Rename' : 'Add a name'}</Text>
                    </PressableOpacity>
                    <PressableOpacity
                      activeOpacity={PRESS_DIM_OPACITY}
                      onPress={() => hide(a)}
                      hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Not my account: hide ${a.bank} ending ${a.last4}`}
                    >
                      <Text style={[styles.linkText, { color: colors.textSecondary }]}>Not my account</Text>
                    </PressableOpacity>
                  </View>
                </View>
                <AnimatedToggle value={a.tracked} onValueChange={(v) => toggle(a, v)} />
              </View>
            ))}
            {list.some((a) => a.tracked && !a.lastSeen) ? (
              <View style={{ marginTop: Spacing.element }}>
                {list.filter((a) => a.tracked && !a.lastSeen).map((a) => (
                  <AppButton key={a.key} label={`Remove ••••${a.last4}`} variant="outline" size="compact" onPress={() => remove(a)} />
                ))}
              </View>
            ) : null}
          </Card>
        ))}
        {hidden.length > 0 ? (
          <View style={{ marginTop: Spacing.block }}>
            <SectionLabel>Hidden accounts</SectionLabel>
            <Card>
              <Body muted style={{ marginBottom: Spacing.element }}>Never shown above and never logged.</Body>
              {hidden.map((a, i) => (
                <View key={a.key} style={[styles.row, i < hidden.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle }]}>
                  <Text style={[styles.acc, { flex: 1, color: colors.textPrimary }]}>
                    {a.bank} <Text style={{ color: colors.textSecondary }}>••••{a.last4}</Text>
                  </Text>
                  <AppButton label="Show again" variant="outline" size="compact" onPress={() => unhide(a)} />
                </View>
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
      <RenameAccountSheet
        account={renaming}
        maxLength={service.NICKNAME_MAX}
        onClose={() => setRenaming(null)}
        onSave={async (name) => {
          if (!userId || !renaming) return;
          await service.renameAccount(userId, renaming.key, name);
          setRenaming(null);
          await reload();
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.gutter },
  bank: { fontSize: FontSize.titleSmall, fontFamily: FontFamily.bold, marginBottom: Spacing.micro },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.group, gap: Spacing.group },
  acc: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: Spacing.nano },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.block, marginTop: Spacing.element },
  linkText: { fontSize: FontSize.caption, fontFamily: FontFamily.semibold, textDecorationLine: 'underline' },
});
