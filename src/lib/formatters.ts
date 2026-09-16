import { format, isToday, isYesterday, parseISO } from 'date-fns';

/**
 * Formats a number as Indian Rupee currency string.
 * Preserves decimals if present (up to 2 decimal places), otherwise formats as whole number.
 * e.g. 52000.75 → "₹52,000.75", 52000 → "₹52,000"
 */
export const formatCurrency = (n: number): string => {
  const val = Number(n) || 0;
  const isNeg = val < 0;
  const absVal = Math.abs(val);
  const formatted = absVal.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  return (isNeg ? '-₹' : '₹') + formatted;
};

/**
 * Formats a date for display with optional relative labels.
 * showRelative = true → "Today, 15 Jul" | "Yesterday, 14 Jul"
 * otherwise → "15 Jul, 2025"
 */
export const formatDate = (
  date: Date | string,
  showRelative = false,
): string => {
  const d = typeof date === 'string' ? parseISO(date) : date;
  if (showRelative) {
    if (isToday(d)) return `Today, ${format(d, 'd MMM')}`;
    if (isYesterday(d)) return `Yesterday, ${format(d, 'd MMM')}`;
  }
  return format(d, 'd MMM, yyyy');
};

/**
 * Formats a raw number string with Indian commas while preserving decimals in progress.
 * e.g. "1000" → "1,000", "100000" → "1,00,000", "1000.5" → "1,000.5", "1000." → "1,000."
 */
export const formatAmountWithCommas = (rawStr: string): string => {
  if (!rawStr) return '';
  const clean = rawStr.replace(/[^0-9.]/g, '');
  if (!clean) return '';

  const dotIndex = clean.indexOf('.');
  let integerPart = dotIndex >= 0 ? clean.slice(0, dotIndex) : clean;
  const decimalPart = dotIndex >= 0 ? clean.slice(dotIndex) : '';

  // Remove leading zeros unless it's just "0" or "0."
  if (integerPart.length > 1 && integerPart.startsWith('0')) {
    integerPart = integerPart.replace(/^0+/, '') || '0';
  }

  if (!integerPart && decimalPart) {
    return '0' + decimalPart;
  }

  if (!integerPart) {
    return '';
  }

  const lastThree = integerPart.slice(-3);
  const otherNumbers = integerPart.slice(0, -3);

  const formattedInt =
    otherNumbers !== ''
      ? otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' + lastThree
      : lastThree;

  return formattedInt + decimalPart;
};

/**
 * Strips commas from a formatted amount string to get the pure numeric string.
 * e.g. "1,00,000.50" → "100000.50"
 */
export const cleanAmountString = (val: string): string => {
  return val.replace(/,/g, '');
};

