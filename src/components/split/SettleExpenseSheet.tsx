import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { format } from 'date-fns/format';
import * as Haptics from 'expo-haptics';
import { BottomSheetModal } from '../ui/BottomSheetModal';
import { AppButton } from '../ui/AppButton';
import { SegmentedControl } from '../ui/SegmentedControl';
import { useTheme } from '../../store/themeStore';
import { recordMoneyBack } from '../../store/expense/moneyBack';
import { formatCurrency, round2 } from '../../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../../config/theme';

export interface SettleExpenseTarget {
  expenseId: string;
  note: string;
  outstanding: number;
  date: string;
}

export interface SettleExpenseSheetProps {
  visible: boolean;
  onClose: () => void;
  personName: string;
  targetExpense?: SettleExpenseTarget | null;
  totalOwed: number;
  onSettled?: (message: string) => void;
  onViewExpense?: (expenseId: string) => void;
}

/**
 * SettleExpenseSheet: Modal sheet to mark an individual split expense or all open expenses
 * for a person as paid (Option 1 UI/UX). Captures payment mode (UPI vs Cash) and records
 * a canonical recovery transaction without creating false income.
 */
export const SettleExpenseSheet: React.FC<SettleExpenseSheetProps> = ({
  visible,
  onClose,
  personName,
  targetExpense,
  totalOwed,
  onSettled,
  onViewExpense,
}) => {
  const { colors, isDark } = useTheme();
  const [paymentMode, setPaymentMode] = useState<'upi' | 'cash'>('upi');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const settleAmount = round2(targetExpense ? targetExpense.outstanding : totalOwed);

  useEffect(() => {
    if (visible) {
      setPaymentMode('upi');
      setBusy(false);
      setError(null);
    }
  }, [visible, targetExpense, personName]);

  const handleConfirm = async () => {
    if (settleAmount <= 0 || busy) return;
    setBusy(true);
    setError(null);

    try {
      const today = format(new Date(), 'yyyy-MM-dd');
      await recordMoneyBack({
        kind: 'settlement',
        who: personName,
        amount: settleAmount,
        date: today,
        paymentMode,
        expenseIds: targetExpense ? [targetExpense.expenseId] : undefined,
      });

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSettled?.(
        targetExpense
          ? `Marked ${formatCurrency(settleAmount)} as paid for ${targetExpense.note || 'expense'}`
          : `Settled all ${formatCurrency(settleAmount)} for ${personName}`
      );
      onClose();
    } catch (e: any) {
      setError(e?.message || 'Failed to record settlement. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const isSingle = !!targetExpense;
  const title = isSingle ? 'Mark as Paid' : 'Settle All';

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      title={title}
      colors={colors}
      isDark={isDark}
      footer={
        <View style={styles.footerWrap}>
          {error ? <Text style={[styles.errorText, { color: colors.danger }]}>{error}</Text> : null}
          <AppButton
            label={`Confirm Paid · ${formatCurrency(settleAmount)}`}
            variant="primary"
            size="cta"
            loading={busy}
            disabled={settleAmount <= 0}
            onPress={handleConfirm}
          />
        </View>
      }
    >
      <View style={styles.contentWrap}>
        {/* Context / Target pill badge */}
        <View
          style={[
            styles.contextBadge,
            {
              backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : colors.mintGreenSoft,
              borderColor: isDark ? 'rgba(184, 224, 200, 0.25)' : colors.mintGreen,
            },
          ]}
        >
          <Text style={[styles.contextPerson, { color: isDark ? colors.mintGreen : colors.forestGreen }]}>
            {personName}
          </Text>
          <Text style={[styles.contextDot, { color: colors.textSecondary }]}>•</Text>
          <Text numberOfLines={1} style={[styles.contextNote, { color: colors.textPrimary }]}>
            {isSingle ? targetExpense.note || 'Expense' : 'All open expenses'}
          </Text>
        </View>

        {/* Big Amount Display */}
        <View style={styles.amountContainer}>
          <Text style={[styles.amountLabel, { color: colors.textSecondary }]}>
            {isSingle ? 'SETTLEMENT AMOUNT' : 'TOTAL OUTSTANDING'}
          </Text>
          <Text
            style={[
              styles.amountValue,
              { color: isDark ? colors.mintGreen : colors.mintGreenDark },
            ]}
          >
            {formatCurrency(settleAmount)}
          </Text>
        </View>

        {/* Payment Mode Selector */}
        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary }]}>RECEIVED VIA</Text>
          <SegmentedControl
            options={[
              { key: 'upi', label: 'UPI' },
              { key: 'cash', label: 'Cash' },
            ]}
            selectedKey={paymentMode}
            onChange={(k) => {
              setPaymentMode(k as 'upi' | 'cash');
              Haptics.selectionAsync().catch(() => {});
            }}
          />
        </View>

        {/* Accounting explanation note */}
        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: isDark ? colors.card : colors.cardSubtle,
              borderColor: colors.borderSubtle,
            },
          ]}
        >
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            {isSingle
              ? `Marking this paid returns ${formatCurrency(settleAmount)} to your spending on this expense. It is not counted as new income.`
              : `Settling all open expenses will link ${formatCurrency(settleAmount)} back to original expenses (oldest first). It is not counted as new income.`}
          </Text>
        </View>

        {isSingle && onViewExpense && targetExpense ? (
          <Pressable
            onPress={() => {
              onClose();
              onViewExpense(targetExpense.expenseId);
            }}
            style={({ pressed }) => [
              styles.viewExpenseLink,
              pressed && { opacity: 0.65 },
            ]}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="View full expense details"
          >
            <Text style={[styles.viewExpenseText, { color: colors.textSecondary }]}>
              View expense details
            </Text>
            <ChevronRight size={13} color={colors.textSecondary} strokeWidth={2.2} />
          </Pressable>
        ) : null}
      </View>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  contentWrap: {
    gap: Spacing.block,
    paddingTop: Spacing.element,
    paddingBottom: Spacing.element,
  },
  viewExpenseLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.micro,
    paddingVertical: Spacing.nano,
  },
  viewExpenseText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
  },
  contextBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.element,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: Spacing.micro,
  },
  contextPerson: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  contextDot: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
  },
  contextNote: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.semibold,
    flexShrink: 1,
  },
  amountContainer: {
    gap: Spacing.micro,
  },
  amountLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  amountValue: {
    fontSize: FontSize.display,
    lineHeight: LineHeight.display,
    fontFamily: FontFamily.bold,
  },
  section: {
    gap: Spacing.element,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.5,
  },
  infoCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.surface,
  },
  infoText: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
  },
  footerWrap: {
    gap: Spacing.element,
    paddingTop: Spacing.micro,
  },
  errorText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    textAlign: 'center',
  },
});
