# cleanAmountString does not strip the currency symbol

Status: needs-triage

## Description

In `src/lib/formatters.ts`, `cleanAmountString` only strips commas via regular expression, leaving currency symbols such as `₹` intact:

```typescript
// src/lib/formatters.ts:74-76
export const cleanAmountString = (val: string): string => {
  return val.replace(/,/g, '');
};
```

When called with a currency-prefixed string such as `cleanAmountString('₹52,000')`, it returns `'₹52000'`. If this result is passed into `Number()` or `parseFloat()`, it evaluates to `NaN`.

## Caller Audit & Severity Analysis

A repository-wide search for callers of `cleanAmountString` was performed across the entire codebase.

### Callers Found:
Only **one** caller exists in production code:

1. **`src/screens/SavingsScreen.tsx:256`** inside `handleSaveBudget`:
```typescript
// src/screens/SavingsScreen.tsx:255-265
  const handleSaveBudget = useCallback(() => {
    const num = parseFloat(cleanAmountString(inputBudget));
    if (!isNaN(num) && num >= 0) {
      if (modalMode === 'recurring') {
        setDailyBudget(num);
      } else {
        setTodayBudget(num);
      }
    }
    setBudgetModalVisible(false);
  }, [inputBudget, modalMode, setDailyBudget, setTodayBudget]);
```

### Can any caller receive a string containing `'₹'`?
**No.**

Tracing the origin and updates of `inputBudget` in `src/screens/SavingsScreen.tsx`:

1. When opening the modal, `inputBudget` is initialized from raw numeric amounts without any currency prefix:
```typescript
// src/screens/SavingsScreen.tsx:243-253
  const handleOpenBudgetModal = useCallback((mode: 'recurring' | 'today') => {
    setModalMode(mode);
    let rawVal = '';
    if (mode === 'recurring') {
      rawVal = dailyBudgetAmount > 0 ? String(dailyBudgetAmount) : '';
    } else {
      rawVal = todayBudget > 0 ? String(todayBudget) : (dailyBudgetAmount > 0 ? String(dailyBudgetAmount) : '');
    }
    setInputBudget(rawVal ? formatAmountWithCommas(rawVal) : '');
    setBudgetModalVisible(true);
  }, [dailyBudgetAmount, todayBudget]);
```

2. In the UI, the `₹` currency symbol is rendered in a separate `<Text>` sibling element outside the `<TextInput>`:
```typescript
// src/screens/SavingsScreen.tsx:759-770
            <View style={[styles.modalInputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.modalCurrencySign, { color: colors.textPrimary }]}>₹</Text>
              <TextInput
                style={[styles.modalTextInput, { color: colors.textPrimary }]}
                keyboardType="numeric"
                value={inputBudget}
                onChangeText={(val) => setInputBudget(formatAmountWithCommas(val))}
                placeholder="500"
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
            </View>
```

3. When the user types into the `TextInput`, `onChangeText` passes the input to `formatAmountWithCommas(val)`. `formatAmountWithCommas` removes any non-numeric and non-dot character with `clean = rawStr.replace(/[^0-9.]/g, '')` (`src/lib/formatters.ts:39`), stripping out any pasted `₹` symbols before `inputBudget` is updated.

### Real Severity
**Low / Latent**.
Because no caller currently supplies a string containing `'₹'`, this quirk causes zero runtime failures in the current app flows. However, the doc comment on line 71 states *"Strips commas from a formatted amount string to get the pure numeric string"*, which makes the function an easy bug hazard for future callers who expect it to sanitize formatted currency outputs like `formatCurrency(...)`.

## Comments
- Pinned in characterization test suite at `tests/formatters.test.ts:104-107`.
