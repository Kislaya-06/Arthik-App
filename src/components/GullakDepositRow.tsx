import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO } from 'date-fns';

import { GullakDeposit } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { GradientIconBadge } from './GradientIconBadge';
import { AmountText } from './ui/AmountText';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

export type GullakDepositRowProps = {
  deposit: GullakDeposit;
  colors?: ReturnType<typeof useTheme>['colors'];
  isDark?: boolean;
};

const GullakDepositRowBase: React.FC<GullakDepositRowProps> = ({ deposit, colors: propColors, isDark: propIsDark }) => {
  const theme = useTheme();
  const colors = propColors ?? theme.colors;
  const isDark = propIsDark ?? theme.isDark;
  const bg = '#ADEBB3';

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
          borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
        },
      ]}
    >
      <GradientIconBadge size={48} color={bg} isDark={isDark}>
        {({ iconColor }) => <PiggyBankCoinIcon size={22} color={iconColor} />}
      </GradientIconBadge>
      <View style={styles.txMiddle}>
        <Text style={[styles.txTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {mainTitle}
        </Text>
        <Text style={[styles.txSubtitle, { color: colors.textSecondary }]} numberOfLines={1}>
          {subtitle}
        </Text>
      </View>
      <View style={styles.txRight}>
        <AmountText
          role="row"
          value={deposit.amount}
          direction="income"
          signed
        />
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
    borderBottomWidth: 1,
  },
  txMiddle: {
    flex: 1,
    marginLeft: Spacing.group,
    justifyContent: 'center',
  },
  txTitle: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    fontFamily: FontFamily.bold,
    letterSpacing: -0.2,
  },
  txSubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
  txRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: Spacing.group,
  },
  txDate: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
});
