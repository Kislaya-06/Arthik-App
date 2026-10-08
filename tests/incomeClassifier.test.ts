import { describe, it, expect } from 'vitest';
import { makeIncomeClassifier, makeEligibleIncomeClassifier } from '../src/lib/incomeClassifier';

describe('incomeClassifier (makeIncomeClassifier)', () => {
  const categories = [
    { id: 'cat-1', name: 'Salary' },
    { id: 'cat-2', name: 'Food & Dining' },
    { id: 'cat-3', name: 'Freelance Design' },
    { id: 'cat-4', name: 'Groceries' },
  ];

  it('classifies explicit type="income" as true even if category is expense', () => {
    const isIncome = makeIncomeClassifier(categories);
    expect(isIncome({ category_id: 'cat-2', type: 'income', amount: 500 })).toBe(true);
  });

  it('classifies explicit type="expense" as false even if category is income keyword', () => {
    const isIncome = makeIncomeClassifier(categories);
    expect(isIncome({ category_id: 'cat-1', type: 'expense', amount: 500 })).toBe(false);
  });

  it('falls back to category lookup and keyword match for legacy/untyped transactions', () => {
    const isIncome = makeIncomeClassifier(categories);
    expect(isIncome({ category_id: 'cat-1', amount: 1000 })).toBe(true);
    expect(isIncome({ category_id: 'cat-3', amount: 2000 })).toBe(true);
    expect(isIncome({ category_id: 'cat-2', amount: 300 })).toBe(false);
    expect(isIncome({ category_id: 'cat-4', amount: 400 })).toBe(false);
  });

  it('handles unknown or missing category gracefully', () => {
    const isIncome = makeIncomeClassifier(categories);
    expect(isIncome({ category_id: 'cat-999', amount: 100 })).toBe(false);
    expect(isIncome({ category_id: null, amount: 100 })).toBe(false);
    expect(isIncome({ category_id: undefined, amount: 100 })).toBe(false);
    expect(isIncome({ amount: 100 })).toBe(false);
  });

  it('handles empty or null categories array gracefully', () => {
    const isIncomeEmpty = makeIncomeClassifier([]);
    expect(isIncomeEmpty({ category_id: 'cat-1', type: 'income', amount: 100 })).toBe(true);
    expect(isIncomeEmpty({ category_id: 'cat-1', type: 'expense', amount: 100 })).toBe(false);
    expect(isIncomeEmpty({ category_id: 'cat-1', amount: 100 })).toBe(false);

    const isIncomeNull = makeIncomeClassifier(null);
    expect(isIncomeNull({ category_id: 'cat-1', type: 'income', amount: 100 })).toBe(true);
    expect(isIncomeNull({ category_id: 'cat-1', amount: 100 })).toBe(false);
  });

  it('returns cached classifier when passed the exact same categories array reference', () => {
    const classifier1 = makeIncomeClassifier(categories);
    const classifier2 = makeIncomeClassifier(categories);
    expect(classifier1).toBe(classifier2);
  });

  it('creates new classifier when passed a new categories array reference', () => {
    const newCategories = [...categories, { id: 'cat-5', name: 'Dividend' }];
    const classifier1 = makeIncomeClassifier(categories);
    const classifier2 = makeIncomeClassifier(newCategories);
    expect(classifier1).not.toBe(classifier2);
    expect(classifier2({ category_id: 'cat-5', amount: 200 })).toBe(true);
  });

  describe('makeEligibleIncomeClassifier', () => {
    const categoriesWithTransfer = [
      { id: 'cat-1', name: 'Salary' },
      { id: 'cat-2', name: 'Self Transfer' },
      { id: 'cat-3', name: 'Account Transfer' },
      { id: 'cat-4', name: 'Food & Dining' },
    ];

    it('classifies salary as eligible income', () => {
      const isEligible = makeEligibleIncomeClassifier(categoriesWithTransfer);
      expect(isEligible({ category_id: 'cat-1', type: 'income', amount: 5000 })).toBe(true);
    });

    it('excludes internal transfers from eligible income', () => {
      const isEligible = makeEligibleIncomeClassifier(categoriesWithTransfer);
      expect(isEligible({ category_id: 'cat-2', type: 'income', amount: 5000 })).toBe(false);
      expect(isEligible({ category_id: 'cat-3', type: 'income', amount: 5000 })).toBe(false);
      expect(isEligible({ category_id: 'cat-4', note: 'Self transfer to SBI', amount: 5000 })).toBe(false);
    });
  });
});
