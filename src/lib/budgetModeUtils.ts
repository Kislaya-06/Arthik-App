import { BudgetCadence } from '../types';
import { formatCurrency } from './formatters';

export type TabName = 'Home' | 'History' | 'Savings' | 'Insights';

/**
 * Returns the visible bottom tab names depending on whether Smart Budget & Gullak mode is active.
 * When OFF: 4-tab layout ['Home', 'History', 'Insights'] (plus the center Add button).
 * When ON: 5-tab layout ['Home', 'History', 'Savings', 'Insights'] (plus the center Add button).
 */
export function getVisibleTabs(isBudgetModeEnabled: boolean): TabName[] {
  if (!isBudgetModeEnabled) {
    return ['Home', 'History', 'Insights'];
  }
  return ['Home', 'History', 'Savings', 'Insights'];
}

/**
 * Route guard (D11): determines where a navigation intent intended for Savings should land.
 * - 'daily_reminder' notifications always route to 'Home'.
 * - Any navigation to 'Savings' while mode is OFF routes to 'Home'.
 * - Otherwise routes to 'Savings'.
 */
export function resolveSavingsRoute(
  isBudgetModeEnabled: boolean,
  notifType?: string
): 'Home' | 'Savings' {
  if (notifType === 'daily_reminder') {
    return 'Home';
  }
  if (!isBudgetModeEnabled) {
    return 'Home';
  }
  return 'Savings';
}

/**
 * Formats the cadence + budget subtitle for the Profile card when mode is ON.
 * e.g. "Weekly · ₹7,000" or "Daily · ₹500" or "Monthly · ₹30,000"
 */
export function formatCadenceBudgetSubtitle(
  isBudgetModeEnabled: boolean,
  cadence: BudgetCadence,
  amount: number
): string {
  if (!isBudgetModeEnabled) {
    return 'Track expenses with no limits';
  }
  const cadenceLabel = cadence.charAt(0).toUpperCase() + cadence.slice(1);
  if (!amount || amount <= 0) {
    return `${cadenceLabel} · Set budget`;
  }
  return `${cadenceLabel} · ${formatCurrency(amount)}`;
}
