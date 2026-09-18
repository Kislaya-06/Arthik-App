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

/**
 * Applies a keypad key press to the current raw amount string.
 *
 * Preserves the exact behavior from ExpenseFormScreen:
 * - 'backspace': drops the trailing character (or stays empty if already empty)
 * - '.': appends '.' if no decimal exists; prepends '0' if currently empty ('0.')
 * - '0'..'9':
 *   - if current is exactly '0', replaces it with the pressed digit
 *   - if decimal part already has 2 or more digits, blocks additional digits
 *   - if current length is strictly greater than 9, blocks additional digits
 *     (Note: allows up to 10 characters before blocking further digits)
 *   - otherwise appends the digit
 */
export function applyKeypadPress(current: string, key: KeypadKey | string): string {
  if (key === 'backspace') {
    return current.slice(0, -1);
  }

  if (key === '.') {
    return !current.includes('.') ? (current === '' ? '0.' : current + '.') : current;
  }

  // Digit keys
  if (current === '0') return key;
  if (current.includes('.') && (current.split('.')[1]?.length ?? 0) >= 2) return current;
  if (current.length > 9) return current;
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
