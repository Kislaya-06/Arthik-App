import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Users from 'lucide-react-native/icons/users';
import Check from 'lucide-react-native/icons/check';
import CheckCheck from 'lucide-react-native/icons/check-check';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  interpolate,
  Easing as REasing,
  LinearTransition,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { RootStackParamList } from '../types';
import { useTheme } from '../store/themeStore';
import { useExpenseStore } from '../store/expenseStore';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { buildPersonSummaries, type LedgerSplitLine, type PersonSummary } from '../lib/splitLedger';
import { formatCurrency, round2 } from '../lib/formatters';
import { StatusBadge } from '../components/ui/StatusBadge';
import { SettleExpenseSheet, type SettleExpenseTarget } from '../components/split/SettleExpenseSheet';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, Motion } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Ledger'>;

const ChevronRotator: React.FC<{ isOpen: boolean; color: string; reduceMotion: boolean }> = React.memo(
  ({ isOpen, color, reduceMotion }) => {
    const progress = useSharedValue(isOpen ? 1 : 0);

    useEffect(() => {
      if (reduceMotion) {
        progress.value = isOpen ? 1 : 0;
        return;
      }
      progress.value = withTiming(isOpen ? 1 : 0, {
        duration: Motion.duration.snappy,
        easing: REasing.bezier(0.23, 1, 0.32, 1),
      });
    }, [isOpen, reduceMotion, progress]);

    const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ rotate: `${interpolate(progress.value, [0, 1], [0, 180])}deg` }],
    }));

    return (
      <Animated.View style={animatedStyle}>
        <ChevronDown size={18} color={color} />
      </Animated.View>
    );
  }
);

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
  const reduceMotion = useReduceMotion();
  const expenses = useExpenseStore((s) => s.expenses);
  const people = useMemo(() => buildPersonSummaries(expenses), [expenses]);
  const [openKey, setOpenKey] = useState<string | null>(null);

  const [settleTarget, setSettleTarget] = useState<{
    personName: string;
    targetExpense?: SettleExpenseTarget | null;
    totalOwed: number;
  } | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!feedbackMessage) return;
    const timer = setTimeout(() => setFeedbackMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [feedbackMessage]);

  const totalOwed = useMemo(() => round2(people.reduce((sum, p) => sum + p.owed, 0)), [people]);
  const owingCount = people.filter((p) => !p.isSettled).length;

  const handleOpenSettleExpense = (personName: string, split: LedgerSplitLine) => {
    setSettleTarget({
      personName,
      targetExpense: {
        expenseId: split.expenseId,
        note: split.note,
        outstanding: split.outstanding,
        date: split.date,
      },
      totalOwed: split.outstanding,
    });
  };

  const handleOpenSettleAll = (person: PersonSummary) => {
    setSettleTarget({
      personName: person.name,
      targetExpense: null,
      totalOwed: person.owed,
    });
  };

  return (
    <View style={[styles.safeArea, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={styles.header}>
        <Pressable onPress={() => navigation.canGoBack() && navigation.goBack()} hitSlop={10} accessibilityLabel="Go back">
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Ledger</Text>
      </View>

      {feedbackMessage ? (
        <View
          style={[
            styles.feedbackBanner,
            {
              backgroundColor: isDark ? 'rgba(184, 224, 200, 0.18)' : colors.mintGreen,
              borderColor: isDark ? 'rgba(184, 224, 200, 0.35)' : colors.mintGreenDark,
            },
          ]}
        >
          <Check size={16} color={isDark ? colors.mintGreen : colors.forestGreen} strokeWidth={2.5} />
          <Text
            numberOfLines={1}
            style={[styles.feedbackText, { color: isDark ? colors.mintGreen : colors.forestGreen }]}
          >
            {feedbackMessage}
          </Text>
        </View>
      ) : null}

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
              const hasUnsettled = !p.isSettled && p.splits.some((s) => !s.isSettled);

              return (
                <Animated.View
                  key={p.key}
                  layout={reduceMotion ? undefined : LinearTransition.duration(Motion.duration.snappy)}
                  style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
                >
                  <Pressable
                    onPress={() => setOpenKey(open ? null : p.key)}
                    style={styles.personRow}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: open }}
                    accessibilityLabel={`${p.name}, ${p.isSettled ? 'settled' : `owes ${formatCurrency(p.owed)}`}`}
                  >
                    <View style={styles.flex}>
                      <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>{p.name}</Text>
                      <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={1}>
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
                    <ChevronRotator isOpen={open} color={colors.textSecondary} reduceMotion={reduceMotion} />
                  </Pressable>

                  {open ? (
                    <Animated.View
                      entering={reduceMotion ? undefined : FadeIn.duration(160)}
                      exiting={reduceMotion ? undefined : FadeOut.duration(120)}
                      style={[styles.details, { borderTopColor: colors.borderSubtle }]}
                    >
                      {/* Expenses Section Header with Settle All shortcut */}
                      <View style={styles.sectionHeaderRow}>
                        <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>EXPENSES</Text>
                        {hasUnsettled ? (
                          <Pressable
                            onPress={() => handleOpenSettleAll(p)}
                            style={({ pressed }) => [
                              styles.settleAllPill,
                              {
                                backgroundColor: isDark ? 'rgba(184, 224, 200, 0.14)' : colors.mintGreenSoft,
                                borderColor: isDark ? 'rgba(184, 224, 200, 0.3)' : colors.mintGreen,
                              },
                              pressed && { opacity: 0.7 },
                            ]}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            accessibilityRole="button"
                            accessibilityLabel={`Settle all ${formatCurrency(p.owed)} for ${p.name}`}
                          >
                            <CheckCheck size={12} color={isDark ? colors.mintGreen : colors.forestGreen} strokeWidth={2.6} />
                            <Text style={[styles.settleAllText, { color: isDark ? colors.mintGreen : colors.forestGreen }]}>
                              Settle all ({formatCurrency(p.owed)})
                            </Text>
                          </Pressable>
                        ) : null}
                      </View>

                      {p.splits.map((s) => {
                        const isSettled = s.isSettled;
                        return (
                          <Pressable
                            key={s.expenseId}
                            onPress={() => {
                              if (isSettled) {
                                navigation.navigate('ExpenseDetail', { expenseId: s.expenseId });
                              } else {
                                handleOpenSettleExpense(p.name, s);
                              }
                            }}
                            style={({ pressed }) => [
                              styles.line,
                              pressed && { opacity: 0.65 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={
                              isSettled
                                ? `${s.note || 'Expense'}, settled`
                                : `${s.note || 'Expense'}, ${formatCurrency(s.outstanding)} left. Tap to mark as paid.`
                            }
                          >
                            <View style={styles.flex}>
                              <Text numberOfLines={1} style={[styles.lineTitle, { color: colors.textPrimary }]}>
                                {s.note || 'Expense'}
                              </Text>
                              <Text numberOfLines={1} style={[styles.sub, { color: colors.textSecondary }]}>
                                {day(s.date)} · Their share {formatCurrency(s.theirShare)}
                                {s.settled > 0 && !s.isSettled ? ` · Paid ${formatCurrency(s.settled)}` : ''}
                              </Text>
                            </View>

                            <View style={styles.lineRight}>
                              {isSettled ? (
                                <StatusBadge variant="success" label="SETTLED" />
                              ) : (
                                <Text style={[styles.lineAmount, { color: colors.coral }]}>
                                  {formatCurrency(s.outstanding)} left
                                </Text>
                              )}
                              <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.2} />
                            </View>
                          </Pressable>
                        );
                      })}

                      <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: Spacing.group }]}>PAID BACK</Text>
                      {p.payments.length === 0 ? (
                        <Text style={[styles.sub, { color: colors.textSecondary }]}>Nothing paid back yet.</Text>
                      ) : (
                        p.payments.map((pay) => (
                          <Pressable
                            key={pay.id}
                            onPress={() => navigation.navigate('ExpenseDetail', { expenseId: pay.id })}
                            style={({ pressed }) => [
                              styles.line,
                              pressed && { opacity: 0.65 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Paid back ${formatCurrency(pay.amount)} on ${day(pay.date)}`}
                          >
                            <Text style={[styles.lineTitle, styles.flex, { color: colors.textPrimary }]}>
                              {day(pay.date)}
                            </Text>
                            <View style={styles.lineRight}>
                              <Text style={[styles.lineAmount, { color: isDark ? colors.mintGreen : colors.mintGreenDark }]}>
                                +{formatCurrency(pay.amount)}
                              </Text>
                              <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.2} />
                            </View>
                          </Pressable>
                        ))
                      )}
                    </Animated.View>
                  ) : null}
                </Animated.View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Settle Expense / Settle All Bottom Sheet Modal */}
      {settleTarget ? (
        <SettleExpenseSheet
          visible={!!settleTarget}
          onClose={() => setSettleTarget(null)}
          personName={settleTarget.personName}
          targetExpense={settleTarget.targetExpense}
          totalOwed={settleTarget.totalOwed}
          onSettled={(msg) => setFeedbackMessage(msg)}
          onViewExpense={(expenseId) => navigation.navigate('ExpenseDetail', { expenseId })}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1, minWidth: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
  },
  headerTitle: {
    marginLeft: Spacing.block,
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
  },
  feedbackBanner: {
    marginHorizontal: Spacing.gutter,
    marginBottom: Spacing.element,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.element,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
  },
  feedbackText: {
    flex: 1,
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.element,
  },
  sectionLabel: { fontSize: FontSize.caption, fontFamily: FontFamily.bold },
  settleAllPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.element,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    gap: 4,
  },
  settleAllText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.element,
    minHeight: 46,
    paddingVertical: 4,
    borderRadius: BorderRadius.input,
  },
  lineTitle: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold },
  lineAmount: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  lineRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  empty: { alignItems: 'center', gap: Spacing.group, paddingTop: Spacing.section },
  emptyTitle: { fontSize: FontSize.body, fontFamily: FontFamily.bold },
});
