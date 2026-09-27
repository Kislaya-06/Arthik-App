import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';

import { GullakDeposit } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { formatCurrency } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

export type GullakDepositRowProps = {
  deposit: GullakDeposit;
  colors?: ReturnType<typeof useTheme>['colors'];
  isDark?: boolean;
};

const GullakDepositRowBase: React.FC<GullakDepositRowProps> = ({ deposit, colors: propColors, isDark: propIsDark }) => {
  const theme = useTheme();
  const colors = propColors ?? theme.colors;
  const isDark = propIsDark ?? theme.isDark;
  const bg = isDark ? 'rgba(184, 224, 200, 0.15)' : colors.mintGreenSoft;
  const iconColor = isDark ? colors.mintGreen : colors.mintGreenDark;
  const amountColor = isDark ? colors.mintGreen : colors.mintGreenDark;

  const dateStr = useMemo(() => {
    try {
      return format(parseISO(deposit.date), 'd MMM');
    } catch {
      return deposit.date;
    }
  }, [deposit.date]);

  const sourceLabel = deposit.source === 'income' ? 'From Income' : 'External Deposit';

  return (
    <View
      style={[
        styles.txRow,
        {
          backgroundColor: colors.card,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : colors.borderSubtle,
        },
      ]}
    >
      <View style={[styles.txIconContainer, { backgroundColor: bg }]}>
        <PiggyBankCoinIcon size={20} color={iconColor} />
      </View>
      <View style={styles.txMiddle}>
        <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {deposit.note || 'Gullak Deposit'}
        </Text>
        <View style={styles.txSubtitleRow}>
          <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
            {sourceLabel}
          </Text>
        </View>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {`+${formatCurrency(Math.abs(deposit.amount))}`}
        </Text>
        <Text style={[styles.txDate, { color: colors.textSecondary }]}>{dateStr}</Text>
      </View>
    </View>
  );
};

export const GullakDepositRow = React.memo(GullakDepositRowBase);

const styles = StyleSheet.create({
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  txIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: 14,
  },
  txTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  txSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  txSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
  },
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: Spacing.group,
  },
  txAmount: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  txDate: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
});
