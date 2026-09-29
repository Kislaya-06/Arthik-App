import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Sparkles, AlertCircle, Coins, ChevronRight } from 'lucide-react-native';
import { format, isYesterday, parseISO } from 'date-fns';

import { DailyRecord, GullakDeposit } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { formatCurrency } from '../lib/formatters';
import { FontFamily } from '../config/theme';

export interface SavingsRecordRowProps {
  rec?: DailyRecord;
  deposit?: GullakDeposit;
  onPress?: () => void;
  onDeleteDeposit?: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

const SavingsRecordRowBase: React.FC<SavingsRecordRowProps> = ({
  rec,
  deposit,
  onPress,
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

  const mainTitle = useMemo(() => {
    if (isDeposit) {
      return deposit!.note?.trim() || 'Deposit to Gullak';
    }
    return dateLabel;
  }, [isDeposit, deposit, dateLabel]);

  const subtitle = useMemo(() => {
    if (isDeposit) {
      return `Manual Deposit · ${dateLabel}`;
    }
    if (isUnknown) {
      return `Spent ${formatCurrency(rec!.spent)} (Budget untracked)`;
    }
    return `Spent ${formatCurrency(rec!.spent)} of ${formatCurrency(rec!.budget)}`;
  }, [isDeposit, dateLabel, isUnknown, rec]);

  const incomeGreen = isDark ? colors.mintGreen : colors.mintGreenDark;
  const warningRed = isDark ? colors.peachCoral : '#DC2626';

  const { amountText, amountColor, statusText, statusColor } = useMemo(() => {
    if (isDeposit) {
      return {
        amountText: `+${formatCurrency(deposit!.amount)}`,
        amountColor: incomeGreen,
        statusText: 'Manual',
        statusColor: colors.textMuted,
      };
    }
    if (isSaved) {
      return {
        amountText: `+${formatCurrency(rec!.saved)}`,
        amountColor: incomeGreen,
        statusText: 'Saved 🎉',
        statusColor: incomeGreen,
      };
    }
    if (isExceeded) {
      const overAmount = rec!.spent - rec!.budget;
      return {
        amountText: `−${formatCurrency(overAmount)}`,
        amountColor: warningRed,
        statusText: 'Over budget',
        statusColor: warningRed,
      };
    }
    if (isUnknown) {
      return {
        amountText: '—',
        amountColor: colors.textMuted,
        statusText: 'Untracked',
        statusColor: colors.textMuted,
      };
    }
    return {
      amountText: '₹0',
      amountColor: colors.textSecondary,
      statusText: 'Exact budget',
      statusColor: colors.textMuted,
    };
  }, [isDeposit, isSaved, isExceeded, isUnknown, deposit, rec, incomeGreen, warningRed, colors.textMuted, colors.textSecondary]);

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
      <View style={[styles.recordIconBox, { backgroundColor: iconBg }]}>
        {isDeposit ? (
          <PiggyBankCoinIcon size={22} color="#000000" />
        ) : isSaved ? (
          <Sparkles size={22} color="#000000" strokeWidth={2.2} />
        ) : isExceeded ? (
          <AlertCircle size={22} color="#000000" strokeWidth={2.2} />
        ) : (
          <Coins size={22} color="#000000" strokeWidth={2.2} />
        )}
      </View>

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
          <Text style={[styles.recordAmount, { color: amountColor }]}>
            {amountText}
          </Text>
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
