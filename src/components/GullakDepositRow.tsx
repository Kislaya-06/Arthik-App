import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';

import { GullakDeposit } from '../store/dailyBudgetStore';
import { useTheme } from '../store/themeStore';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { GradientIconBadge } from './GradientIconBadge';
import { ItemRowShell } from './ui/ItemRowShell';

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
    <ItemRowShell
      iconBadge={
        <GradientIconBadge size={48} color={bg} isDark={isDark}>
          {({ iconColor }) => <PiggyBankCoinIcon size={22} color={iconColor} />}
        </GradientIconBadge>
      }
      title={mainTitle}
      subtitle={subtitle}
      amount={deposit.amount}
      direction="income"
      signed
      dateStr={dateStr}
      colors={colors}
      isDark={isDark}
    />
  );
};

export const GullakDepositRow = React.memo(GullakDepositRowBase);
