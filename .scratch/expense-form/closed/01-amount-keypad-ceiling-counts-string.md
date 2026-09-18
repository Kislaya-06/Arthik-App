# amount keypad's 9-character ceiling counts the whole string, not digits

Status: closed

## Resolution

Resolved in `src/lib/amountKeypad.ts`.
Introduced decoupled `KeypadRules` interface with default 9 integer digits and 2 decimals. Integer and decimal lengths are enforced independently: reaching the 9-digit integer limit never blocks entering a decimal point or paise, and decimal entries do not eat into integer capacity. Verified by tests in `tests/amountKeypad.test.ts`.

## Description

In `src/lib/amountKeypad.ts`, `applyKeypadPress` enforces an amount length ceiling using a crude total string length check:

```typescript
// src/lib/amountKeypad.ts:37-42
  // Digit keys
  if (current === '0') return key;
  if (current.includes('.') && (current.split('.')[1]?.length ?? 0) >= 2) return current;
  if (current.length > 9) return current;
  return current + key;
```

This causes two distinct quirks:

1. **The guard allows a 10th character**:
   - The check is `if (current.length > 9) return current`.
   - When `current` has 9 characters (e.g. `'123456789'`), `current.length > 9` evaluates to `false` (`9 > 9` is false).
   - Therefore, the 10th digit is accepted, resulting in a 10-character string (e.g. `'1234567890'`).
   - Only when length reaches 10 does `10 > 9` evaluate to `true` to block the 11th digit.

2. **The check counts the decimal point, blocking paise on large amounts**:
   - The check `current.length > 9` counts total string characters, not integer digits.
   - While `key === '.'` (`src/lib/amountKeypad.ts:33-35`) does not check length and allows appending a dot to `'1234567890'` to produce `'1234567890.'` (length 11), any subsequent digit press sees `current.length (11) > 9`, which immediately blocks the digit.
   - As a result, at `'1234567890.'`, entering paise (decimals) is completely blocked. Large integer values eat into the space needed for decimals.

## Characterization Tests

Both quirks are pinned as intentional regression baselines in `tests/amountKeypad.test.ts`:

- `tests/amountKeypad.test.ts:49-61` asserts that a 10th character is accepted for `'123456789'`.
- `tests/amountKeypad.test.ts:63-73` asserts that decimal digits are blocked when the total string length including the dot exceeds 9 (e.g. `'1234567890.'`).

Any future fix for these length-ceiling rules must invert or update those test assertions deliberately.
