/**
 * Overspend funding: when spending goes past the budget, WHO paid the extra? Income first, then Gullak (WAT-001).
 *
 * The answer comes from the money waterfall (src/lib/moneyWaterfall.ts) and from nowhere else. The "limit exceeded"
 * notifications used to guess it with their own formula (income left today vs the overspend). That guess went wrong
 * once income was already used up, and it could disagree with the Home card.
 */
import { summarizeScope, WaterfallResult } from '../lib/moneyWaterfall';
import { DateKey, isDateKeyWithin } from './dateKeys';

export interface OverspendFunding {
  /** Part of the overspend that was paid from income. */
  coveredByIncome: number;
  /** Part of the overspend that was drawn from Gullak. */
  coveredByGullak: number;
}

/** What income and Gullak really paid for overspending on the days from startDateKey to endDateKey (both included). */
export function overspendFundingBetweenDates(
  waterfall: WaterfallResult,
  startDateKey: DateKey,
  endDateKey: DateKey
): OverspendFunding {
  const scope = summarizeScope(waterfall, (dateKey) => isDateKeyWithin(dateKey, startDateKey, endDateKey));
  return { coveredByIncome: scope.incomeUsed, coveredByGullak: scope.gullakDrawn };
}
