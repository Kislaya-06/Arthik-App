import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';

import { GullakDeposit } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { formatCurrency } from '../lib/formatters';
import { Spacing, FontSize, FontFamily } from '../config/theme';

export type GullakDepositRowProps = {
  deposit: GullakDeposit;
  colors?: ReturnType<typeof useTheme>['colors'];
  isDark?: boolean;
};

const GullakDepositRowBase: React.FC<GullakDepositRowProps> = ({ deposit, colors: propColors, isDark: propIsDark }) => {
  const theme = useTheme();
  const colors = propColors ?? theme.colors;
  const isDark = propIsDark ?? theme.isDark;
  const bg = colors.mintGreenSoft;
  const iconColor = colors.mintGreenDark;

  const dateStr = useMemo(() => {
    try {
      return format(parseISO(deposit.date), 'd MMM');
    } catch {
      return deposit.date;
    }
  }, [deposit.date]);

  const sourceLabel = deposit.source === 'income' ? 'From Income' : 'External Deposit';

  return (
    <View style={styles.txRow}>
      <View style={[styles.txIconContainer, { backgroundColor: bg }]}>
        <PiggyBankCoinIcon size={22} color={iconColor} />
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
        <Text style={[styles.txAmount, { color: isDark ? colors.mintGreen : colors.mintGreenDark }]}>
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
    marginTop: Spacing.surface,
  },
  txIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: Spacing.block,
  },
  txTitle: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  txSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.nano,
  },
  txSubtitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
  },
  txRight: {
    alignItems: 'flex-end',
  },
  txAmount: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  txDate: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.medium,
    marginTop: Spacing.nano,
  },
});
