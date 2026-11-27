/**
 * moneyExplainerContent.ts
 *
 * Explanatory content for financial invariants, cadence changes,
 * deposit sources, rollover rules, and Pure Mode balance mechanics.
 */

export type MoneyExplainerTopic =
  | 'cadence_switch'
  | 'budget_pause'
  | 'deposit_sources'
  | 'rollover_savings'
  | 'pure_mode_balance';

export interface MoneyExplainerItem {
  tag: string;
  title: string;
  description: string;
  iconName: 'shield' | 'calendar' | 'coins' | 'wallet' | 'sparkles' | 'check' | 'lock' | 'clock';
}

export interface MoneyExplainerContent {
  topic: MoneyExplainerTopic;
  title: string;
  subtitle: string;
  items: MoneyExplainerItem[];
  footerTip: string;
}

export const MONEY_EXPLAINER_DATA: Record<MoneyExplainerTopic, MoneyExplainerContent> = {
  cadence_switch: {
    topic: 'cadence_switch',
    title: 'Switching Your Budget Cycle',
    subtitle: 'Here is how your money is handled when changing budget cycles:',
    items: [
      {
        tag: 'Savings Safe',
        title: 'You choose where leftover goes',
        description:
          'Save the unspent budget to Gullak, or carry it forward so it pays part of your new budget. It moves at midnight.',
        iconName: 'shield',
      },
      {
        tag: 'Real Money',
        title: 'Full Budget Without Cuts',
        description:
          'A new budget gives its full amount, even mid-week or mid-month. Whatever you do not spend goes to Gullak when it ends.',
        iconName: 'calendar',
      },
      {
        tag: 'One Budget',
        title: 'One budget per week or month',
        description:
          'A week or month gets its budget once. Switching back inside the same period never gives a second full budget.',
        iconName: 'calendar',
      },
      {
        tag: 'Fresh Start',
        title: 'Full cycle begins on schedule',
        description:
          'Your full new budget amount automatically takes effect on the next natural boundary (Monday for Weekly, 1st for Monthly).',
        iconName: 'clock',
      },
      {
        tag: 'Real-Money Guarantee',
        title: 'Zero money is lost or doubled',
        description:
          'Every calendar day has exactly one budget owner. No rupee is erased or double-counted in your all-time finances.',
        iconName: 'lock',
      },
    ],
    footerTip: 'Tip: You can cancel or adjust pending plan changes anytime before midnight from budget settings.',
  },

  budget_pause: {
    topic: 'budget_pause',
    title: 'Switching to Pure Tracking',
    subtitle: 'What happens to your funds when Budget Mode is turned off:',
    items: [
      {
        tag: '100% Safe',
        title: 'Gullak is used last',
        description:
          'Your Gullak is never deleted or reset. In Pure Mode a spend is paid from your income first, and only then from Gullak.',
        iconName: 'coins',
      },
      {
        tag: 'Real Inflow',
        title: 'Past allowances remain in Inflow',
        description:
          'Daily allowances from active past days were real money transferred into your pool. They stay preserved in your lifetime Inflow forever.',
        iconName: 'wallet',
      },
      {
        tag: 'From Tomorrow',
        title: 'Your budget ends at midnight',
        description:
          'What is left of a weekly or monthly budget moves to Gullak. Come back in the same period and it returns, minus anything Pure Mode took from Gullak.',
        iconName: 'shield',
      },
      {
        tag: 'Flexible',
        title: 'Resume anytime in one tap',
        description:
          'You can switch Budget Mode back on at any point. It starts the next day.',
        iconName: 'check',
      },
    ],
    footerTip: 'Tip: Pure Mode gives you simple income and expense tracking without limits or warnings.',
  },

  deposit_sources: {
    topic: 'deposit_sources',
    title: 'Gullak Deposit Sources Explained',
    subtitle: 'Understand the difference between the two deposit options:',
    items: [
      {
        tag: 'Existing Money',
        title: 'From Income (Tracked Earnings)',
        description:
          'Transfers money you have already logged as income into your Gullak savings. This ring-fences your money for savings without inflating your total balance.',
        iconName: 'wallet',
      },
      {
        tag: 'Fresh Money',
        title: 'Add New Money (External Funds)',
        description:
          'Records fresh funds received from outside (e.g. cash gift, festival bonus, cash in hand). This increases both your Gullak savings and your total available funds.',
        iconName: 'coins',
      },
      {
        tag: 'Reversible',
        title: 'Safe removal anytime',
        description:
          'Remove a wrong deposit anytime. Money from income goes back to income. New money leaves your total.',
        iconName: 'shield',
      },
    ],
    footerTip: 'Tip: Use "From Income" to allocate from logged earnings, and "Add New Money" when receiving unrecorded cash.',
  },

  rollover_savings: {
    topic: 'rollover_savings',
    title: 'How Gullak Rollover Works',
    subtitle: 'Automate your daily and period savings discipline:',
    items: [
      {
        tag: 'Midnight Rollover',
        title: 'Unspent budget becomes savings',
        description:
          'At the end of each cycle (Daily at 12:00 AM, Weekly on Sunday night, Monthly at month-end), whatever you did not spend automatically rolls into your Gullak.',
        iconName: 'sparkles',
      },
      {
        tag: 'Real Cash',
        title: 'Real savings in your pocket',
        description:
          'Every rupee rolled over represents real cash saved by spending under your limit. It belongs strictly to you.',
        iconName: 'coins',
      },
      {
        tag: 'Consistency Streak',
        title: 'Build your discipline streak',
        description:
          'Completing a period within or under budget increases your savings streak and awards consistency badges.',
        iconName: 'calendar',
      },
      {
        tag: 'Overspending',
        title: 'What if you spend more?',
        description:
          'The extra is paid from your income first. Only when income is used up does it come from Gullak.',
        iconName: 'shield',
      },
    ],
    footerTip: 'Tip: Tap the Gullak piggy bank on the Savings screen anytime to view your full day-by-day savings history.',
  },

  pure_mode_balance: {
    topic: 'pure_mode_balance',
    title: 'How Your Balance is Calculated',
    subtitle: 'Pure Mode calculates your net cash flow with real-money integrity:',
    items: [
      {
        tag: 'Money In',
        title: 'Total Inflow (+₹)',
        description:
          'All your recorded incomes, plus daily allowances from past days when Budget Mode was active (which were real funds allocated into your pool).',
        iconName: 'wallet',
      },
      {
        tag: 'Money Out',
        title: 'Total Outflow (−₹)',
        description:
          'The total amount of all expenses logged across the selected timeframe (Daily, Weekly, Monthly, or All).',
        iconName: 'coins',
      },
      {
        tag: 'Net Cash Left',
        title: 'Remaining Balance',
        description:
          'Total Inflow minus Outflow. This is the exact net amount of money you have available in real life.',
        iconName: 'check',
      },
      {
        tag: 'Deficit Alert',
        title: 'Overspent warning',
        description:
          'If your expenses exceed your inflow in any period, the remaining balance turns alert red to indicate a cash deficit.',
        iconName: 'shield',
      },
    ],
    footerTip: 'Tip: Switch between Daily, Weekly, Monthly, and All time filters on Home to review cash flow across any period.',
  },
};

export function getMoneyExplainerContent(topic: MoneyExplainerTopic): MoneyExplainerContent {
  return MONEY_EXPLAINER_DATA[topic] || MONEY_EXPLAINER_DATA.cadence_switch;
}
