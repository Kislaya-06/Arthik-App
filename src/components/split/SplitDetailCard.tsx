import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { useTheme } from '../../store/themeStore';
import type { Expense } from '../../store/expenseStore';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../../config/theme';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { isRecoveryClass } from '../../lib/transactionUtils';
import { getSplitView, recoveriesForExpense, recoverySlices, allocationsOf } from '../../lib/splitLedger';

export interface SplitDetailCardProps {
  expense: Expense;
  allExpenses: Expense[];
  onOpen: (expenseId: string) => void;
}

const Line: React.FC<{ label: string; value: string; bold?: boolean; color?: string }> = ({ label, value, bold, color }) => {
  const { colors } = useTheme();
  return (
    <View style={styles.line}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.value, { color: color || colors.textPrimary, fontFamily: bold ? FontFamily.bold : FontFamily.semibold }]}>{value}</Text>
    </View>
  );
};

/**
 * Detail-screen section for split expenses and money back (SPL-001..SPL-006).
 * - Split expense: what was paid, each share, what came back and what is still owed.
 * - Expense with a refund: the refund entries.
 * - Money-back entry: which expenses it went back to.
 * Renders nothing for ordinary transactions.
 */
export const SplitDetailCard: React.FC<SplitDetailCardProps> = ({ expense, allExpenses, onOpen }) => {
  const { colors, isDark } = useTheme();
  const successColor = isDark ? colors.mintGreen : colors.mintGreenDark;
  const card = [styles.card, { backgroundColor: colors.card, borderColor: colors.borderSubtle }];

  if (isRecoveryClass(expense)) {
    const slices = recoverySlices(expense, allExpenses);
    const isRefund = expense.recovery_kind === 'refund';
    const who = expense.recovery_person || (isRefund ? 'A shop' : 'Someone');
    return (
      <View style={card}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {isRefund ? `Refund from ${who}` : `${who} paid you back`}
        </Text>
        <Text style={[styles.sub, { color: colors.textSecondary }]}>
          This money went back to your spending. It is not counted as income.
        </Text>
        {slices.length === 0 ? (
          <Text style={[styles.sub, { color: colors.textSecondary }]}>The expenses it was for were deleted.</Text>
        ) : (
          slices.map((s) => (
            <Pressable
              key={s.expenseId}
              disabled={!s.expense}
              onPress={() => onOpen(s.expenseId)}
              style={[styles.sliceRow, { borderTopColor: colors.borderSubtle }]}
              accessibilityRole="button"
            >
              <View style={styles.flex}>
                <Text numberOfLines={1} style={[styles.value, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                  {s.expense?.note || 'Expense'}
                </Text>
                <Text style={[styles.sub, { color: colors.textSecondary }]}>
                  {s.expense ? formatDate(s.expense.expense_date || '') : 'Deleted'} · settled {formatCurrency(s.amount)}
                </Text>
              </View>
              {s.expense ? <ChevronRight size={16} color={colors.textSecondary} /> : null}
            </Pressable>
          ))
        )}
      </View>
    );
  }

  const view = getSplitView(expense, allExpenses);
  const back = recoveriesForExpense(allExpenses, expense.id);
  if (!view && back.length === 0) return null;

  return (
    <View style={card}>
      {view ? (
        view.allocations && view.allocations.length > 1 ? (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>
              Split with {view.allocations.length} people
            </Text>
            <Line label="You paid" value={formatCurrency(view.paid)} />
            <Line label="Your share" value={formatCurrency(view.myShare)} />
            <View style={[styles.allocationsContainer, { borderTopColor: colors.borderSubtle, borderBottomColor: colors.borderSubtle }]}>
              {view.allocations.map((alloc, index) => (
                <View key={`${alloc.person}_${index}`} style={styles.allocRow}>
                  <View style={styles.flex}>
                    <Text style={[styles.allocName, { color: colors.textPrimary }]}>{alloc.person}</Text>
                    <Text style={[styles.sub, { color: colors.textSecondary }]}>
                      Share {formatCurrency(alloc.theirShare)}
                      {alloc.settled > 0 ? ` · Paid back ${formatCurrency(alloc.settled)}` : ''}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.allocStatus,
                      {
                        color: alloc.isSettled ? successColor : colors.coral,
                        fontFamily: FontFamily.bold,
                      },
                    ]}
                  >
                    {alloc.isSettled ? 'Settled' : `Owes ${formatCurrency(alloc.outstanding)}`}
                  </Text>
                </View>
              ))}
            </View>
            <Line
              label={view.isSettled ? 'Status' : 'Total still owed'}
              value={view.isSettled ? 'All settled' : formatCurrency(view.outstanding)}
              bold
              color={view.isSettled ? successColor : colors.coral}
            />
          </>
        ) : (
          <>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Split with {view.person}</Text>
            <Line label="You paid" value={formatCurrency(view.paid)} />
            <Line label="Your share" value={formatCurrency(view.myShare)} />
            <Line label={`${view.person}'s share`} value={formatCurrency(view.theirShare)} />
            {view.settled > 0 ? <Line label="Paid back so far" value={formatCurrency(view.settled)} color={successColor} /> : null}
            <Line
              label={view.isSettled ? 'Status' : 'Still owes you'}
              value={view.isSettled ? 'Settled' : formatCurrency(view.outstanding)}
              bold
              color={view.isSettled ? successColor : colors.coral}
            />
          </>
        )
      ) : (
        <Text style={[styles.title, { color: colors.textPrimary }]}>Money back</Text>
      )}
      {back.map((r) => {
        const slice = allocationsOf(r).find((a) => a.expense_id === expense.id);
        const part = slice?.amount || 0;
        const target = slice?.refund_target;
        const targetLabel =
          target && (target.toLowerCase() === 'user' || target.toLowerCase() === 'me')
            ? 'for you'
            : target && (target.toLowerCase() === 'everyone' || target.toLowerCase() === 'all')
            ? 'split proportionally'
            : target
            ? `for ${target}`
            : '';
        return (
          <Pressable
            key={r.id}
            onPress={() => onOpen(r.id)}
            style={[styles.sliceRow, { borderTopColor: colors.borderSubtle }]}
            accessibilityRole="button"
          >
            <View style={styles.flex}>
              <Text style={[styles.value, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                {r.recovery_kind === 'refund' ? 'Refund' : 'Paid back'} · {formatCurrency(part)}
                {targetLabel ? ` (${targetLabel})` : ''}
              </Text>
              <Text style={[styles.sub, { color: colors.textSecondary }]}>{formatDate(r.expense_date || '')}</Text>
            </View>
            <ChevronRight size={16} color={colors.textSecondary} />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { borderRadius: BorderRadius.card, padding: Spacing.surface, marginTop: Spacing.block, borderWidth: 1, gap: Spacing.element },
  flex: { flex: 1 },
  title: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.bold },
  sub: { fontSize: FontSize.caption, fontFamily: FontFamily.medium },
  line: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: FontSize.bodySmall, fontFamily: FontFamily.medium },
  value: { fontSize: FontSize.bodySmall },
  sliceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.group, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: Spacing.element },
  allocationsContainer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.element,
    gap: Spacing.element,
  },
  allocRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  allocName: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.semibold,
  },
  allocStatus: {
    fontSize: FontSize.caption,
  },
});
