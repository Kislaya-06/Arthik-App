import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { PressableOpacity } from './ui/PressableOpacity';
import Sparkles from 'lucide-react-native/icons/sparkles';
import AlertCircle from 'lucide-react-native/icons/circle-alert';
import Coins from 'lucide-react-native/icons/coins';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { savingsRowDateLabel, savingsRowValue } from '../lib/savingsHistoryGroups';

import { DailyRecord, GullakDeposit, BudgetPeriodRecord } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { GradientIconBadge } from './GradientIconBadge';
import { formatCurrency } from '../lib/formatters';
import { FontFamily, Spacing } from '../config/theme';
import { AmountText } from './ui/AmountText';

export interface SavingsRecordRowProps {
  rec?: DailyRecord;
  deposit?: GullakDeposit;
  period?: BudgetPeriodRecord;
  onPress?: () => void;
  onDeleteDeposit?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
  /** Last row of its group card: no divider under it. */
  isLast?: boolean;
}

const SavingsRecordRowBase: React.FC<SavingsRecordRowProps> = ({
  rec,
  deposit,
  period,
  onPress,
  onDeleteDeposit,
  colors,
  isDark,
  isLast = false,
}) => {
  const isPeriod = !!period;
  const isDeposit = !isPeriod && !!deposit;
  const isSaved = isPeriod
    ? (period.status === 'saved' || period.amountSaved > 0)
    : !isDeposit && !!rec && rec.saved > 0 && rec.status !== 'unknown';
  const isMissed = isPeriod
    ? period.status === 'missed'
    : !isDeposit && !!rec && rec.status === 'missed';
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
    return savingsRowDateLabel(rawDate, isDeposit ? 'deposit' : 'daily', new Date());
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

  // Money text: readable deep mint / coral on Light, the brand mint / coral on Dark and AMOLED (ADR 0021).
  const incomeGreen = colors.mintText;
  const warningRed = colors.coralText;

  const { amountColor, statusText, statusColor } = useMemo(() => {
    if (isPeriod && period) {
      if (isSaved) {
        return {
          amountColor: incomeGreen,
          statusText: 'Saved',
          statusColor: incomeGreen,
        };
      }
      if (isMissed) {
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
        statusText: 'Saved',
        statusColor: incomeGreen,
      };
    }
    if (isMissed) {
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
  }, [isPeriod, period, isDeposit, isSaved, isMissed, isUnknown, incomeGreen, warningRed, colors.textMuted, colors.textSecondary]);

  const iconBg = useMemo(() => {
    if (isDeposit || isSaved) {
      return '#ADEBB3';
    }
    if (isMissed) {
      return '#FF857A';
    }
    return '#FFD3AC';
  }, [isDeposit, isSaved, isMissed]);

  const isInteractive = Boolean(onPress || onDeleteDeposit);
  const ContainerComponent = isInteractive ? PressableOpacity : View;

  return (
    <ContainerComponent
      style={[
        styles.recordRow,
        {
          borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.borderSubtle,
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
          ) : isMissed ? (
            <AlertCircle size={22} color={iconColor} strokeWidth={2.2} />
          ) : (
            <Coins size={22} color={iconColor} strokeWidth={2.2} />
          )
        )}
      </GradientIconBadge>

      <View style={styles.recordDetails}>
        <Text
          style={[styles.recordTitleText, { color: colors.textPrimary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
          {mainTitle}
        </Text>
        <Text
          style={[styles.recordSubText, { color: colors.textSecondary }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}
        >
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
              value={savingsRowValue({ dailyRecord: rec, deposit, period }).amount}
              direction={isSaved || isDeposit ? 'income' : isMissed ? 'expense' : 'neutral'}
              signed={isSaved || isDeposit || isMissed}
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
    paddingVertical: Spacing.group,
    paddingHorizontal: Spacing.block,
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
    minWidth: 0,
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
    flexShrink: 0,
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
