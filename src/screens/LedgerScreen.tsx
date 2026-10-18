import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, ChevronDown, ChevronUp, Users } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { RootStackParamList } from '../types';
import { useTheme } from '../store/themeStore';
import { useExpenseStore } from '../store/expenseStore';
import { buildPersonSummaries } from '../lib/splitLedger';
import { formatCurrency, round2 } from '../lib/formatters';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Ledger'>;

const day = (iso: string): string => {
  try {
    return format(parseISO(iso), 'd MMM yyyy');
  } catch {
    return iso;
  }
};

/**
 * Ledger: everyone the user split an expense with: who still owes how much, what was paid back and when,
 * and which expenses are fully settled (SPL-001, SPL-002). Everything is derived from the expense rows.
 */
export const LedgerScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const expenses = useExpenseStore((s) => s.expenses);
  const people = useMemo(() => buildPersonSummaries(expenses), [expenses]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const totalOwed = useMemo(() => round2(people.reduce((sum, p) => sum + p.owed, 0)), [people]);
  const owingCount = people.filter((p) => !p.isSettled).length;

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.canGoBack() && navigation.goBack()} hitSlop={10} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Ledger</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, Spacing.block) + Spacing.section }]}
      >
        {people.length === 0 ? (
          <View style={styles.empty}>
            <Users size={40} color={colors.textMuted} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>Nothing to track yet</Text>
            <Text style={[styles.sub, { color: colors.textSecondary, textAlign: 'center' }]}>
              When you split an expense with someone, what they owe you shows up here.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.summary, { backgroundColor: colors.mintGreen }]}>
              <Text style={[styles.summaryLabel, { color: colors.forestGreen }]}>YOU WILL GET BACK</Text>
              <Text style={[styles.summaryAmount, { color: colors.forestGreen }]}>{formatCurrency(totalOwed)}</Text>
              <Text style={[styles.summarySub, { color: colors.forestGreen }]}>
                {owingCount === 0 ? 'Everyone is settled' : `from ${owingCount} ${owingCount === 1 ? 'person' : 'people'}`}
              </Text>
            </View>

            {people.map((p) => {
              const open = openKey === p.key;
              return (
                <View key={p.key} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}>
                  <Pressable
                    onPress={() => setOpenKey(open ? null : p.key)}
                    style={styles.personRow}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${p.name}, ${p.isSettled ? 'settled' : `owes ${formatCurrency(p.owed)}`}`}
                  >
                    <View style={styles.flex}>
                      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[styles.sub, { color: colors.textSecondary }]}>
                        Shared {formatCurrency(p.totalShared)} · Paid back {formatCurrency(p.totalPaidBack)}
                      </Text>
                    </View>
                    <View style={styles.right}>
                      {p.isSettled ? (
                        <StatusBadge variant="success" label="SETTLED" />
                      ) : (
                        <Text style={[styles.owed, { color: colors.coral }]}>{formatCurrency(p.owed)}</Text>
                      )}
                    </View>
                    {open ? <ChevronUp size={18} color={colors.textSecondary} /> : <ChevronDown size={18} color={colors.textSecondary} />}
                  </Pressable>

                  {open ? (
                    <View style={[styles.details, { borderTopColor: colors.borderSubtle }]}>
                      <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>EXPENSES</Text>
                      {p.splits.map((s) => (
                        <Pressable
                          key={s.expenseId}
                          onPress={() => navigation.navigate('ExpenseDetail', { expenseId: s.expenseId })}
                          style={styles.line}
                          accessibilityRole="button"
                        >
                          <View style={styles.flex}>
                            <Text numberOfLines={1} style={[styles.lineTitle, { color: colors.textPrimary }]}>{s.note || 'Expense'}</Text>
                            <Text style={[styles.sub, { color: colors.textSecondary }]}>
                              {day(s.date)} · Their share {formatCurrency(s.theirShare)}
                              {s.settled > 0 && !s.isSettled ? ` · Paid ${formatCurrency(s.settled)}` : ''}
                            </Text>
                          </View>
                          {s.isSettled ? (
                            <StatusBadge variant="success" label="SETTLED" />
                          ) : (
                            <Text style={[styles.lineAmount, { color: colors.coral }]}>{formatCurrency(s.outstanding)} left</Text>
                          )}
                        </Pressable>
                      ))}

                      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: Spacing.group }]}>PAID BACK</Text>
                      {p.payments.length === 0 ? (
                        <Text style={[styles.sub, { color: colors.textSecondary }]}>Nothing paid back yet.</Text>
                      ) : (
                        p.payments.map((pay) => (
                          <Pressable
                            key={pay.id}
                            onPress={() => navigation.navigate('ExpenseDetail', { expenseId: pay.id })}
                            style={styles.line}
                            accessibilityRole="button"
                          >
                            <Text style={[styles.lineTitle, styles.flex, { color: colors.textPrimary }]}>{day(pay.date)}</Text>
                            <Text style={[styles.lineAmount, { color: isDark ? colors.mintGreen : colors.mintGreenDark }]}>+{formatCurrency(pay.amount)}</Text>
                          </Pressable>
                        ))
                      )}
                    </View>
                  ) : null}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.gutter, marginTop: Spacing.block, marginBottom: Spacing.element },
  headerTitle: { marginLeft: Spacing.block, fontSize: FontSize.titleMedium, lineHeight: LineHeight.titleMedium, fontFamily: FontFamily.bold },
  content: { paddingHorizontal: Spacing.gutter, gap: Spacing.block },
  summary: { borderRadius: BorderRadius.card, padding: Spacing.surface, gap: Spacing.micro },
  summaryLabel: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
  summaryAmount: { fontSize: FontSize.display, lineHeight: LineHeight.display, fontFamily: FontFamily.bold },
  summarySub: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium },
  card: { borderRadius: BorderRadius.card, borderWidth: 1, overflow: 'hidden' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, padding: Spacing.surface },
  right: { alignItems: 'flex-end' },
  name: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
  owed: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
  details: { borderTopWidth: StyleSheet.hairlineWidth, padding: Spacing.surface, gap: Spacing.group },
  sectionLabel: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
  line: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group },
  lineTitle: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  lineAmount: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  empty: { alignItems: 'center', gap: Spacing.group, paddingTop: Spacing.section },
  emptyTitle: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
});
