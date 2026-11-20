import { formatCompactCurrency, formatCurrency, round2 } from '../formatters';

export interface DualRingState {
  outerProgress: number;     // 0 to 1
  innerProgress: number;     // 0 to 1
  outerColor: string;        // Mint inflow (#10B981)
  innerColor: string;        // Coral outflow (#E05A47) or Red (#EF4444) when spent > income
  centerPrimary: string;     // Top text in center hole (e.g. "45%", "125%", "999%+", "₹500", "₹0")
  centerSecondary?: string;  // Bottom label in center hole (e.g. "spent" or undefined for "₹0")
  centerText: string;        // Full combined string (e.g. "45% spent", "₹0", "₹500 spent")
  percentage: number | null; // e.g. 45, 125, null when income is 0
  isOverIncome: boolean;     // true when spent > income (or spent > 0 when income = 0)
  accessibilityLabel: string;
}

/**
 * Computes the concentric dual-ring visualization state strictly adhering to Table D9:
 * 
 * | Income | Spent | Outer (green) | Inner | Center text |
 * |---|---|---|---|---|
 * | 0 | 0 | faint track (0) | faint track (0) | `₹0` |
 * | 0 | >0 | faint track (0) | 100% coral (1.0) | `₹X spent` (no %, divide-by-zero) |
 * | >0 | ≤ income | 100% (1.0) | spent/income % coral | `45% spent` |
 * | >0 | > income | 100% (1.0) | 100% red (#EF4444) | `125% spent`, cap `999%+` |
 */
export function computeDualRingState(
  income: number,
  spent: number
): DualRingState {
  const safeIncome = Math.max(0, Number(income) || 0);
  const safeSpent = Math.max(0, Number(spent) || 0);

  const MINT_COLOR = '#10B981';
  const CORAL_COLOR = '#E05A47';
  const RED_COLOR = '#EF4444';

  // D9 Row 1: 0 Income, 0 Spent
  if (safeIncome === 0 && safeSpent === 0) {
    return {
      outerProgress: 0,
      innerProgress: 0,
      outerColor: MINT_COLOR,
      innerColor: CORAL_COLOR,
      centerPrimary: '₹0',
      centerSecondary: undefined,
      centerText: '₹0',
      percentage: null,
      isOverIncome: false,
      accessibilityLabel: 'No income and no expenses. ₹0.',
    };
  }

  // D9 Row 2: 0 Income, >0 Spent (No %, divide-by-zero)
  if (safeIncome === 0 && safeSpent > 0) {
    const compactSpent = formatCompactCurrency(safeSpent);
    return {
      outerProgress: 0,
      innerProgress: 1,
      outerColor: MINT_COLOR,
      innerColor: CORAL_COLOR,
      centerPrimary: compactSpent,
      centerSecondary: 'spent',
      centerText: `${compactSpent} spent`,
      percentage: null,
      isOverIncome: true,
      accessibilityLabel: `Income ₹0, spent ${formatCurrency(safeSpent)}.`,
    };
  }

  // safeIncome > 0
  const isOver = safeSpent > safeIncome;
  const ratio = safeSpent / safeIncome;
  const rawPercentage = Math.round(ratio * 100);

  // D9 Row 4: >0 Income, > income Spent
  if (isOver) {
    const isCapped = rawPercentage > 999;
    const pctStr = isCapped ? '999%+' : `${rawPercentage}%`;
    return {
      outerProgress: 1,
      innerProgress: 1,
      outerColor: MINT_COLOR,
      innerColor: RED_COLOR,
      centerPrimary: pctStr,
      centerSecondary: 'spent',
      centerText: `${pctStr} spent`,
      percentage: rawPercentage,
      isOverIncome: true,
      accessibilityLabel: `Inflow ${formatCurrency(safeIncome)}, outflow ${formatCurrency(safeSpent)}, ${pctStr} spent. Over income.`,
    };
  }

  // D9 Row 3: >0 Income, ≤ income Spent
  const innerProgress = round2(Math.min(1, Math.max(0, ratio)));
  return {
    outerProgress: 1,
    innerProgress,
    outerColor: MINT_COLOR,
    innerColor: CORAL_COLOR,
    centerPrimary: `${rawPercentage}%`,
    centerSecondary: 'spent',
    centerText: `${rawPercentage}% spent`,
    percentage: rawPercentage,
    isOverIncome: false,
    accessibilityLabel: `Inflow ${formatCurrency(safeIncome)}, outflow ${formatCurrency(safeSpent)}, ${rawPercentage}% spent.`,
  };
}
