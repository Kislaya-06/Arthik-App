import { describe, it, expect, vi } from 'vitest';

vi.mock('lucide-react-native', () => ({
  Wallet: () => null,
  CreditCard: () => null,
  CheckSquare: () => null,
}));

import {
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
} from 'date-fns';
import { isIncomeTransaction } from '../src/lib/paymentUtils';
import { computeMonthlyCashFlowData } from '../src/lib/chartUtils';

describe('Insights Screen - Expense Aggregation Logic', () => {
  // Pure aggregation function mirroring src/screens/InsightsScreen.tsx
  function computeInsightsData(
    expenses: Array<{
      amount: number;
      expense_date: string;
      category_id?: string | null;
      payment_mode: 'cash' | 'upi' | 'card';
      type?: string;
    }>,
    categories: Array<{ id: string; name: string }>,
    period: 'Weekly' | 'Monthly' | 'Yearly',
    referenceNow: Date
  ) {
    let start: Date;
    let end: Date;
    if (period === 'Weekly') {
      start = startOfWeek(referenceNow, { weekStartsOn: 1 });
      end = endOfWeek(referenceNow, { weekStartsOn: 1 });
    } else if (period === 'Monthly') {
      start = startOfMonth(referenceNow);
      end = endOfMonth(referenceNow);
    } else {
      start = startOfYear(referenceNow);
      end = endOfYear(referenceNow);
    }
    const currentInterval = { start, end };

    let curr = 0;
    const catTotals: Record<string, number> = {};

    for (const exp of expenses) {
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;

      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;

      const date = parseISO(cleanDate);
      if (isWithinInterval(date, currentInterval)) {
        curr += exp.amount;
        const key = exp.category_id || 'others';
        catTotals[key] = (catTotals[key] || 0) + exp.amount;
      }
    }

    // Earliest non-income expense date
    let earliest: string | null = null;
    for (const exp of expenses) {
      if (!exp.expense_date) continue;
      const cleanDate = exp.expense_date.split('T')[0]?.trim();
      if (!cleanDate) continue;
      const cat = exp.category_id ? categories.find((c) => c.id === exp.category_id) : undefined;
      if (isIncomeTransaction(exp, cat)) continue;
      if (!earliest || cleanDate < earliest) {
        earliest = cleanDate;
      }
    }
    const earliestExpenseDate = earliest ? parseISO(earliest) : null;

    // Top payment mode
    const counts: Record<string, number> = {};
    let totalPayments = 0;
    for (const exp of expenses) {
      const cleanDate = exp.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      if (isWithinInterval(parseISO(cleanDate), currentInterval)) {
        counts[exp.payment_mode] = (counts[exp.payment_mode] || 0) + 1;
        totalPayments++;
      }
    }
    let topMode = 'None';
    let maxCount = 0;
    for (const mode in counts) {
      if (counts[mode] > maxCount) {
        maxCount = counts[mode];
        topMode = mode;
      }
    }

    return {
      currentTotal: curr,
      categoryTotals: catTotals,
      earliestExpenseDate,
      topMode,
      totalPayments,
      currentInterval,
    };
  }

  const sampleCategories = [
    { id: 'cat-food', name: 'Food & Drinks' },
    { id: 'cat-shop', name: 'Shopping' },
    { id: 'cat-transport', name: 'Transport' },
  ];

  it('aggregates newly added expense for a new user regardless of UTC account created_at skew', () => {
    const localNow = new Date('2026-09-30T20:30:00');
    const expenses = [
      {
        amount: 350,
        expense_date: '2026-09-30',
        category_id: 'cat-food',
        payment_mode: 'upi' as const,
        type: 'expense',
      },
    ];

    const weekly = computeInsightsData(expenses, sampleCategories, 'Weekly', localNow);
    const monthly = computeInsightsData(expenses, sampleCategories, 'Monthly', localNow);
    const yearly = computeInsightsData(expenses, sampleCategories, 'Yearly', localNow);

    expect(weekly.currentTotal).toBe(350);
    expect(weekly.categoryTotals['cat-food']).toBe(350);
    expect(weekly.topMode).toBe('upi');

    expect(monthly.currentTotal).toBe(350);
    expect(yearly.currentTotal).toBe(350);
    expect(weekly.earliestExpenseDate).not.toBeNull();
  });

  it('aggregates backdated expenses entered by a new user for yesterday and earlier this week', () => {
    const localNow = new Date('2026-09-30T14:00:00');
    const expenses = [
      {
        amount: 200,
        expense_date: '2026-09-28',
        category_id: 'cat-food',
        payment_mode: 'cash' as const,
        type: 'expense',
      },
      {
        amount: 500,
        expense_date: '2026-09-29',
        category_id: 'cat-shop',
        payment_mode: 'upi' as const,
        type: 'expense',
      },
      {
        amount: 150,
        expense_date: '2026-09-30',
        category_id: 'cat-transport',
        payment_mode: 'upi' as const,
        type: 'expense',
      },
    ];

    const weekly = computeInsightsData(expenses, sampleCategories, 'Weekly', localNow);
    expect(weekly.currentTotal).toBe(850);
    expect(weekly.categoryTotals['cat-food']).toBe(200);
    expect(weekly.categoryTotals['cat-shop']).toBe(500);
    expect(weekly.categoryTotals['cat-transport']).toBe(150);
    expect(weekly.topMode).toBe('upi');
    expect(format(weekly.earliestExpenseDate!, 'yyyy-MM-dd')).toBe('2026-09-28');
  });

  it('filters out income transactions from expense totals in Insights', () => {
    const localNow = new Date('2026-09-30T14:00:00');
    const expenses = [
      {
        amount: 300,
        expense_date: '2026-09-30',
        category_id: 'cat-food',
        payment_mode: 'upi' as const,
        type: 'expense',
      },
      {
        amount: 50000,
        expense_date: '2026-09-30',
        category_id: null,
        payment_mode: 'upi' as const,
        type: 'income',
      },
    ];

    const weekly = computeInsightsData(expenses, sampleCategories, 'Weekly', localNow);
    expect(weekly.currentTotal).toBe(300);
    expect(weekly.categoryTotals['cat-food']).toBe(300);
  });

  it('mid-month signup: month remains 1st to 30th/31st while data starts showing for weekly, monthly, and yearly', () => {
    // User signs up mid-month on 15 September 2026 (Wednesday) in Indian timezone
    const midMonthNow = new Date('2026-09-15T16:00:00+05:30');

    // User immediately spends money on 15 Sep (₹800), and another on 18 Sep (₹1200)
    const expenses = [
      {
        amount: 800,
        expense_date: '2026-09-15',
        category_id: 'cat-food',
        payment_mode: 'upi' as const,
        type: 'expense',
      },
      {
        amount: 1200,
        expense_date: '2026-09-18',
        category_id: 'cat-shop',
        payment_mode: 'upi' as const,
        type: 'expense',
      },
    ];

    // Weekly: Week starts on Monday (14 Sep 2026) and ends on Sunday (20 Sep 2026)
    const weekly = computeInsightsData(expenses, sampleCategories, 'Weekly', midMonthNow);
    expect(format(weekly.currentInterval.start, 'yyyy-MM-dd')).toBe('2026-09-14'); // Monday
    expect(format(weekly.currentInterval.end, 'yyyy-MM-dd')).toBe('2026-09-20');   // Sunday
    expect(weekly.currentTotal).toBe(2000); // 800 + 1200 both in this week

    // Monthly: Month starts on 1st (1 Sep 2026) and ends on 30th (30 Sep 2026)
    const monthly = computeInsightsData(expenses, sampleCategories, 'Monthly', midMonthNow);
    expect(format(monthly.currentInterval.start, 'yyyy-MM-dd')).toBe('2026-09-01'); // 1st
    expect(format(monthly.currentInterval.end, 'yyyy-MM-dd')).toBe('2026-09-30');   // 30th
    expect(monthly.currentTotal).toBe(2000);

    // Yearly: Year starts on 1 Jan and ends on 31 Dec
    const yearly = computeInsightsData(expenses, sampleCategories, 'Yearly', midMonthNow);
    expect(format(yearly.currentInterval.start, 'yyyy-MM-dd')).toBe('2026-01-01');
    expect(format(yearly.currentInterval.end, 'yyyy-MM-dd')).toBe('2026-12-31');
    expect(yearly.currentTotal).toBe(2000);

    // Cash flow chart: Month starts 1st (W1: 1-7, W2: 8-14, W3: 15-21, W4: 22-30)
    const cashFlow = computeMonthlyCashFlowData(
      monthly.currentInterval.start,
      monthly.currentInterval.end,
      expenses,
      [],
      (exp) => exp.type === 'income'
    );
    expect(cashFlow.weeks).toHaveLength(4);
    expect(cashFlow.weeks[0].subLabel).toBe('1–7');
    expect(cashFlow.weeks[0].spent).toBe(0); // Before user joined
    expect(cashFlow.weeks[1].subLabel).toBe('8–14');
    expect(cashFlow.weeks[1].spent).toBe(0); // Before user joined
    expect(cashFlow.weeks[2].subLabel).toBe('15–21');
    expect(cashFlow.weeks[2].spent).toBe(2000); // 15 Sep + 18 Sep
    expect(cashFlow.weeks[3].subLabel).toBe('22–30');
    expect(cashFlow.weeks[3].spent).toBe(0);
    expect(cashFlow.totalSpent).toBe(2000);
  });

  describe('Indian Timezone Month & Week Boundaries', () => {
    it('handles week starting on Monday and ending on Sunday', () => {
      // Wednesday 16 Sep 2026
      const ref = new Date('2026-09-16T12:00:00+05:30');
      const start = startOfWeek(ref, { weekStartsOn: 1 });
      const end = endOfWeek(ref, { weekStartsOn: 1 });

      expect(format(start, 'EEEE yyyy-MM-dd')).toBe('Monday 2026-09-14');
      expect(format(end, 'EEEE yyyy-MM-dd')).toBe('Sunday 2026-09-20');
    });

    it('handles 30-day month (September: 1 to 30)', () => {
      const sep = new Date('2026-09-15T12:00:00+05:30');
      expect(format(startOfMonth(sep), 'yyyy-MM-dd')).toBe('2026-09-01');
      expect(format(endOfMonth(sep), 'yyyy-MM-dd')).toBe('2026-09-30');
    });

    it('handles 31-day month (October: 1 to 31)', () => {
      const oct = new Date('2026-10-10T12:00:00+05:30');
      expect(format(startOfMonth(oct), 'yyyy-MM-dd')).toBe('2026-10-01');
      expect(format(endOfMonth(oct), 'yyyy-MM-dd')).toBe('2026-10-31');
    });

    it('handles leap year February (2024: 1 to 29)', () => {
      const leapFeb = new Date('2024-02-15T12:00:00+05:30');
      expect(format(startOfMonth(leapFeb), 'yyyy-MM-dd')).toBe('2024-02-01');
      expect(format(endOfMonth(leapFeb), 'yyyy-MM-dd')).toBe('2024-02-29');

      const cashFlow = computeMonthlyCashFlowData(
        startOfMonth(leapFeb),
        endOfMonth(leapFeb),
        [{ amount: 500, expense_date: '2024-02-29', type: 'expense' }],
        []
      );
      expect(cashFlow.weeks[3].subLabel).toBe('22–29');
      expect(cashFlow.weeks[3].spent).toBe(500);
    });

    it('handles standard non-leap February (2026: 1 to 28)', () => {
      const stdFeb = new Date('2026-02-15T12:00:00+05:30');
      expect(format(startOfMonth(stdFeb), 'yyyy-MM-dd')).toBe('2026-02-01');
      expect(format(endOfMonth(stdFeb), 'yyyy-MM-dd')).toBe('2026-02-28');

      const cashFlow = computeMonthlyCashFlowData(
        startOfMonth(stdFeb),
        endOfMonth(stdFeb),
        [{ amount: 300, expense_date: '2026-02-28', type: 'expense' }],
        []
      );
      expect(cashFlow.weeks[3].subLabel).toBe('22–28');
      expect(cashFlow.weeks[3].spent).toBe(300);
    });
  });
});
