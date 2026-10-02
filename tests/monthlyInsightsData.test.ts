import { describe, it, expect } from 'vitest';
import { parseISO, startOfMonth, endOfMonth } from 'date-fns';
import {
  computeMonthlySpend,
  computeEffectiveMonthBudget,
  computeMonthlyBudgetHealth,
  computeMonthlySafeDailyPace,
  computeMonthlyGullakSavings,
  computeMonthlyComparison,
  computeMonthlyLargestOutflow,
  computeMonthlyCategoryShift,
  computeMonthlyPeakWeek,
  computeSmartMonthlyTakeaway,
  ExpenseLike,
} from '../src/lib/monthlyInsightsUtils';
import type { Category } from '../src/store/categoryStore';
import type { DailyRecord, GullakDeposit } from '../src/store/dailyBudgetStore';

describe('Monthly Insights Pure Analytics & Engine', () => {
  const mockCategories: Category[] = [
    { id: 'cat-food', name: 'Food & Dining', color: '#F07167', icon: 'Utensils', user_id: 'test-user', is_default: false },
    { id: 'cat-grocery', name: 'Groceries', color: '#00AFB9', icon: 'ShoppingBag', user_id: 'test-user', is_default: false },
    { id: 'cat-rent', name: 'Rent & Bills', color: '#F4A261', icon: 'Home', user_id: 'test-user', is_default: false },
    { id: 'cat-income', name: 'Salary', color: '#10B981', icon: 'Wallet', user_id: 'test-user', is_default: false },
  ];

  const oct2026Start = parseISO('2026-10-01');
  const oct2026End = parseISO('2026-10-31');
  const octInterval = { start: oct2026Start, end: oct2026End };

  const sep2026Start = parseISO('2026-09-01');
  const sep2026End = parseISO('2026-09-30');
  const sepInterval = { start: sep2026Start, end: sep2026End };

  describe('Ticket 1: Core Monthly Spend & Effective Budget Derivation', () => {
    it('calculates total monthly spend excluding income transactions and outside dates', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 1500, expense_date: '2026-10-02', category_id: 'cat-food' },
        { id: '2', amount: 3500, expense_date: '2026-10-15', category_id: 'cat-grocery' },
        { id: '3', amount: 50000, expense_date: '2026-10-01', category_id: 'cat-income' }, // Income
        { id: '4', amount: 800, expense_date: '2026-09-30', category_id: 'cat-food' }, // September (outside)
      ];

      const spend = computeMonthlySpend(expenses, mockCategories, octInterval);
      expect(spend).toBe(5000);
    });

    it('derives correct monthly budget for daily cadence in 31, 30, and 28-day months', () => {
      // 31 days (October)
      const octBudget = computeEffectiveMonthBudget('daily', 500, 3500, 15000, '2026-01-01', octInterval);
      expect(octBudget.totalDays).toBe(31);
      expect(octBudget.activeDays).toBe(31);
      expect(octBudget.effectiveBudget).toBe(15500); // 500 * 31

      // 30 days (September)
      const sepBudget = computeEffectiveMonthBudget('daily', 500, 3500, 15000, '2026-01-01', sepInterval);
      expect(sepBudget.totalDays).toBe(30);
      expect(sepBudget.activeDays).toBe(30);
      expect(sepBudget.effectiveBudget).toBe(15000); // 500 * 30

      // 28 days (February 2026)
      const febInterval = { start: parseISO('2026-02-01'), end: parseISO('2026-02-28') };
      const febBudget = computeEffectiveMonthBudget('daily', 500, 3500, 15000, '2026-01-01', febInterval);
      expect(febBudget.totalDays).toBe(28);
      expect(febBudget.activeDays).toBe(28);
      expect(febBudget.effectiveBudget).toBe(14000); // 500 * 28
    });

    it('prorates monthly budget when user registered mid-month', () => {
      // Registered on Oct 16 in a 31-day month -> 16 active days (16..31)
      const prorated = computeEffectiveMonthBudget('monthly', 500, 3500, 31000, '2026-10-16', octInterval);
      expect(prorated.isPartialFirstMonth).toBe(true);
      expect(prorated.activeDays).toBe(16);
      expect(prorated.effectiveBudget).toBe(16000); // (31000 / 31) * 16
    });

    it('evaluates budget health and safe daily pace accurately', () => {
      const health = computeMonthlyBudgetHealth(20000, 14000);
      expect(health.remaining).toBe(6000);
      expect(health.isOverBudget).toBe(false);
      expect(health.ratio).toBe(0.7);

      // On day 15 of 31 days -> 16 days left
      const safePace = computeMonthlySafeDailyPace(6000, 15, 31);
      expect(safePace).toBe(375); // 6000 / 16

      // Over budget test
      const overHealth = computeMonthlyBudgetHealth(20000, 22500);
      expect(overHealth.isOverBudget).toBe(true);
      expect(overHealth.overAmount).toBe(2500);
      expect(computeMonthlySafeDailyPace(overHealth.remaining, 20, 31)).toBe(0);
    });

    it('aggregates Gullak savings with strict deduplication of auto-rollovers', () => {
      const dailyRecords: Record<string, DailyRecord> = {
        '2026-10-01': { date: '2026-10-01', budget: 500, spent: 300, saved: 200, status: 'saved', isFinalized: true },
        '2026-10-02': { date: '2026-10-02', budget: 500, spent: 250, saved: 250, status: 'saved', isFinalized: true },
        '2026-10-03': { date: '2026-10-03', budget: 500, spent: 600, saved: 0, status: 'exceeded', isFinalized: true },
      };

      const gullakDeposits: GullakDeposit[] = [
        { id: 'd1', amount: 500, date: '2026-10-02', source: 'external', created_at: '2026-10-02' },
        { id: 'd2', amount: 300, date: '2026-10-15', source: 'income', created_at: '2026-10-15' },
        { id: 'd3', amount: 200, date: '2026-11-01', source: 'external', created_at: '2026-11-01' }, // Outside month
      ];

      const gullak = computeMonthlyGullakSavings(dailyRecords, gullakDeposits, octInterval);
      expect(gullak.autoSaved).toBe(450); // 200 + 250
      expect(gullak.savedDaysCount).toBe(2);
      expect(gullak.manualDeposits).toBe(800); // d1 + d2 (500 + 300)
      expect(gullak.totalSaved).toBe(1250); // 450 + 800
    });
  });

  describe('Ticket 3: Fair Day-Matched Month-to-Date (MTD) Comparisons', () => {
    const expenses: ExpenseLike[] = [
      // September (previous month)
      { id: 'p1', amount: 1000, expense_date: '2026-09-02', category_id: 'cat-food' },
      { id: 'p2', amount: 2000, expense_date: '2026-09-08', category_id: 'cat-food' },
      { id: 'p3', amount: 5000, expense_date: '2026-09-25', category_id: 'cat-food' }, // Day 25
      // October (current month)
      { id: 'c1', amount: 1200, expense_date: '2026-10-03', category_id: 'cat-food' },
      { id: 'c2', amount: 1800, expense_date: '2026-10-09', category_id: 'cat-food' },
    ];

    it('matches day 1..10 in current month with day 1..10 in previous month for in-progress month (offset=0)', () => {
      const today = parseISO('2026-10-10'); // Day 10
      const comp = computeMonthlyComparison(expenses, mockCategories, octInterval, sepInterval, 0, today);

      // Current spend up to Oct 10: 1200 + 1800 = 3000
      expect(comp.currentTotal).toBe(3000);
      // Matched previous spend up to Sept 10: 1000 + 2000 = 3000 (excludes Sept 25!)
      expect(comp.matchedPrevTotal).toBe(3000);
      expect(comp.percentageChange).toBe(0);
      expect(comp.trendLabel).toBe('0% vs same days prev month');
    });

    it('caps day 31 in current month to 30 days of previous month without error', () => {
      const today = parseISO('2026-10-31'); // Day 31
      const comp = computeMonthlyComparison(expenses, mockCategories, octInterval, sepInterval, 0, today);

      expect(comp.currentTotal).toBe(3000);
      // Sept only has 30 days, so matches up to Sept 30 (includes Sept 25 = 8000)
      expect(comp.matchedPrevTotal).toBe(8000);
      expect(comp.percentageChange).toBe(63); // (8000 - 3000) / 8000 = 62.5% -> 63%
      expect(comp.isIncrease).toBe(false);
      expect(comp.trendLabel).toBe('63% vs same days prev month');
    });

    it('handles zero previous spend safely without NaN or Infinity', () => {
      const today = parseISO('2026-10-10');
      // No expenses in September
      const octOnlyExpenses = expenses.filter((e) => e.expense_date.startsWith('2026-10'));
      const comp = computeMonthlyComparison(octOnlyExpenses, mockCategories, octInterval, sepInterval, 0, today);

      expect(comp.percentageChange).toBeNull();
      expect(comp.trendLabel).toBe('No spend in prev month');
    });

    it('shows +₹spend vs same days when matched days had ₹0 but full previous month had spend', () => {
      // User scenario: Sept had ₹5,000 spend on Sept 25, but Day 1..2 had ₹0.
      // In October on Day 2, user spent ₹260.
      const septLaterExpenses: ExpenseLike[] = [
        { id: 'p3', amount: 5000, expense_date: '2026-09-25', category_id: 'cat-food' },
        { id: 'c1', amount: 260, expense_date: '2026-10-02', category_id: 'cat-food' },
      ];
      const today = parseISO('2026-10-02'); // Day 2
      const comp = computeMonthlyComparison(septLaterExpenses, mockCategories, octInterval, sepInterval, 0, today);

      expect(comp.currentTotal).toBe(260);
      expect(comp.matchedPrevTotal).toBe(0);
      expect(comp.percentageChange).toBeNull();
      expect(comp.trendLabel).toBe('+₹260 vs same days prev month');
    });
  });

  describe('Ticket 2: Insight Engine (Largest Outflow, Category Shift & Peak Week)', () => {
    it('detects largest single outflow and sets pill threshold at >= 15%', () => {
      const expenses: ExpenseLike[] = [
        { id: '1', amount: 500, expense_date: '2026-10-02', category_id: 'cat-food', notes: 'Dinner' },
        { id: '2', amount: 8000, expense_date: '2026-10-05', category_id: 'cat-rent', notes: 'House Rent' },
        { id: '3', amount: 1500, expense_date: '2026-10-12', category_id: 'cat-grocery', notes: 'Weekly haul' },
      ];
      const total = 10000;

      const outflow = computeMonthlyLargestOutflow(expenses, mockCategories, octInterval, total);
      expect(outflow).not.toBeNull();
      expect(outflow?.expense.amount).toBe(8000);
      expect(outflow?.categoryName).toBe('Rent & Bills');
      expect(outflow?.outflowPercent).toBe(80); // 8000 / 10000
      expect(outflow?.shouldShowPill).toBe(true);
    });

    it('filters out largest outflow if amount < 200 or single transaction', () => {
      const tinyExpenses: ExpenseLike[] = [
        { id: '1', amount: 50, expense_date: '2026-10-02', category_id: 'cat-food' },
        { id: '2', amount: 80, expense_date: '2026-10-05', category_id: 'cat-food' },
      ];
      expect(computeMonthlyLargestOutflow(tinyExpenses, mockCategories, octInterval, 130)).toBeNull();

      const singleTxn: ExpenseLike[] = [
        { id: '1', amount: 5000, expense_date: '2026-10-02', category_id: 'cat-food' },
      ];
      expect(computeMonthlyLargestOutflow(singleTxn, mockCategories, octInterval, 5000)).toBeNull();
    });

    it('identifies biggest category shift (climber/reducer) with |delta| >= 300', () => {
      const expenses: ExpenseLike[] = [
        // September: Food was 2000, Grocery was 5000
        { id: 's1', amount: 2000, expense_date: '2026-09-05', category_id: 'cat-food' },
        { id: 's2', amount: 5000, expense_date: '2026-09-10', category_id: 'cat-grocery' },
        // October: Food is 4500 (+2500), Grocery is 4800 (-200)
        { id: 'o1', amount: 4500, expense_date: '2026-10-05', category_id: 'cat-food' },
        { id: 'o2', amount: 4800, expense_date: '2026-10-10', category_id: 'cat-grocery' },
      ];

      const shift = computeMonthlyCategoryShift(
        expenses,
        mockCategories,
        octInterval,
        sepInterval,
        -1, // past full month
        new Date(),
        9300
      );

      expect(shift).not.toBeNull();
      expect(shift?.mode).toBe('category_shift');
      if (shift?.mode === 'category_shift') {
        expect(shift.categoryId).toBe('cat-food');
        expect(shift.delta).toBe(2500); // 4500 - 2000
        expect(shift.isIncrease).toBe(true);
        expect(shift.shiftPercent).toBe(125); // (2500 / 2000) * 100
      }
    });

    it('falls back to primary_driver when no previous month data exists', () => {
      const expenses: ExpenseLike[] = [
        { id: 'o1', amount: 4500, expense_date: '2026-10-05', category_id: 'cat-food' },
        { id: 'o2', amount: 1500, expense_date: '2026-10-10', category_id: 'cat-grocery' },
      ];

      const shift = computeMonthlyCategoryShift(
        expenses,
        mockCategories,
        octInterval,
        sepInterval,
        0,
        parseISO('2026-10-15'),
        6000
      );

      expect(shift).not.toBeNull();
      expect(shift?.mode).toBe('primary_driver');
      if (shift?.mode === 'primary_driver') {
        expect(shift.categoryId).toBe('cat-food');
        expect(shift.percentageOfTotal).toBe(75); // 4500 / 6000
      }
    });

    it('computes peak outflow week and handles single week in progress', () => {
      const weeks = [
        { day: 'W1', subLabel: '1–7', income: 10000, spent: 12000 },
        { day: 'W2', subLabel: '8–14', income: 0, spent: 4000 },
        { day: 'W3', subLabel: '15–21', income: 0, spent: 3000 },
        { day: 'W4', subLabel: '22–31', income: 0, spent: 1000 },
      ];
      const peak = computeMonthlyPeakWeek(weeks, 20000);
      expect(peak.status).toBe('peak');
      expect(peak.peakWeek).toBe('W1');
      expect(peak.share).toBe(60); // 12000 / 20000
      expect(peak.text).toBe('W1 had highest outflow (60% of month)');

      // Single active week in progress
      const earlyWeeks = [
        { day: 'W1', subLabel: '1–7', income: 5000, spent: 3500 },
        { day: 'W2', subLabel: '8–14', income: 0, spent: 0 },
        { day: 'W3', subLabel: '15–21', income: 0, spent: 0 },
        { day: 'W4', subLabel: '22–31', income: 0, spent: 0 },
      ];
      const earlyPeak = computeMonthlyPeakWeek(earlyWeeks, 3500);
      expect(earlyPeak.status).toBe('in_progress');
      expect(earlyPeak.text).toContain('W1 in progress');
    });
  });

  describe('Ticket 5: Smart Monthly Takeaway Narrative Engine', () => {
    it('returns zero spend message when current total is 0', () => {
      const takeaway = computeSmartMonthlyTakeaway({
        currentTotal: 0,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        remainingBudget: 15500,
        savedDaysCount: 0,
        totalMonthSavings: 0,
        topCategory: null,
        isCurrentMonth: true,
        safeDailyPace: 0,
        remainingDays: 20,
        transactionCount: 0,
        monthlyDailyBurnPace: 0,
      });
      expect(takeaway.status).toBe('neutral');
      expect(takeaway.text).toBe('No expenses logged this month.');
    });

    it('returns over-budget coral status with formatted over amount', () => {
      const takeaway = computeSmartMonthlyTakeaway({
        currentTotal: 12000,
        isBudgetMode: true,
        isOverBudget: true,
        overAmount: 2000,
        remainingBudget: 0,
        savedDaysCount: 2,
        totalMonthSavings: 400,
        topCategory: null,
        isCurrentMonth: true,
        safeDailyPace: 0,
        remainingDays: 10,
        transactionCount: 15,
        monthlyDailyBurnPace: 600,
      });
      expect(takeaway.status).toBe('coral');
      expect(takeaway.text).toContain('exceeded budget by ₹2,000');
    });

    it('formats safe daily pace with correct singular and plural grammar for remaining days', () => {
      // Plural days
      const takeawayPlural = computeSmartMonthlyTakeaway({
        currentTotal: 3000,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        remainingBudget: 3500,
        savedDaysCount: 2,
        totalMonthSavings: 300,
        topCategory: null,
        isCurrentMonth: true,
        safeDailyPace: 250,
        remainingDays: 14,
        transactionCount: 8,
        monthlyDailyBurnPace: 300,
      });
      expect(takeawayPlural.status).toBe('mint');
      expect(takeawayPlural.text).toContain('₹250/day safe pace with 14 days remaining.');

      // Singular day
      const takeawaySingular = computeSmartMonthlyTakeaway({
        currentTotal: 3000,
        isBudgetMode: true,
        isOverBudget: false,
        overAmount: 0,
        remainingBudget: 250,
        savedDaysCount: 2,
        totalMonthSavings: 300,
        topCategory: null,
        isCurrentMonth: true,
        safeDailyPace: 250,
        remainingDays: 1,
        transactionCount: 8,
        monthlyDailyBurnPace: 300,
      });
      expect(takeawaySingular.status).toBe('mint');
      expect(takeawaySingular.text).toContain('₹250/day safe pace with 1 day remaining.');
    });
  });
});

