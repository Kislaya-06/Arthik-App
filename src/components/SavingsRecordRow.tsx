import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, AlertCircle, Coins, Trash2 } from 'lucide-react-native';
import { format, isYesterday, parseISO } from 'date-fns';

import { DailyRecord, GullakDeposit } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { formatCurrency } from '../lib/formatters';
import { Spacing, FontSize, FontFamily, BorderRadius } from '../config/theme';

export interface SavingsRecordRowProps {
  rec?: DailyRecord;
  deposit?: GullakDeposit;
  onDeleteDeposit?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

const SavingsRecordRowBase: React.FC<SavingsRecordRowProps> = ({
  rec,
  deposit,
  onDeleteDeposit,
  colors,
  isDark,
}) => {
  const isDeposit = !!deposit;
  const isSaved = !isDeposit && !!rec && rec.saved > 0 && rec.status !== 'unknown';
  const isExceeded = !isDeposit && !!rec && rec.status === 'exceeded';
  const isUnknown = !isDeposit && !!rec && rec.status === 'unknown';

  const dateLabel = useMemo(() => {
    const rawDate = deposit?.date || rec?.date;
    if (!rawDate) return '';
    try {
      const dateObj = parseISO(rawDate);
      return isYesterday(dateObj)
        ? `Yesterday, ${format(dateObj, 'd MMM')}`
        : format(dateObj, isDeposit ? 'd MMM yyyy' : 'EEE, d MMM yyyy');
    } catch {
      return rawDate;
    }
  }, [rec?.date, deposit?.date, isDeposit]);

  return (
    <View
      style={[
        styles.recordCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      <View style={styles.recordLeft}>
        <View
          style={[
            styles.recordIconBox,
            {
              backgroundColor: isDeposit || isSaved
                ? colors.mintGreenSoft
                : isExceeded
                ? isDark
                  ? 'rgba(239, 68, 68, 0.2)'
                  : '#FEE2E2'
                : colors.cardSubtle,
            },
          ]}
        >
          {isDeposit ? (
            <PiggyBankCoinIcon size={20} color={colors.mintGreenDark} />
          ) : isSaved ? (
            <Sparkles size={20} color={colors.mintGreenDark} />
          ) : isExceeded ? (
            <AlertCircle size={20} color="#DC2626" />
          ) : (
            <Coins size={20} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.recordDetails}>
          <Text style={[styles.recordDateText, { color: colors.textPrimary }]}>
            {isDeposit ? (deposit!.note || 'Deposit to Gullak') : dateLabel}
          </Text>
          <Text style={[styles.recordSubText, { color: colors.textSecondary }]}>
            {isDeposit
              ? `Manual Deposit • ${dateLabel}`
              : isUnknown
              ? `Spent ${formatCurrency(rec!.spent)} (Budget untracked)`
              : `Spent ${formatCurrency(rec!.spent)} of ${formatCurrency(rec!.budget)}`}
          </Text>
        </View>
      </View>

      <View style={styles.recordRightRow}>
        {/* Savings Pill */}
        <View
          style={[
            styles.recordSavedPill,
            {
              backgroundColor: isDeposit || isSaved
                ? colors.mintGreenSoft
                : isExceeded
                ? isDark
                  ? 'rgba(239, 68, 68, 0.15)'
                  : '#FEF2F2'
                : colors.cardSubtle,
            },
          ]}
        >
          <Text
            style={[
              styles.recordSavedText,
              {
                color: isDeposit || isSaved
                  ? colors.mintGreenDark
                  : isExceeded
                  ? '#DC2626'
                  : colors.textSecondary,
              },
            ]}
          >
            {isDeposit
              ? `+${formatCurrency(deposit!.amount)}`
              : isSaved
              ? `+${formatCurrency(rec!.saved)} Saved 🎉`
              : isExceeded
              ? `Over by ${formatCurrency(rec!.spent - rec!.budget)}`
              : isUnknown
              ? `Untracked`
              : `Exact Budget (₹0)`}
          </Text>
        </View>

        {isDeposit && onDeleteDeposit && (
          <TouchableOpacity
            onPress={onDeleteDeposit}
            hitSlop={12}
            style={styles.deleteBtn}
          >
            <Trash2 size={14} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export const SavingsRecordRow = React.memo(SavingsRecordRowBase);

const styles = StyleSheet.create({
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.group,
    flex: 1,
  },
  recordIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordDetails: {
    flex: 1,
  },
  recordDateText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  recordSubText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.nano,
  },
  recordSavedPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  recordSavedText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  recordRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  deleteBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
