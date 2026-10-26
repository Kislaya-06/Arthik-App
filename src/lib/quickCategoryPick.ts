/**
 * Pure part of the quick-categories feature (no stores, no storage), so it can be unit-tested on its own.
 * See quickCategories.ts for what the feature is.
 */

export interface QuickCategory {
  id: string;
  name: string;
}

/** Android shows at most 3 action buttons on a notification. */
export const QUICK_CATEGORY_LIMIT = 3;

interface ExpenseLike {
  category_id?: string | null;
  type?: string | null;
  transaction_class?: string | null;
  expense_date?: string | null;
}
interface CategoryLike {
  id: string;
  name: string;
  kind?: string | null;
  isPlaceholder?: boolean;
}

/**
 * Most-used first (count of normal expenses per category, newest use breaks ties).
 * When the user has fewer than `limit` used categories, the rest are filled from their category list order.
 * Income categories, placeholders and transfers / money-back rows are never used.
 */
export const pickQuickCategories = (
  expenses: readonly ExpenseLike[],
  categories: readonly CategoryLike[],
  limit: number = QUICK_CATEGORY_LIMIT
): QuickCategory[] => {
  const usable = new Map<string, CategoryLike>();
  for (const c of categories) {
    if (!c.id || !c.name || c.isPlaceholder) continue;
    if (c.kind === 'income') continue;
    usable.set(c.id, c);
  }

  const stats = new Map<string, { count: number; last: string }>();
  for (const e of expenses) {
    if (e.type === 'income') continue;
    if (e.transaction_class && e.transaction_class !== 'normal') continue;
    const id = e.category_id;
    if (!id || !usable.has(id)) continue;
    const prev = stats.get(id);
    const date = e.expense_date || '';
    if (!prev) stats.set(id, { count: 1, last: date });
    else {
      prev.count += 1;
      if (date > prev.last) prev.last = date;
    }
  }

  const ranked = Array.from(stats.entries())
    .sort((a, b) => b[1].count - a[1].count || (a[1].last < b[1].last ? 1 : a[1].last > b[1].last ? -1 : 0))
    .map(([id]) => id);

  const picked: string[] = ranked.slice(0, limit);
  if (picked.length < limit) {
    for (const c of usable.values()) {
      if (picked.length >= limit) break;
      if (!picked.includes(c.id)) picked.push(c.id);
    }
  }
  return picked.map((id) => ({ id, name: (usable.get(id) as CategoryLike).name }));
};
