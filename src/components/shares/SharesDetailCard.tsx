import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { format, parseISO } from 'date-fns';
import { useTheme } from '../../store/themeStore';
import { useExpenseStore, Expense } from '../../store/expenseStore';
import { useSharesStore } from '../../store/sharesStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../config/theme';
import { formatCurrency } from '../../lib/formatters';
import { computeSplit, outstandingOf, reimbursedByShare } from '../../lib/shares';
import { SplitExpenseModal } from './SplitExpenseModal';

const shortDate = (d?: string) => (d ? format(parseISO(d.split('T')[0]), 'd MMM') : '');

/** Detail-screen section: friend shares of an expense, or what a reimbursement/self-transfer is. */
export const SharesDetailCard: React.FC<{ expense: Expense }> = ({ expense }) => {
  const { colors } = useTheme();
  const expenses = useExpenseStore((s) => s.expenses);
  const shares = useSharesStore((s) => s.shares);
  const fetchAll = useSharesStore((s) => s.fetchAll);
  const [showSplit, setShowSplit] = useState(false);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const mine = useMemo(() => shares.filter((s) => s.expense_id === expense.id), [shares, expense.id]);
  const reimbursed = useMemo(() => reimbursedByShare(expenses), [expenses]);
  const cardStyle = [styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }];

  if (expense.transaction_class === 'self_transfer') {
    return (
      <View style={cardStyle}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>Transfer between your accounts</Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          Not counted as income or expense, and does not change your budget or Gullak.
        </Text>
      </View>
    );
  }

  if (expense.transaction_class === 'reimbursement') {
    const share = shares.find((s) => s.id === expense.reimburses_share_id);
    const original = share ? expenses.find((e) => e.id === share.expense_id) : undefined;
    const unlink = () =>
      Alert.alert('Treat as income instead?', 'This will stop linking it to the friend’s share and count it as regular income.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Treat as income',
          onPress: async () => {
            try { await useSharesStore.getState().unlinkReimbursement(expense.id); }
            catch (e: any) { Alert.alert('Error', e?.message || 'Could not update.'); }
          },
        },
      ]);
    return (
      <View style={cardStyle}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {original ? `Reimbursement for ${shortDate(original.expense_date)} expense (${formatCurrency(Number(original.amount))})` : 'Reimbursement'}
        </Text>
        {share ? <Text style={[styles.sub, { color: colors.textSecondary }]}>From {share.friend_label}</Text> : null}
        <Text style={[styles.sub, { color: colors.textSecondary }]}>Money received — not counted as income.</Text>
        <Pressable onPress={unlink}><Text style={[styles.link, { color: colors.mintGreenDark }]}>This is actually income</Text></Pressable>
      </View>
    );
  }

  if (expense.type === 'income') return null;

  const split = computeSplit(Number(expense.amount), mine.map((s) => ({ amount: s.amount_owed })));
  return (
    <>
      {mine.length > 0 ? (
        <View style={cardStyle}>
          <Text style={[styles.title, { color: colors.textPrimary }]}>Split expense</Text>
          {mine.map((s) => {
            const left = outstandingOf(s, reimbursed[s.id] || 0);
            return (
              <View key={s.id} style={styles.line}>
                <Text style={[styles.sub, { color: colors.textPrimary }]}>{s.friend_label}’s share</Text>
                <Text style={[styles.sub, { color: colors.textPrimary }]}>
                  {formatCurrency(s.amount_owed)}{left === 0 ? ' · paid back' : left < s.amount_owed ? ` · ${formatCurrency(left)} left` : ''}
                </Text>
              </View>
            );
          })}
          <View style={styles.line}>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>Your share</Text>
            <Text style={[styles.sub, { color: colors.textSecondary }]}>{formatCurrency(split.yourShare)}</Text>
          </View>
        </View>
      ) : null}
      <Pressable onPress={() => setShowSplit(true)} style={styles.editRow}>
        <Text style={[styles.link, { color: colors.mintGreenDark }]}>{mine.length ? 'Edit split' : 'Split this expense'}</Text>
      </Pressable>
      <SplitExpenseModal
        visible={showSplit}
        total={Number(expense.amount)}
        initial={mine.map((s) => ({ friendLabel: s.friend_label, amount: s.amount_owed }))}
        onClose={() => setShowSplit(false)}
        onSave={async (drafts) => {
          setShowSplit(false);
          try { await useSharesStore.getState().replaceShares(expense.id, Number(expense.amount), drafts); }
          catch (e: any) { Alert.alert('Could not save split', e?.message || 'Please try again.'); }
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.card, padding: Spacing.surface, marginTop: Spacing.block, borderWidth: 1, gap: Spacing.micro },
  title: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  link: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.semibold, marginTop: Spacing.element },
  editRow: { alignItems: 'center', paddingVertical: Spacing.group },
});
