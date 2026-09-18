export type KeypadKey =
  | '0'
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '.'
  | 'backspace';

export interface KeypadRules {
  /** Maximum number of integer digits allowed before the decimal point (default: 9) */
  maxIntegerDigits?: number;
  /** Maximum number of decimal digits allowed after the decimal point (default: 2) */
  maxDecimals?: number;
}

export const DEFAULT_KEYPAD_RULES: Required<KeypadRules> = {
  maxIntegerDigits: 9,
  maxDecimals: 2,
};

/**
 * Applies a keypad key press to the current raw amount string using decoupled limits.
 *
 * Rules:
 * - 'backspace': drops trailing character (or stays empty if already empty)
 * - '.':
 *   - appends '.' if no decimal exists; prepends '0' if empty ('0.')
 *   - reaching the integer limit never blocks adding a decimal point (Ticket 01 fix)
 * - '0'..'9':
 *   - if current is exactly '0', replaces it with the pressed digit
 *   - if current contains '.', enforces decimal precision only (maxDecimals);
 *     having reached or exceeded the integer limit never blocks entering paise digits (Ticket 01 fix)
 *   - if current has no '.', enforces integer digit capacity only (maxIntegerDigits)
 */
export function applyKeypadPress(
  current: string,
  key: KeypadKey | string,
  rules: KeypadRules = DEFAULT_KEYPAD_RULES
): string {
  const maxIntegerDigits = rules.maxIntegerDigits ?? DEFAULT_KEYPAD_RULES.maxIntegerDigits;
  const maxDecimals = rules.maxDecimals ?? DEFAULT_KEYPAD_RULES.maxDecimals;

  if (key === 'backspace') {
    return current.slice(0, -1);
  }

  if (key === '.') {
    // Decoupled rule: reaching the integer digit limit must NEVER block typing a decimal point.
    // A user who entered the maximum integer digits (e.g. '999999999') can still type '.' to add paise.
    // This fixes Ticket 01 where string-length counting conflated integer digits and punctuation.
    return !current.includes('.') ? (current === '' ? '0.' : current + '.') : current;
  }

  // Digit keys ('0'..'9')
  if (current === '0') return key;

  if (current.includes('.')) {
    // Decimal branch: once a dot exists, the integer part is sealed.
    // Enforce decimal scale limit only.
    // Decoupled rule: having a large integer part must never eat into the paise space.
    // Fixes Ticket 01 where a total length check (length > 9) blocked entering paise
    // on large amounts like '1234567890.'.
    const [_, decimalPart = ''] = current.split('.');
    if (decimalPart.length >= maxDecimals) {
      return current;
    }
    return current + key;
  }

  // Integer branch: no dot exists yet.
  // Enforce maximum integer digits.
  if (current.length >= maxIntegerDigits) {
    return current;
  }

  return current + key;
}

/**
 * Parses raw keypad string to a numeric float amount.
 * Returns 0 if empty string, '0.', or invalid.
 */
export function parseKeypadAmount(raw: string): number {
  if (!raw) return 0;
  const parsed = parseFloat(raw);
  return Number.isNaN(parsed) ? 0 : parsed;
}
