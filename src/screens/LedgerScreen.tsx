import React, { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import { EmptyState, EMPTY_STATE_TOP_OFFSET } from '../components/ui/EmptyState';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import Users from 'lucide-react-native/icons/users';
import Check from 'lucide-react-native/icons/check';
import CheckCheck from 'lucide-react-native/icons/check-check';
import Animated, { LinearTransition, FadeIn, FadeOut } from 'react-native-reanimated';
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
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight, Motion, LetterSpacing } from '../config/theme';
import { PressableOpacity } from '../components/ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../lib/pressFeedback';
import { AppButton } from '../components/ui/AppButton';
import { PersonInitial, TallyBar } from './ledger/LedgerParts';
import { ChevronRotator } from '../components/ui/ChevronRotator';

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
  // Display only: the same per-person totals the rows already show, added up for the hero tally.
  const totalShared = useMemo(() => round2(people.reduce((sum, p) => sum + p.totalShared, 0)), [people]);
  const totalBack = useMemo(() => round2(people.reduce((sum, p) => sum + p.totalPaidBack, 0)), [people]);
  const owingCount = people.filter((p) => !p.isSettled).length;
  const owing = people.filter((p) => !p.isSettled);
  const settled = people.filter((p) => p.isSettled);

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
      <ScreenHeader title="Ledger" />

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
            numberOfLines={2}
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
          <EmptyState
            icon={Users}
            title="Nothing to track yet"
            subtitle="When you split an expense with someone, what they owe you shows up here."
            action={{ label: 'Add an expense to split', onPress: () => navigation.navigate('AddExpense') }}
            style={styles.empty}
          />
        ) : (
          <>
            <View style={[styles.summary, { backgroundColor: colors.mintGreen }]}>
              <Text style={[styles.summaryLabel, { color: colors.forestGreen }]}>YOU WILL GET BACK</Text>
              <Text
                style={[styles.summaryAmount, { color: colors.forestGreen }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.7}
              >
                {formatCurrency(totalOwed)}
              </Text>
              <Text style={[styles.summarySub, { color: colors.forestGreen }]}>
                {owingCount === 0 ? 'Everyone is settled' : `from ${owingCount} ${owingCount === 1 ? 'person' : 'people'}`}
              </Text>
              {totalShared > 0 ? (
                <View
                  style={styles.summaryTally}
                  accessible
                  accessibilityLabel={`${formatCurrency(totalBack)} paid back of ${formatCurrency(totalShared)} shared`}
                >
                  <TallyBar
                    paid={totalBack}
                    total={totalShared}
                    fillColor={colors.forestGreen}
                    trackColor={colors.forestGreen}
                    trackOpacity={0.14}
                    height={8}
                  />
                  <View style={styles.tallyCaptionRow}>
                    <Text style={[styles.tallyCaptionStrong, { color: colors.forestGreen }]}>
                      {formatCurrency(totalBack)} back
                    </Text>
                    <Text style={[styles.tallyCaption, { color: colors.forestGreen }]}>
                      of {formatCurrency(totalShared)} shared
                    </Text>
                  </View>
                </View>
              ) : null}
            </View>

            {[
              { key: 'owing', label: 'OWES YOU', list: owing },
              { key: 'settled', label: 'SETTLED', list: settled },
            ].filter((g) => g.list.length > 0).map((group) => (
              <View key={group.key} style={styles.group}>
                <Text style={[styles.groupLabel, { color: colors.textSecondary }]} accessibilityRole="header">
                  {group.label}
                </Text>
                {group.list.map((p) => {
                  const open = openKey === p.key;
                  const hasUnsettled = !p.isSettled && p.splits.some((s) => !s.isSettled);

                  return (
                    <Animated.View
                      key={p.key}
                      layout={reduceMotion ? undefined : LinearTransition.duration(Motion.duration.snappy)}
                      style={[styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
                    >
                      <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
                        onPress={() => setOpenKey(open ? null : p.key)}
                        style={styles.personRow}
                        accessibilityRole="button"
                        accessibilityState={{ expanded: open }}
                        accessibilityLabel={`${p.name}, ${p.isSettled ? 'settled' : `owes ${formatCurrency(p.owed)}`}`}
                      >
                        <PersonInitial name={p.name} isDark={isDark} />
                        <View style={[styles.flex, styles.personBody]}>
                          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={2}>{p.name}</Text>
                          {!p.isSettled && p.totalShared > 0 ? (
                            <>
                              <TallyBar
                                paid={p.totalPaidBack}
                                total={p.totalShared}
                                fillColor={colors.mintText}
                                trackColor={colors.chartTrack}
                              />
                              <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
                                {formatCurrency(p.totalPaidBack)} back of {formatCurrency(p.totalShared)}
                              </Text>
                            </>
                          ) : (
                            <Text style={[styles.sub, { color: colors.textSecondary }]} numberOfLines={2}>
                              {p.isSettled
                                ? `${formatCurrency(p.totalShared)} shared · all paid back`
                                : `Shared ${formatCurrency(p.totalShared)} · Paid back ${formatCurrency(p.totalPaidBack)}`}
                            </Text>
                          )}
                        </View>
                        <View style={styles.right}>
                          {p.isSettled ? (
                            <StatusBadge variant="success" label="SETTLED" />
                          ) : (
                            <Text style={[styles.owed, { color: colors.coralText }]}>{formatCurrency(p.owed)}</Text>
                          )}
                        </View>
                        <ChevronRotator isOpen={open} color={colors.textSecondary} reduceMotion={reduceMotion} />
                      </PressableOpacity>

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
                              <AppButton
                                label={`Settle all ${formatCurrency(p.owed)}`}
                                onPress={() => handleOpenSettleAll(p)}
                                variant="primary"
                                size="compact"
                                icon={<CheckCheck size={14} color={colors.forestGreen} strokeWidth={2.6} />}
                                accessibilityLabel={`Settle all ${formatCurrency(p.owed)} for ${p.name}`}
                              />
                            ) : null}
                          </View>

                          {p.splits.map((s) => {
                            const isSettled = s.isSettled;
                            return (
                              <PressableOpacity
                                activeOpacity={PRESS_DIM_OPACITY}
                                key={s.expenseId}
                                onPress={() => {
                                  if (isSettled) {
                                    navigation.navigate('ExpenseDetail', { expenseId: s.expenseId });
                                  } else {
                                    handleOpenSettleExpense(p.name, s);
                                  }
                                }}
                                style={styles.line}
                                accessibilityRole="button"
                                accessibilityLabel={
                                  isSettled
                                    ? `${s.note || 'Expense'}, settled`
                                    : `${s.note || 'Expense'}, ${formatCurrency(s.outstanding)} left. Tap to mark as paid.`
                                }
                              >
                                <View style={styles.flex}>
                                  <Text numberOfLines={2} style={[styles.lineTitle, { color: colors.textPrimary }]}>
                                    {s.note || 'Expense'}
                                  </Text>
                                  <Text numberOfLines={2} style={[styles.sub, { color: colors.textSecondary }]}>
                                    {day(s.date)} · Their share {formatCurrency(s.theirShare)}
                                    {s.settled > 0 && !s.isSettled ? ` · Paid ${formatCurrency(s.settled)}` : ''}
                                  </Text>
                                </View>

                                <View style={styles.lineRight}>
                                  {isSettled ? (
                                    <StatusBadge variant="success" label="SETTLED" />
                                  ) : (
                                    <Text style={[styles.lineAmount, { color: colors.coralText }]}>
                                      {formatCurrency(s.outstanding)} left
                                    </Text>
                                  )}
                                  <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.2} />
                                </View>
                              </PressableOpacity>
                            );
                          })}

                          <Text style={[styles.sectionLabel, { color: colors.textSecondary, marginTop: Spacing.group }]}>PAID BACK</Text>
                          {p.payments.length === 0 ? (
                            <Text style={[styles.sub, { color: colors.textSecondary }]}>Nothing paid back yet.</Text>
                          ) : (
                            p.payments.map((pay) => (
                              <PressableOpacity
                                activeOpacity={PRESS_DIM_OPACITY}
                                key={pay.id}
                                onPress={() => navigation.navigate('ExpenseDetail', { expenseId: pay.id })}
                                style={styles.line}
                                accessibilityRole="button"
                                accessibilityLabel={`Paid back ${formatCurrency(pay.amount)} on ${day(pay.date)}`}
                              >
                                <Text style={[styles.lineTitle, styles.flex, { color: colors.textPrimary }]}>
                                  {day(pay.date)}
                                </Text>
                                <View style={styles.lineRight}>
                                  <Text style={[styles.lineAmount, { color: colors.mintText }]}>
                                    +{formatCurrency(pay.amount)}
                                  </Text>
                                  <ChevronRight size={14} color={colors.textMuted} strokeWidth={2.2} />
                                </View>
                              </PressableOpacity>
                            ))
                          )}
                        </Animated.View>
                      ) : null}
                    </Animated.View>
                  );
                })}
              </View>
            ))}
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
  summaryLabel: { fontSize: FontSize.caption, letterSpacing: LetterSpacing.label, fontFamily: FontFamily.bold },
  summaryAmount: { fontSize: FontSize.display, lineHeight: LineHeight.display, fontFamily: FontFamily.bold },
  summarySub: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium },
  summaryTally: { marginTop: Spacing.group, gap: Spacing.element },
  tallyCaptionRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.micro, flexWrap: 'wrap' },
  tallyCaptionStrong: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  tallyCaption: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium },
  group: { gap: Spacing.group },
  groupLabel: {
    fontSize: FontSize.caption,
    letterSpacing: LetterSpacing.label,
    fontFamily: FontFamily.bold,
    marginTop: Spacing.element,
  },
  card: { borderRadius: BorderRadius.card, borderWidth: 1, overflow: 'hidden' },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, padding: Spacing.surface },
  personBody: { gap: Spacing.micro + Spacing.nano },
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
  sectionLabel: { fontSize: FontSize.caption, letterSpacing: LetterSpacing.label, fontFamily: FontFamily.bold },
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
  empty: { paddingTop: EMPTY_STATE_TOP_OFFSET },
});
