# formatAmountWithCommas accepts more than one decimal point

Status: needs-triage

## Description

In `src/lib/formatters.ts`, `formatAmountWithCommas` strips characters that are not digits or periods, but only locates the index of the first period. Everything following the first period is unconditionally preserved as the `decimalPart`:

```typescript
// src/lib/formatters.ts:37-45, 67
export const formatAmountWithCommas = (rawStr: string): string => {
  if (!rawStr) return '';
  const clean = rawStr.replace(/[^0-9.]/g, '');
  if (!clean) return '';

  const dotIndex = clean.indexOf('.');
  let integerPart = dotIndex >= 0 ? clean.slice(0, dotIndex) : clean;
  const decimalPart = dotIndex >= 0 ? clean.slice(dotIndex) : '';
...
  return formattedInt + decimalPart;
};
```

When called with an input having multiple decimal points like `'1000.5.5'`, `clean` is `'1000.5.5'`, `dotIndex` is `4`, `integerPart` is `'1000'`, and `decimalPart` is `'.5.5'`. The function returns `'1,000.5.5'`.

## Reachability Analysis & UI Verification

We investigated all UI callers of `formatAmountWithCommas` across the codebase:
1. `src/screens/ExpenseFormScreen.tsx:705` (displaying expense amount)
2. `src/screens/SavingsScreen.tsx:251` (initializing budget modal input)
3. `src/screens/SavingsScreen.tsx:765` (handling budget modal text input changes)

### 1. `src/screens/ExpenseFormScreen.tsx` — Unreachable via UI

In `ExpenseFormScreen.tsx`, users do not type into a standard keyboard text input. Amount entry is strictly driven by an in-app custom keypad component (`KeyButton`):

```typescript
// src/screens/ExpenseFormScreen.tsx:914-916
                <View key={rowIndex} style={styles.keypadRow}>
                  <KeyButton key={item} item={item} onPress={handleKeyPress} />
                </View>
```

The keypad handler in `ExpenseFormScreen.tsx` contains an explicit check preventing a second decimal point from ever being added:

```typescript
// src/screens/ExpenseFormScreen.tsx:546-561
  const handleKeyPress = useCallback((val: string) => {
    if (val === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
    } else if (val === '.') {
      setAmount((prev) =>
        !prev.includes('.') ? (prev === '' ? '0.' : prev + '.') : prev
      );
    } else {
      setAmount((prev) => {
        if (prev === '0') return val;
        if (prev.includes('.') && prev.split('.')[1]?.length >= 2) return prev;
        if (prev.length > 9) return prev;
        return prev + val;
      });
    }
  }, []);
```

Lines 549–552 explicitly check `!prev.includes('.')`. If the current amount string already contains a decimal point, pressing `.` returns `prev` without modification. Therefore, **a second dot cannot be typed via the UI in `ExpenseFormScreen.tsx`**.

### 2. `src/screens/SavingsScreen.tsx` — Reachable via UI (Pasting or System Keyboard)

In `SavingsScreen.tsx`, the budget modal utilizes a native React Native `<TextInput>`:

```typescript
// src/screens/SavingsScreen.tsx:761-769
              <TextInput
                style={[styles.modalTextInput, { color: colors.textPrimary }]}
                keyboardType="numeric"
                value={inputBudget}
                onChangeText={(val) => setInputBudget(formatAmountWithCommas(val))}
                placeholder="500"
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
```

Because this is a native `TextInput` with `keyboardType="numeric"`, users can:
- Paste a string with multiple periods (e.g. `'100.5.5'`) from clipboard, or
- Enter multiple periods on software/hardware keyboards that allow repeated period key presses.

When this occurs:
1. `onChangeText` calls `setInputBudget(formatAmountWithCommas(val))`, setting `inputBudget` to `'100.5.5'`.
2. When the user taps "Save Budget", `handleSaveBudget` executes:
```typescript
// src/screens/SavingsScreen.tsx:255-257
  const handleSaveBudget = useCallback(() => {
    const num = parseFloat(cleanAmountString(inputBudget));
```
3. `cleanAmountString('100.5.5')` returns `'100.5.5'`.
4. `parseFloat('100.5.5')` parses up to the second dot, evaluating to `100.5` without error, silently discarding the second decimal part (`.5`).

### Real Severity
**Low / Edge Case**.
The primary financial input surface (`ExpenseFormScreen.tsx`) has full UI protection. In `SavingsScreen.tsx`, pasting an invalid string with multiple dots results in a distorted UI display string (`'100.5.5'`), although `parseFloat` mitigates a total crash upon saving by parsing the leading valid number.

## Comments
- Pinned in characterization test suite at `tests/formatters.test.ts:87-90`.
