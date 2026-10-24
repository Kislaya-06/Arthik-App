import type { Expense } from '../store/expense/types';
import type { GullakDeposit } from '../store/dailyBudgetStore';

/** One transaction line of History: a normal expense/income, or a Gullak (savings jar) deposit. */
export type HistoryItem =
  | { kind: 'expense'; data: Expense; date: string; created_at: string }
  | { kind: 'gullak'; data: GullakDeposit; date: string; created_at: string };

/** One day of History with its totals and its items. */
export interface HistorySection {
  title: string;
  dateStr: string;
  totalSpent: number;
  totalIncome: number;
  data: HistoryItem[];
}

/**
 * One flat row of the History list (OPT-30). The old SectionList had sections of items;
 * FlashList wants one flat array, so every day becomes a header row followed by its item rows.
 */
export type HistoryRow =
  | { type: 'header'; key: string; section: HistorySection }
  | { type: 'expense' | 'gullak'; key: string; item: HistoryItem };

/** Flatten days into rows. Item keys are the same as the old SectionList keys. */
export function buildHistoryRows(sections: readonly HistorySection[]): HistoryRow[] {
  const out: HistoryRow[] = [];
  for (const section of sections) {
    out.push({ type: 'header', key: `header-${section.dateStr}`, section });
    for (const item of section.data) {
      out.push({ type: item.kind, key: `${item.kind}-${item.data.id}`, item });
    }
  }
  return out;
}

/** Row index of each day's header when all days are flattened (header + its items, day after day). */
export function buildHeaderRowIndexes(sections: readonly HistorySection[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const section of sections) {
    out.push(acc);
    acc += 1 + section.data.length;
  }
  return out;
}
