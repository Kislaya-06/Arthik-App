import React from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../store/themeStore';
import { useExpenseStore } from '../../store/expenseStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../../config/theme';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { MAX_PERSON_NAME, splitAllocationsOf } from '../../lib/splitLedger';
import { SegmentedControl, SegmentedOption } from '../ui/SegmentedControl';
import type { MoneyBackFormState, MoneyBackMode } from '../../hooks/useExpenseForm';

const MODES: SegmentedOption[] = [
  { key: 'income', label: 'Income' },
  { key: 'friend', label: 'Friend paid back' },
  { key: 'refund', label: 'Refund' },
];

export interface MoneyBackExtrasProps {
  moneyBack: MoneyBackFormState;
  /** Amount typed on the keypad, for the live summary. */
  amount: number;
  onFieldFocus?: (relativeY?: number) => void;
}

/** What kind of money came in? Money that is only coming back is never income (SPL-003). */
export const MoneyBackExtras: React.FC<MoneyBackExtrasProps> = ({ moneyBack: mb, amount, onFieldFocus }) => {
  const { colors, isDark } = useTheme();
  const expenses = useExpenseStore((s) => s.expenses);
  if (!mb.visible) return null;

  const activeBorder = isDark ? colors.mintGreen : colors.mintGreenDark;
  const selectedExpense = mb.refundExpenseId ? expenses.find((e) => e.id === mb.refundExpenseId) : undefined;
  const splitAllocs = selectedExpense ? splitAllocationsOf(selectedExpense) : [];

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>WHAT IS THIS MONEY?</Text>
      <SegmentedControl
        options={MODES}
        selectedKey={mb.mode}
        onChange={(key) => mb.setMode(key as MoneyBackMode)}
        height={ControlHeight.row}
        activePillColor={colors.mintGreen}
        activeTextColor={colors.forestGreen}
        backgroundColor={colors.inputBg}
        fontSize={13}
      />

      {mb.mode === 'friend' ? (
        <View style={[styles.card, { backgroundColor: colors.cardSubtle }]}>
          {mb.people.length === 0 ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>No one owes you right now. Split an expense first.</Text>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Who paid you back?</Text>
              <View style={styles.pills}>
                {mb.people.map((p) => {
                  const active = p.key === mb.person.trim().toLowerCase();
                  return (
                    <Pressable
                      key={p.key}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        mb.setPerson(p.name);
                      }}
                      style={[styles.pill, { borderColor: active ? activeBorder : colors.borderSubtle }]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text style={[styles.pillText, { color: colors.textPrimary, fontFamily: FontFamily.semibold }]}>
                        {p.name} · owes {formatCurrency(p.owed)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </>
          )}
        </View>
      ) : null}

      {mb.mode === 'refund' ? (
        <View style={[styles.card, { backgroundColor: colors.cardSubtle }]}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Who sent the refund?</Text>
          <TextInput
            value={mb.refundWho}
            onChangeText={mb.setRefundWho}
            onFocus={() => onFieldFocus?.()}
            maxLength={MAX_PERSON_NAME}
            placeholder="Shop or company"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="words"
            style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, fontFamily: FontFamily.medium }]}
          />
          <Text style={[styles.title, { color: colors.textPrimary }]}>Which expense is it for?</Text>
          {mb.refundOptions.length === 0 ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>No expenses to refund yet.</Text>
          ) : (
            mb.refundOptions.slice(0, 8).map((c) => {
              const active = mb.refundExpenseId === c.id;
              const matches = amount > 0 && c.remaining === amount;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    mb.setRefundExpenseId(active ? null : c.id);
                  }}
                  style={[styles.optionRow, { borderColor: active ? activeBorder : colors.borderSubtle }]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{c.note || 'Expense'}</Text>
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>
                      {formatDate(c.date)}{matches ? ' · same amount' : ''}
                    </Text>
                  </View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{formatCurrency(c.remaining)}</Text>
                </Pressable>
              );
            })
          )}

          {mb.refundExpenseId && splitAllocs.length > 0 ? (
            <View style={styles.targetSection}>
              <Text style={[styles.title, { color: colors.textPrimary, marginTop: Spacing.element }]}>
                Who is this refund for?
              </Text>
              <View style={styles.pills}>
                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    mb.setRefundTarget('everyone');
                  }}
                  style={[
                    styles.pill,
                    {
                      borderColor: (!mb.refundTarget || mb.refundTarget === 'everyone') ? activeBorder : colors.borderSubtle,
                      backgroundColor: (!mb.refundTarget || mb.refundTarget === 'everyone') ? colors.mintGreen : 'transparent',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: !mb.refundTarget || mb.refundTarget === 'everyone' }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: (!mb.refundTarget || mb.refundTarget === 'everyone') ? colors.forestGreen : colors.textPrimary,
                        fontFamily: (!mb.refundTarget || mb.refundTarget === 'everyone') ? FontFamily.bold : FontFamily.medium,
                      },
                    ]}
                  >
                    Split among everyone
                  </Text>
                </Pressable>

                <Pressable
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    mb.setRefundTarget('user');
                  }}
                  style={[
                    styles.pill,
                    {
                      borderColor: mb.refundTarget === 'user' ? activeBorder : colors.borderSubtle,
                      backgroundColor: mb.refundTarget === 'user' ? colors.mintGreen : 'transparent',
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mb.refundTarget === 'user' }}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: mb.refundTarget === 'user' ? colors.forestGreen : colors.textPrimary,
                        fontFamily: mb.refundTarget === 'user' ? FontFamily.bold : FontFamily.medium,
                      },
                    ]}
                  >
                    Just for me
                  </Text>
                </Pressable>

                {splitAllocs.map((a) => {
                  const isTarget = mb.refundTarget.toLowerCase() === a.person.toLowerCase();
                  return (
                    <Pressable
                      key={a.person}
                      onPress={() => {
                        Haptics.selectionAsync().catch(() => {});
                        mb.setRefundTarget(a.person);
                      }}
                      style={[
                        styles.pill,
                        {
                          borderColor: isTarget ? activeBorder : colors.borderSubtle,
                          backgroundColor: isTarget ? colors.mintGreen : 'transparent',
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isTarget }}
                    >
                      <Text
                        style={[
                          styles.pillText,
                          {
                            color: isTarget ? colors.forestGreen : colors.textPrimary,
                            fontFamily: isTarget ? FontFamily.bold : FontFamily.medium,
                          },
                        ]}
                      >
                        {a.person}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>

              {mb.plan?.previewBreakdown ? (
                <View style={[styles.breakdownCard, { borderColor: colors.borderSubtle }]}>
                  <Text style={[styles.breakdownHeader, { color: colors.textSecondary }]}>
                    NEW BALANCES AFTER REFUND
                  </Text>
                  <View style={styles.breakdownItem}>
                    <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>Your share</Text>
                    <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
                      {mb.plan.previewBreakdown.userShareBefore !== mb.plan.previewBreakdown.userShareAfter
                        ? `${formatCurrency(mb.plan.previewBreakdown.userShareBefore)} → ${formatCurrency(mb.plan.previewBreakdown.userShareAfter)}`
                        : formatCurrency(mb.plan.previewBreakdown.userShareAfter)}
                    </Text>
                  </View>
                  {mb.plan.previewBreakdown.members.map((m) => (
                    <View key={m.person} style={styles.breakdownItem}>
                      <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>{m.person} owes</Text>
                      <Text
                        style={[
                          styles.breakdownValue,
                          { color: m.shareAfter === 0 ? colors.forestGreen : colors.textPrimary },
                        ]}
                      >
                        {m.shareBefore !== m.shareAfter
                          ? `${formatCurrency(m.shareBefore)} → ${formatCurrency(m.shareAfter)}`
                          : formatCurrency(m.shareAfter)}
                        {m.shareAfter === 0 ? ' (Settled)' : ''}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      {mb.plan && mb.plan.allocated > 0 ? (
        <Text style={[styles.summary, { color: colors.textPrimary }]}>
          {formatCurrency(mb.plan.allocated)} goes back to your expenses and is not counted as income.
          {mb.plan.excess > 0 ? ` The extra ${formatCurrency(mb.plan.excess)} is added as income.` : ''}
        </Text>
      ) : null}
      {mb.error ? <Text style={[styles.error, { color: colors.danger }]}>{mb.error}</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.group, marginTop: Spacing.block, marginBottom: Spacing.block },
  flex: { flex: 1 },
  card: { borderRadius: BorderRadius.input, padding: Spacing.block, gap: Spacing.element },
  label: { fontSize: FontSize.caption, fontFamily: FontFamily.bold, letterSpacing: 1, textTransform: 'uppercase' },
  title: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginTop: 2 },
  input: { height: ControlHeight.standard, borderRadius: BorderRadius.input, paddingHorizontal: Spacing.block, fontSize: FontSize.body },
  pills: { flexDirection: 'row', gap: Spacing.group, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: BorderRadius.pill, paddingVertical: Spacing.element, paddingHorizontal: Spacing.block },
  pillText: { fontSize: FontSize.bodySmall },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, borderWidth: 1, borderRadius: BorderRadius.input, padding: Spacing.group },
  summary: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  error: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
  targetSection: { gap: Spacing.element, marginTop: Spacing.element },
  breakdownCard: {
    borderWidth: 1,
    borderRadius: BorderRadius.input,
    padding: Spacing.group,
    gap: Spacing.micro,
    marginTop: Spacing.micro,
  },
  breakdownHeader: {
    fontSize: FontSize.micro,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
    marginBottom: Spacing.micro,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 2,
  },
  breakdownLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
  },
  breakdownValue: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
});
