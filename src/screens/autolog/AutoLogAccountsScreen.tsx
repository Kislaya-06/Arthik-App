import React, { useCallback } from 'react';
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
import { Body, Card, ScreenHeader } from '../../components/autolog/AutoLogUi';
import { useAutoLogStore } from '../../features/autoLog/store';
import * as service from '../../features/autoLog/service';
import { dateTime } from '../../features/autoLog/copy';
import type { TrackedAccount } from '../../features/autoLog/types';

type Props = NativeStackScreenProps<RootStackParamList, 'AutoLogAccounts'>;

/** Only tracked accounts are eligible for Automatic Logging (spec §7). The user decides — always. */
export const AutoLogAccountsScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const userId = useAuthStore((s) => s.user?.id);
  const accounts = useAutoLogStore((s) => s.accounts);
  const refresh = useAutoLogStore((s) => s.refresh);

  useFocusEffect(useCallback(() => { refresh(userId); }, [refresh, userId]));

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

  const byBank = new Map<string, TrackedAccount[]>();
  for (const a of accounts) byBank.set(a.bank, [...(byBank.get(a.bank) ?? []), a]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <ScreenHeader title="Tracked Accounts" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing.section }]}>
        <Body muted style={{ marginBottom: Spacing.block }}>
          Turn on the accounts Arthik should log. Messages from other accounts are never turned into transactions.
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
                    ••••{a.last4} <Text style={{ color: colors.textSecondary, fontSize: FontSize.caption }}>{a.kind === 'card' ? 'Card' : 'Account'}</Text>
                    {a.isNew && !a.tracked ? <Text style={{ color: colors.peachCoral, fontSize: FontSize.caption }}>  · New</Text> : null}
                  </Text>
                  <Text style={[styles.sub, { color: colors.textSecondary }]}>
                    {a.lastSeen ? `Last activity ${dateTime(a.lastSeen)}` : 'No recent activity found'}
                  </Text>
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
      </ScrollView>
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
});
