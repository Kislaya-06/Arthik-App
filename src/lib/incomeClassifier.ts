import { isIncomeTransaction } from './transactionUtils';

export interface MinimalCategory {
  id: string;
  name?: string;
  [key: string]: any;
}

export interface MinimalExpense {
  category_id?: string | null;
  type?: 'expense' | 'income' | string;
  [key: string]: any;
}

const classifierCache = new WeakMap<readonly MinimalCategory[], (e: MinimalExpense) => boolean>();

/**
 * Creates an income classifier predicate function `(e: MinimalExpense) => boolean`.
 * Uses a WeakMap cache on the `categories` array reference so multiple invocations
 * with the same state slice (e.g. 20+ syncWithExpenses calls) reuse the existing Map & predicate.
 */
export function makeIncomeClassifier<T extends MinimalCategory = MinimalCategory>(
  categories?: readonly T[] | null
): (e: MinimalExpense) => boolean {
  if (!categories || categories.length === 0) {
    return (e: MinimalExpense) => isIncomeTransaction(e, undefined);
  }

  const cached = classifierCache.get(categories);
  if (cached) {
    return cached;
  }

  const categoryMap = new Map<string, T>();
  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    if (cat && cat.id) {
      categoryMap.set(cat.id, cat);
    }
  }

  const classifier = (e: MinimalExpense): boolean => {
    const cat = e.category_id ? categoryMap.get(e.category_id) : undefined;
    return isIncomeTransaction(e, cat);
  };

  try {
    classifierCache.set(categories, classifier);
  } catch {
    // If categories cannot be a WeakMap key, ignore
  }

  return classifier;
}
