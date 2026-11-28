/**
 * Which day a finished weekly / monthly budget's savings belong to (INS-002).
 * Pure functions only. No React, no stores.
 */
import { DateKey, toDateKey } from './dateKeys';

/** The day the budget ended (also when it ended early): the day its leftover went to Gullak. */
export const periodSavedDateKey = (period: { activeEnd: string }): DateKey => toDateKey(period.activeEnd);
