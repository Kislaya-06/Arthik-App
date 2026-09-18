import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Sparkles, AlertCircle, Coins } from 'lucide-react-native';
import { format, isYesterday, parseISO } from 'date-fns';

import { DailyRecord } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { formatCurrency } from '../lib/formatters';
import { Spacing, FontSize, FontFamily } from '../config/theme';

export interface SavingsRecordRowProps {
  rec: DailyRecord;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

const SavingsRecordRowBase: React.FC<SavingsRecordRowProps> = ({ rec, colors, isDark }) => {
  const isSaved = rec.saved > 0 && rec.status !== 'unknown';
  const isExceeded = rec.status === 'exceeded';
  const isUnknown = rec.status === 'unknown';

  const dateLabel = useMemo(() => {
    try {
      const dateObj = parseISO(rec.date);
      return isYesterday(dateObj)
        ? `Yesterday, ${format(dateObj, 'd MMM')}`
        : format(dateObj, 'EEE, d MMM yyyy');
    } catch {
      return rec.date;
    }
  }, [rec.date]);

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
              backgroundColor: isSaved
                ? colors.mintGreenSoft
                : isExceeded
                ? isDark
                  ? 'rgba(239, 68, 68, 0.2)'
                  : '#FEE2E2'
                : colors.cardSubtle,
            },
          ]}
        >
          {isSaved ? (
            <Sparkles size={20} color={colors.mintGreenDark} />
          ) : isExceeded ? (
            <AlertCircle size={20} color="#DC2626" />
          ) : (
            <Coins size={20} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.recordDetails}>
          <Text style={[styles.recordDateText, { color: colors.textPrimary }]}>
            {dateLabel}
          </Text>
          <Text style={[styles.recordSubText, { color: colors.textSecondary }]}>
            {isUnknown
              ? `Spent ${formatCurrency(rec.spent)} (Budget untracked)`
              : `Spent ${formatCurrency(rec.spent)} of ${formatCurrency(rec.budget)}`}
          </Text>
        </View>
      </View>

      {/* Savings Pill */}
      <View
        style={[
          styles.recordSavedPill,
          {
            backgroundColor: isSaved
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
              color: isSaved
                ? colors.mintGreenDark
                : isExceeded
                ? '#DC2626'
                : colors.textSecondary,
            },
          ]}
        >
          {isSaved
            ? `+${formatCurrency(rec.saved)} Saved 🎉`
            : isExceeded
            ? `Over by ${formatCurrency(rec.spent - rec.budget)}`
            : isUnknown
            ? `Untracked`
            : `Exact Budget (₹0)`}
        </Text>
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
});
