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
  const hasNote = Boolean(deposit.note && deposit.note.trim().length > 0);
  const mainTitle = hasNote ? deposit.note!.trim() : 'Gullak Deposit';
  const subtitle = hasNote ? `Gullak · ${sourceLabel}` : sourceLabel;

  return (
    <View
      style={[
        styles.txRow,
        {
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : colors.borderSubtle,
        },
      ]}
    >
      <View style={[styles.txIconContainer, { backgroundColor: bg }]}>
        <PiggyBankCoinIcon size={22} color={iconColor} />
      </View>
      <View style={styles.txMiddle}>
        <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {mainTitle}
        </Text>
        <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.txRight}>
        <Text style={[styles.txAmount, { color: amountColor }]}>
          {`+${formatCurrency(Math.abs(deposit.amount))}`}
        </Text>
        <Text style={[styles.txDate, { color: colors.textMuted }]}>{dateStr}</Text>
      </View>
    </View>
  );
};

export const GullakDepositRow = React.memo(GullakDepositRowBase);

const styles = StyleSheet.create({
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  txIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
    marginLeft: 14,
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  txSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    marginTop: 3,
  },
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: 12,
  },
  txAmount: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
  txDate: {
    fontSize: 12,
    fontFamily: FontFamily.medium,
    marginTop: 3,
  },
});
