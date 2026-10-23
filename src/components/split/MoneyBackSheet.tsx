import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput } from 'react-native';
import Check from 'lucide-react-native/icons/check';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { AppButton } from '../ui/AppButton';
import { useTheme } from '../../store/themeStore';
import { useExpenseStore } from '../../store/expenseStore';
import { convertIncomeToMoneyBack } from '../../store/expense/moneyBack';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../../config/theme';
import { formatCurrency, formatDate } from '../../lib/formatters';
import {
  buildPeopleLedger,
  planSettlement,
  planRefund,
  refundCandidates,
  grossAmountOf,
  personKey,
  MAX_PERSON_NAME,
  splitAllocationsOf,
} from '../../lib/splitLedger';

export interface MoneyBackSheetProps {
  visible: boolean;
  /** The income row to mark as money back. */
  incomeId: string | null;
  /** A person to pre-select (for example the one a bank message matched). */
  suggestedPerson?: string | null;
  onClose: () => void;
  onDone: (message: string) => void;
}

type Kind = 'settlement' | 'refund';

/**
 * "Was this money coming back?" for an income that is already logged (SPL-003 / SPL-004 / SPL-005 / SPL-006).
 * A person who still owes money is always listed so it is one tap; the user can tick which expenses it settles.
 */
export const MoneyBackSheet: React.FC<MoneyBackSheetProps> = ({ visible, incomeId, suggestedPerson, onClose, onDone }) => {
  const { colors, isDark } = useTheme();
  const expenses = useExpenseStore((s) => s.expenses);
  const income = incomeId ? expenses.find((e) => e.id === incomeId) : undefined;
  const amount = income ? grossAmountOf(income) : 0;

  const people = useMemo(() => buildPeopleLedger(expenses).filter((p) => p.owed > 0), [expenses]);
  const candidates = useMemo(() => refundCandidates(expenses), [expenses]);

  const [kind, setKind] = useState<Kind>('settlement');
  const [personKeyPicked, setPersonKeyPicked] = useState<string | null>(null);
  const [unticked, setUnticked] = useState<string[]>([]);
  const [refundWho, setRefundWho] = useState('');
  const [refundExpenseId, setRefundExpenseId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<string>('everyone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const suggested = suggestedPerson ? people.find((p) => personKey(p.name) === personKey(suggestedPerson)) : undefined;
    setKind(people.length === 0 ? 'refund' : 'settlement');
    setPersonKeyPicked(suggested?.key ?? (people.length === 1 ? people[0].key : null));
    setUnticked([]);
    setRefundWho('');
    setRefundExpenseId(null);
    setRefundTarget('everyone');
    setError(null);
    setBusy(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, incomeId]);

  const person = people.find((p) => p.key === personKeyPicked) ?? null;
  const tickedIds = person ? person.openSplits.map((s) => s.expenseId).filter((id) => !unticked.includes(id)) : [];
  const plan = useMemo(() => {
    if (!income || amount <= 0) return null;
    if (kind === 'refund') return refundExpenseId ? planRefund(expenses, refundExpenseId, amount, refundTarget) : null;
    return person ? planSettlement(expenses, person.name, amount, tickedIds) : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [income, amount, kind, refundExpenseId, person, expenses, unticked, refundTarget]);

  const canSave = !!plan && plan.allocated > 0 && (kind === 'settlement' || refundWho.trim().length > 0);

  const save = async () => {
    if (!income || !plan) return;
    setBusy(true);
    setError(null);
    try {
      await convertIncomeToMoneyBack(
        kind === 'refund'
          ? { incomeId: income.id, kind, who: refundWho, refundExpenseId: refundExpenseId || undefined, refundTarget }
          : { incomeId: income.id, kind, who: person?.name || '', expenseIds: tickedIds }
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onDone(kind === 'refund' ? 'Refund recorded' : `${person?.name} paid back ${formatCurrency(plan.allocated)}`);
    } catch (e: any) {
      setError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (!income) return null;

  const chip = (active: boolean) => [
    styles.pill,
    { borderColor: active ? colors.mintGreenDark : colors.borderSubtle, backgroundColor: active ? colors.mintGreen : 'transparent' },
  ];

  const selectedExpense = refundExpenseId ? expenses.find((e) => e.id === refundExpenseId) : undefined;
  const splitAllocs = selectedExpense ? splitAllocationsOf(selectedExpense) : [];

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title="Was this money back?"
      colors={colors}
      isDark={isDark}
      avoidKeyboard
      footer={
        <View>
          {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
          <AppButton label="Mark as money back" variant="primary" size="cta" loading={busy} disabled={!canSave} onPress={save} />
        </View>
      }
    >
      <View style={styles.wrap}>
        <Text style={[styles.intro, { color: colors.textSecondary }]}>
          {formatCurrency(amount)} is not new income if it is your own money coming back. Marking it puts it back on the
          expenses it was for.
        </Text>

        <View style={styles.pills}>
          {([['settlement', 'Friend paid back'], ['refund', 'Refund']] as const).map(([k, label]) => (
            <Pressable key={k} onPress={() => setKind(k)} style={chip(kind === k)} accessibilityRole="button" accessibilityState={{ selected: kind === k }}>
              <Text style={[styles.pillText, { color: kind === k ? colors.forestGreen : colors.textSecondary, fontFamily: kind === k ? FontFamily.bold : FontFamily.medium }]}>{label}</Text>
            </Pressable>
          ))}
        </View>

        {kind === 'settlement' ? (
          people.length === 0 ? (
            <Text style={[styles.sub, { color: colors.textSecondary }]}>No one owes you right now.</Text>
          ) : (
            <>
              <Text style={[styles.title, { color: colors.textPrimary }]}>Who paid you back?</Text>
              <View style={styles.pills}>
                {people.map((p) => (
                  <Pressable key={p.key} onPress={() => { setPersonKeyPicked(p.key); setUnticked([]); }} style={chip(p.key === personKeyPicked)} accessibilityRole="button">
                    <Text style={[styles.pillText, { color: p.key === personKeyPicked ? colors.forestGreen : colors.textPrimary, fontFamily: FontFamily.semibold }]}>
                      {p.name} · owes {formatCurrency(p.owed)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {person ? (
                <>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>Which expenses?</Text>
                  {person.openSplits.map((s) => {
                    const on = !unticked.includes(s.expenseId);
                    return (
                      <Pressable
                        key={s.expenseId}
                        onPress={() => setUnticked((u) => (on ? [...u, s.expenseId] : u.filter((x) => x !== s.expenseId)))}
                        style={[styles.optionRow, { borderColor: on ? colors.mintGreenDark : colors.borderSubtle }]}
                        accessibilityRole="checkbox"
                        accessibilityState={{ checked: on }}
                      >
                        <View style={[styles.box, { borderColor: colors.borderSubtle, backgroundColor: on ? colors.mintGreen : 'transparent' }]}>
                          {on ? <Check size={14} color={colors.forestGreen} /> : null}
                        </View>
                        <View style={styles.flex}>
                          <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{s.note || 'Expense'}</Text>
                          <Text style={[styles.sub, { color: colors.textSecondary }]}>{formatDate(s.date)}</Text>
                        </View>
                        <Text style={[styles.title, { color: colors.textPrimary }]}>{formatCurrency(s.outstanding)}</Text>
                      </Pressable>
                    );
                  })}
                </>
              ) : null}
            </>
          )
        ) : (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Who sent the refund?</Text>
            <TextInput
              value={refundWho}
              onChangeText={setRefundWho}
              maxLength={MAX_PERSON_NAME}
              placeholder="Shop or company"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="words"
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.textPrimary, fontFamily: FontFamily.medium }]}
            />
            <Text style={[styles.title, { color: colors.textPrimary }]}>Which expense is it for?</Text>
            {candidates.slice(0, 8).map((c) => {
              const active = refundExpenseId === c.id;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    const nextId = active ? null : c.id;
                    setRefundExpenseId(nextId);
                    setRefundTarget('everyone');
                  }}
                  style={[styles.optionRow, { borderColor: active ? colors.mintGreenDark : colors.borderSubtle }]}
                  accessibilityRole="button"
                >
                  <View style={styles.flex}>
                    <Text numberOfLines={1} style={[styles.title, { color: colors.textPrimary }]}>{c.note || 'Expense'}</Text>
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>{formatDate(c.date)}{c.remaining === amount ? ' · same amount' : ''}</Text>
                  </View>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>{formatCurrency(c.remaining)}</Text>
                </Pressable>
              );
            })}

            {refundExpenseId && splitAllocs.length > 0 ? (
              <View style={styles.targetSection}>
                <Text style={[styles.title, { color: colors.textPrimary, marginTop: Spacing.element }]}>
                  Who is this refund for?
                </Text>
                <View style={styles.pills}>
                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setRefundTarget('everyone');
                    }}
                    style={chip(!refundTarget || refundTarget === 'everyone')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: !refundTarget || refundTarget === 'everyone' }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        {
                          color: (!refundTarget || refundTarget === 'everyone') ? colors.forestGreen : colors.textPrimary,
                          fontFamily: (!refundTarget || refundTarget === 'everyone') ? FontFamily.bold : FontFamily.medium,
                        },
                      ]}
                    >
                      Split among everyone
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setRefundTarget('user');
                    }}
                    style={chip(refundTarget === 'user')}
                    accessibilityRole="button"
                    accessibilityState={{ selected: refundTarget === 'user' }}
                  >
                    <Text
                      style={[
                        styles.pillText,
                        {
                          color: refundTarget === 'user' ? colors.forestGreen : colors.textPrimary,
                          fontFamily: refundTarget === 'user' ? FontFamily.bold : FontFamily.medium,
                        },
                      ]}
                    >
                      Just for me
                    </Text>
                  </Pressable>

                  {splitAllocs.map((a) => {
                    const isTarget = refundTarget.toLowerCase() === a.person.toLowerCase();
                    return (
                      <Pressable
                        key={a.person}
                        onPress={() => {
                          Haptics.selectionAsync().catch(() => {});
                          setRefundTarget(a.person);
                        }}
                        style={chip(isTarget)}
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

                {plan?.previewBreakdown ? (
                  <View style={[styles.breakdownCard, { borderColor: colors.borderSubtle }]}>
                    <Text style={[styles.breakdownHeader, { color: colors.textSecondary }]}>
                      NEW BALANCES AFTER REFUND
                    </Text>
                    <View style={styles.breakdownItem}>
                      <Text style={[styles.breakdownLabel, { color: colors.textPrimary }]}>Your share</Text>
                      <Text style={[styles.breakdownValue, { color: colors.textPrimary }]}>
                        {plan.previewBreakdown.userShareBefore !== plan.previewBreakdown.userShareAfter
                          ? `${formatCurrency(plan.previewBreakdown.userShareBefore)} → ${formatCurrency(plan.previewBreakdown.userShareAfter)}`
                          : formatCurrency(plan.previewBreakdown.userShareAfter)}
                      </Text>
                    </View>
                    {plan.previewBreakdown.members.map((m) => (
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
          </>
        )}

        {plan && plan.allocated > 0 ? (
          <Text style={[styles.summary, { color: colors.textPrimary }]}>
            {formatCurrency(plan.allocated)} goes back to your expenses.
            {plan.excess > 0 ? ` The extra ${formatCurrency(plan.excess)} stays as income.` : ''}
          </Text>
        ) : null}
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: Spacing.group },
  flex: { flex: 1 },
  intro: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium },
  title: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
  pills: { flexDirection: 'row', gap: Spacing.group, flexWrap: 'wrap' },
  pill: { borderWidth: 1, borderRadius: BorderRadius.pill, paddingVertical: Spacing.element, paddingHorizontal: Spacing.block },
  pillText: { fontSize: FontSize.bodySmall },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, borderWidth: 1, borderRadius: BorderRadius.input, padding: Spacing.group },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  input: { height: ControlHeight.standard, borderRadius: BorderRadius.input, paddingHorizontal: Spacing.block, fontSize: FontSize.body },
  summary: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  error: { fontSize: FontSize.caption, fontFamily: FontFamily.medium, marginBottom: Spacing.element },
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
