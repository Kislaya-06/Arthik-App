import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: (props: any) => ({ type: 'View', props }),
  Text: (props: any) => ({ type: 'Text', props }),
  Pressable: (props: any) => ({ type: 'Pressable', props }),
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

vi.mock('../src/components/RollingText', () => ({
  RollingText: (props: any) => ({ type: 'RollingText', props }),
}));

vi.mock('../src/components/PiggyBankCoinIcon', () => ({
  PiggyBankCoinIcon: (props: any) => ({ type: 'PiggyBankCoinIcon', props }),
}));

vi.mock('../src/store/themeStore', () => {
  const dummyColors = {
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderSubtle: '#F1F5F9',
    textPrimary: '#1A2B4C',
    textSecondary: '#64748B',
    mintGreen: '#4EBA6F',
    mintGreenDark: '#2E7D47',
    mintGreenSoft: '#E8F8EE',
    forestGreen: '#1A2B4C',
    coral: '#FF7A6E',
  };
  return {
    useTheme: () => ({ colors: dummyColors, isDark: false }),
    useThemeStore: () => ({ colors: dummyColors, isDark: false }),
  };
});

import { WeeklyBreathingStrip } from '../src/components/WeeklyBreathingStrip';
import { MonthlyBreathingStrip } from '../src/components/MonthlyBreathingStrip';
import { YearlyBreathingStrip } from '../src/components/YearlyBreathingStrip';

describe('Breathing Strips (Seam: WeeklyBreathingStrip, MonthlyBreathingStrip, YearlyBreathingStrip)', () => {
  describe('Finished periods never show a "safe daily pace" (nothing is left to pace)', () => {
    it('weekly: a past week in Budget Mode shows its daily burn, with the finalized note', () => {
      const el = WeeklyBreathingStrip({
        takeaway: { text: 'Great discipline!', status: 'mint' as any },
        isBudgetMode: true,
        safeDailyPace: 1650,
        isCurrentWeek: false,
        remainingDays: 0,
        transactionCount: 1,
        totalWeekSavings: 1650,
        savedDaysCount: 7,
        weeklyDailyBurnPace: 14,
      }) as any;
      const left = el.props.leftTile;
      expect(left.label).toBe('DAILY BURN');
      expect(left.value).toBe('₹14');
      expect(left.subtext).toBe('Finalized · Within budget');
      expect(JSON.stringify(left)).not.toContain('1,650');
    });

    it('monthly: a past month in Budget Mode shows its daily burn', () => {
      const el = MonthlyBreathingStrip({
        takeaway: { text: 'Done.', status: 'mint' as any },
        isBudgetMode: true,
        safeDailyPace: 7500,
        isCurrentMonth: false,
        remainingDays: 0,
        transactionCount: 4,
        totalMonthSavings: 0,
        savedDaysCount: 0,
        isOverBudget: true,
        monthlyDailyBurnPace: 160,
      }) as any;
      expect(el.props.leftTile.label).toBe('DAILY BURN');
      expect(el.props.leftTile.value).toBe('₹160');
      expect(el.props.leftTile.subtext).toBe('Finalized · Over budget');
    });

    it('the current week still shows the safe daily pace', () => {
      const el = WeeklyBreathingStrip({
        takeaway: { text: 'x', status: 'mint' as any },
        isBudgetMode: true,
        safeDailyPace: 450,
        isCurrentWeek: true,
        remainingDays: 4,
        transactionCount: 1,
        totalWeekSavings: 0,
        savedDaysCount: 0,
        weeklyDailyBurnPace: 14,
      }) as any;
      expect(el.props.leftTile.label).toBe('SAFE DAILY PACE');
      expect(el.props.leftTile.value).toBe('₹450');
    });
  });

  describe('WeeklyBreathingStrip', () => {
    it('renders budget mode with safe daily pace and remaining days correctly', () => {
      const el = WeeklyBreathingStrip({
        takeaway: { text: 'You are pacing well this week.', status: 'mintGreen' as any },
        isBudgetMode: true,
        safeDailyPace: 450,
        isCurrentWeek: true,
        remainingDays: 4,
        transactionCount: 5,
        totalWeekSavings: 300,
        savedDaysCount: 3,
      }) as any;

      expect(el).toBeTruthy();
      // Verify takeaway text
      expect(JSON.stringify(el)).toContain('You are pacing well this week.');
      // Verify left tile label
      expect(JSON.stringify(el)).toContain('SAFE DAILY PACE');
      expect(JSON.stringify(el)).toContain('450');
      expect(JSON.stringify(el)).toContain('/ day');
      expect(JSON.stringify(el)).toContain('4 days left to pace safely');
      // INS-002: the saved pill uses the app's piggy-bank icon, never an emoji in the text.
      expect(JSON.stringify(el)).toContain('"pillIcon":"gullak"');
      expect(JSON.stringify(el)).not.toContain('🐷');
      // Verify right tile savings
      expect(JSON.stringify(el)).toContain('AUTO-SAVED TO GULLAK');
      expect(JSON.stringify(el)).toContain('+₹300');
      expect(JSON.stringify(el)).toContain('Saved Days');
    });

    it('renders coral status dot and over budget warnings when budget exceeded', () => {
      const el = WeeklyBreathingStrip({
        takeaway: { text: 'Warning: Exceeded weekly allowance.', status: 'coral' as any },
        isBudgetMode: true,
        safeDailyPace: 0,
        isCurrentWeek: true,
        remainingDays: 2,
        transactionCount: 8,
        totalWeekSavings: 0,
        savedDaysCount: 0,
        isOverBudget: true,
      }) as any;

      expect(JSON.stringify(el)).toContain('Warning: Exceeded weekly allowance.');
      expect(JSON.stringify(el)).toContain('Budget exceeded\\nspend cautiously');
      expect(JSON.stringify(el)).toContain('Saved Days');
    });

    it('renders pure mode with daily burn pace and transaction count', () => {
      const el = WeeklyBreathingStrip({
        takeaway: { text: 'Logged 1 transaction this week.', status: 'mintGreen' as any },
        isBudgetMode: false,
        safeDailyPace: 0,
        isCurrentWeek: true,
        remainingDays: 3,
        transactionCount: 1,
        totalWeekSavings: 0,
        savedDaysCount: 0,
        weeklyDailyBurnPace: 120,
      }) as any;

      expect(JSON.stringify(el)).toContain('DAILY BURN');
      expect(JSON.stringify(el)).toContain('120');
      expect(JSON.stringify(el)).toContain('Across 1 logged transaction');
    });
  });

  describe('MonthlyBreathingStrip', () => {
    it('renders budget mode with boosted income correctly', () => {
      const el = MonthlyBreathingStrip({
        takeaway: { text: 'Great discipline this month.', status: 'mintGreen' as any },
        isBudgetMode: true,
        safeDailyPace: 800,
        isCurrentMonth: true,
        remainingDays: 12,
        transactionCount: 20,
        totalMonthSavings: 1500,
        savedDaysCount: 15,
        addedIncome: 5000,
      }) as any;

      expect(JSON.stringify(el)).toContain('Great discipline this month.');
      expect(JSON.stringify(el)).toContain('SAFE DAILY PACE');
      expect(JSON.stringify(el)).toContain('800');
      expect(JSON.stringify(el)).toContain('Boosted by ₹5,000 income · 12d left');
      expect(JSON.stringify(el)).toContain('AUTO-SAVED TO GULLAK');
      expect(JSON.stringify(el)).toContain('+₹1,500');
      expect(JSON.stringify(el)).toContain('Saved Days');
    });

    it('renders finalized month within budget', () => {
      const el = MonthlyBreathingStrip({
        takeaway: { text: 'Month closed successfully.', status: 'mintGreen' as any },
        isBudgetMode: true,
        safeDailyPace: 0,
        isCurrentMonth: false,
        remainingDays: 0,
        transactionCount: 25,
        totalMonthSavings: 2000,
        savedDaysCount: 20,
        isOverBudget: false,
      }) as any;

      expect(JSON.stringify(el)).toContain('Finalized · Within budget');
    });
  });

  describe('YearlyBreathingStrip', () => {
    it('renders annual surplus with net cashflow and savings rate pill', () => {
      const el = YearlyBreathingStrip({
        takeaway: { text: 'Outstanding surplus across the entire year.', status: 'mintGreen' as any },
        netCashFlow: 54000,
        isSurplus: true,
        totalInflow: 120000,
        totalOutflow: 66000,
        totalYearSavings: 12000,
        savingsRate: 18,
        savedDaysCount: 140,
        isCurrentYear: true,
        transactionCount: 300,
        isBudgetMode: true,
      }) as any;

      expect(JSON.stringify(el)).toContain('Outstanding surplus across the entire year.');
      expect(JSON.stringify(el)).toContain('NET SURPLUS');
      expect(JSON.stringify(el)).toContain('+₹54k');
      expect(JSON.stringify(el)).toContain('₹1.2L In · ₹66k Out');
      expect(JSON.stringify(el)).toContain('SAVINGS & GULLAK');
      expect(JSON.stringify(el)).toContain('+₹12,000');
      expect(JSON.stringify(el)).toContain('18% Saved · 140d');
    });

    it('renders net deficit when outflow exceeds inflow', () => {
      const el = YearlyBreathingStrip({
        takeaway: { text: 'Deficit incurred this year.', status: 'coral' as any },
        netCashFlow: -15000,
        isSurplus: false,
        totalInflow: 50000,
        totalOutflow: 65000,
        totalYearSavings: 0,
        savingsRate: null,
        savedDaysCount: 0,
        isCurrentYear: true,
        transactionCount: 150,
        isBudgetMode: true,
      }) as any;

      expect(JSON.stringify(el)).toContain('NET DEFICIT');
      expect(JSON.stringify(el)).toContain('−₹15k');
      expect(JSON.stringify(el)).toContain('₹50k In · ₹65k Out');
      expect(JSON.stringify(el)).toContain('0 Saved Days');
      expect(JSON.stringify(el)).toContain('"pillIcon":"gullak"');
      expect(JSON.stringify(el)).not.toContain('🐷');
    });

    it('renders net outflow in pure mode when inflow is 0', () => {
      const el = YearlyBreathingStrip({
        takeaway: { text: 'Pure expense tracking summary.', status: 'mintGreen' as any },
        netCashFlow: -20000,
        isSurplus: false,
        totalInflow: 0,
        totalOutflow: 20000,
        totalYearSavings: 0,
        savingsRate: null,
        savedDaysCount: 0,
        isCurrentYear: true,
        transactionCount: 42,
        isBudgetMode: false,
      }) as any;

      expect(JSON.stringify(el)).toContain('NET OUTFLOW');
      expect(JSON.stringify(el)).toContain('Across 42 logged transactions');
    });
  });
});
