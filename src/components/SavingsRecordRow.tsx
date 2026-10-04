import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, AlertCircle, Coins, ChevronRight } from 'lucide-react-native';
import { format, isYesterday, parseISO } from 'date-fns';

import { DailyRecord, GullakDeposit, BudgetPeriodRecord } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { GradientIconBadge } from './GradientIconBadge';
import { formatCurrency } from '../lib/formatters';
import { FontFamily } from '../config/theme';
import { AmountText } from './ui/AmountText';

export interface SavingsRecordRowProps {
  rec?: DailyRecord;
  deposit?: GullakDeposit;
  period?: BudgetPeriodRecord;
  onPress?: () => void;
  onDeleteDeposit?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

const SavingsRecordRowBase: React.FC<SavingsRecordRowProps> = ({
  rec,
  deposit,
  period,
  onPress,
  onDeleteDeposit,
  colors,
  isDark,
}) => {
  const isPeriod = !!period;
  const isDeposit = !isPeriod && !!deposit;
  const isSaved = isPeriod
    ? (period.status === 'saved' || period.amountSaved > 0)
    : !isDeposit && !!rec && rec.saved > 0 && rec.status !== 'unknown';
  const isExceeded = isPeriod
    ? period.status === 'missed'
    : !isDeposit && !!rec && rec.status === 'exceeded';
  const isUnknown = isPeriod
    ? period.status === 'unknown'
    : !isDeposit && !!rec && rec.status === 'unknown';

  const dateLabel = useMemo(() => {
    if (isPeriod && period) {
      try {
        const startD = parseISO(period.activeStart || period.periodStart);
        if (period.cadence === 'weekly') {
          return `Week of ${format(startD, 'd MMM')}`;
        }
        if (period.cadence === 'monthly') {
          return format(startD, 'MMMM yyyy');
        }
        return format(startD, 'd MMM yyyy');
      } catch {
        return period.periodStart;
      }
    }
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
  }, [isPeriod, period, rec?.date, deposit?.date, isDeposit]);

  const mainTitle = useMemo(() => {
    if (isDeposit) {
      return deposit!.note?.trim() || 'Deposit to Gullak';
    }
    return dateLabel;
  }, [isDeposit, deposit, dateLabel]);

  const subtitle = useMemo(() => {
    if (isPeriod && period) {
      return `Spent ${formatCurrency(period.spentAmount)} of ${formatCurrency(period.budgetAmount)}`;
    }
    if (isDeposit) {
      return `Manual Deposit · ${dateLabel}`;
    }
    if (isUnknown) {
      return `Spent ${formatCurrency(rec!.spent)} (Budget untracked)`;
    }
    return `Spent ${formatCurrency(rec!.spent)} of ${formatCurrency(rec!.budget)}`;
  }, [isPeriod, period, isDeposit, dateLabel, isUnknown, rec]);

  const incomeGreen = isDark ? colors.mintGreen : colors.mintGreenDark;
  const warningRed = isDark ? colors.peachCoral : '#DC2626';

  const { amountColor, statusText, statusColor } = useMemo(() => {
    if (isPeriod && period) {
      if (isSaved) {
        return {
          amountColor: incomeGreen,
          statusText: 'Saved 🎉',
          statusColor: incomeGreen,
        };
      }
      if (isExceeded) {
        return {
          amountColor: warningRed,
          statusText: 'Over budget',
          statusColor: warningRed,
        };
      }
      if (period.status === 'even') {
        return {
          amountColor: colors.textSecondary,
          statusText: 'Budget met',
          statusColor: colors.textMuted,
        };
      }
      return {
        amountColor: colors.textMuted,
        statusText: 'Untracked',
        statusColor: colors.textMuted,
      };
    }
    if (isDeposit) {
      return {
        amountColor: incomeGreen,
        statusText: 'Manual',
        statusColor: colors.textMuted,
      };
    }
    if (isSaved) {
      return {
        amountColor: incomeGreen,
        statusText: 'Saved 🎉',
        statusColor: incomeGreen,
      };
    }
    if (isExceeded) {
      return {
        amountColor: warningRed,
        statusText: 'Over budget',
        statusColor: warningRed,
      };
    }
    if (isUnknown) {
      return {
        amountColor: colors.textMuted,
        statusText: 'Untracked',
        statusColor: colors.textMuted,
      };
    }
    return {
      amountColor: colors.textSecondary,
      statusText: 'Exact budget',
      statusColor: colors.textMuted,
    };
  }, [isPeriod, period, isDeposit, isSaved, isExceeded, isUnknown, incomeGreen, warningRed, colors.textMuted, colors.textSecondary]);

  const iconBg = useMemo(() => {
    if (isDeposit || isSaved) {
      return '#ADEBB3';
    }
    if (isExceeded) {
      return '#FF857A';
    }
    return '#FFD3AC';
  }, [isDeposit, isSaved, isExceeded]);

  const isInteractive = Boolean(onPress || onDeleteDeposit);
  const ContainerComponent = isInteractive ? TouchableOpacity : View;

  return (
    <ContainerComponent
      style={[
        styles.recordRow,
        {
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
      activeOpacity={0.7}
      onPress={onPress}
      onLongPress={onDeleteDeposit}
    >
      <GradientIconBadge size={44} color={iconBg} isDark={isDark}>
        {({ iconColor }) => (
          isDeposit ? (
            <PiggyBankCoinIcon size={22} color={iconColor} />
          ) : isSaved ? (
            <Sparkles size={22} color={iconColor} strokeWidth={2.2} />
          ) : isExceeded ? (
            <AlertCircle size={22} color={iconColor} strokeWidth={2.2} />
          ) : (
            <Coins size={22} color={iconColor} strokeWidth={2.2} />
          )
        )}
      </GradientIconBadge>

      <View style={styles.recordDetails}>
        <Text style={[styles.recordTitleText, { color: colors.textPrimary }]} numberOfLines={1}>
          {mainTitle}
        </Text>
        <Text style={[styles.recordSubText, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>

      <View style={styles.recordRightRow}>
        <View style={styles.recordAmountCol}>
          {isUnknown ? (
            <Text style={[styles.recordAmount, { color: colors.textMuted }]}>—</Text>
          ) : (
            <AmountText
              role="row"
              value={
                isPeriod && period
                  ? isSaved
                    ? period.amountSaved
                    : isExceeded
                    ? Math.max(0, period.spentAmount - period.budgetAmount)
                    : 0
                  : isDeposit
                  ? deposit!.amount
                  : isSaved
                  ? rec!.saved
                  : isExceeded
                  ? rec!.spent - rec!.budget
                  : 0
              }
              direction={isSaved || isDeposit ? 'income' : isExceeded ? 'expense' : 'neutral'}
              signed={isSaved || isDeposit || isExceeded}
              color={amountColor}
            />
          )}
          <Text style={[styles.recordStatusText, { color: statusColor }]}>
            {statusText}
          </Text>
        </View>
        {isDeposit && (
          <ChevronRight
            size={16}
            color={colors.textSecondary}
            style={styles.chevronIcon}
          />
        )}
      </View>
    </ContainerComponent>
  );
};

export const SavingsRecordRow = React.memo(SavingsRecordRowBase);

const styles = StyleSheet.create({
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  recordIconBox: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordDetails: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  recordTitleText: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  recordSubText: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    marginTop: 3,
  },
  recordRightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginLeft: 12,
  },
  recordAmountCol: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  chevronIcon: {
    marginLeft: 6,
  },
  recordAmount: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  recordStatusText: {
    fontSize: 12,
    fontFamily: FontFamily.semibold,
    marginTop: 3,
  },
});
