/**
 * "Your <year> in Arthik": the slides of the year story (Yearly tab). Pure: it only arranges numbers the other
 * Insights helpers already compute. A slide with nothing to say is left out.
 */
import { DateKey, toDateKey } from '../../money/dateKeys';
import { buildLedgerEntries, spendingTotalsByDateKey } from '../../money/ledger';
import { round2 } from '../formatters';
import { classifyTransaction } from '../transactionUtils';
import { HabitRow, computeNoSpendDays, computeTopPlaces } from './habits';
import type { BestWorstMonth } from './moneyFlows';

export const YEAR_STORY_MIN_DAYS = 30;

export type YearStorySlide =
  | { kind: 'totals'; spent: number; inflow: number; entries: number }
  | { kind: 'topCategory'; categoryId: string; amount: number; share: number }
  | { kind: 'topPlace'; name: string; total: number; count: number }
  | { kind: 'noSpend'; count: number; longest: number }
  | { kind: 'bestMonth'; monthKey: DateKey; moneyLeft: number }
  | { kind: 'gullak'; added: number }
  | { kind: 'closing'; year: number };

export interface YearStoryInput {
  year: number;
  rows: readonly HabitRow[];
  todayKey: DateKey;
  userCreatedKey?: DateKey | null;
  /** The year's inflow as the Yearly tab shows it (INS-006). */
  inflow: number;
  bestWorst: BestWorstMonth | null;
  /** Money added to Gullak in the year; null in Pure Mode (GUL-002). */
  gullakAdded: number | null;
}

/** null when the year has fewer than 30 days with an entry. */
export function buildYearStory(input: YearStoryInput): YearStorySlide[] | null {
  const { year, rows, todayKey } = input;
  const range = { start: `${year}-01-01`, end: `${year}-12-31` };
  const yearRows = rows.filter((r) => toDateKey(r.expense_date).startsWith(`${year}-`));
  if (new Set(yearRows.map((r) => toDateKey(r.expense_date))).size < YEAR_STORY_MIN_DAYS) return null;

  const slides: YearStorySlide[] = [];
  const spendingRows = yearRows.filter((r) => classifyTransaction(r) === 'spending' && (Number(r.amount) || 0) > 0);
  const spent = round2(spendingRows.reduce((s, r) => s + Number(r.amount), 0));
  slides.push({ kind: 'totals', spent, inflow: round2(input.inflow), entries: yearRows.length });

  const byCategory = new Map<string, number>();
  for (const r of spendingRows) if (r.category_id) byCategory.set(r.category_id, (byCategory.get(r.category_id) || 0) + Number(r.amount));
  const top = [...byCategory].sort((a, b) => b[1] - a[1])[0];
  if (top && spent > 0) slides.push({ kind: 'topCategory', categoryId: top[0], amount: round2(top[1]), share: top[1] / spent });

  const place = computeTopPlaces(yearRows, range, 1)[0];
  if (place) slides.push({ kind: 'topPlace', ...place });

  const noSpend = computeNoSpendDays(spendingTotalsByDateKey(buildLedgerEntries(yearRows)), range, todayKey, input.userCreatedKey);
  if (noSpend && noSpend.count > 0) slides.push({ kind: 'noSpend', count: noSpend.count, longest: noSpend.longest?.length ?? 0 });

  if (input.bestWorst) slides.push({ kind: 'bestMonth', monthKey: input.bestWorst.best.monthKey, moneyLeft: input.bestWorst.best.moneyLeft });

  if (input.gullakAdded !== null && input.gullakAdded > 0) slides.push({ kind: 'gullak', added: round2(input.gullakAdded) });

  slides.push({ kind: 'closing', year });
  return slides;
}
