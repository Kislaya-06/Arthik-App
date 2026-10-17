import { useCategoryStore } from '../categoryStore';
import {
  makeIncomeClassifier,
  makeEligibleIncomeClassifier,
} from '../../lib/incomeClassifier';
import type { Expense } from '../expense/types';

export const buildCategoryClassifier = (): ((e: Expense) => boolean) => {
  return makeIncomeClassifier(useCategoryStore.getState().categories);
};

export const buildEligibleIncomeClassifier = (): ((e: Expense) => boolean) => {
  return makeEligibleIncomeClassifier(useCategoryStore.getState().categories);
};
