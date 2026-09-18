# edit-mode prefill guard never latches when the expense is not found

Status: needs-triage

## Description

In `src/hooks/useExpenseForm.ts`, the prefill effect guards against multiple runs via `hasPrefilled.current`:

```typescript
// src/hooks/useExpenseForm.ts:98-118
  // ─── Pre-fill form when editing an existing expense (P1.7: once only via ref) ───
  useEffect(() => {
    if (hasPrefilled.current) return;

    if (!isEdit || !expenseId) {
      setTransactionType('expense');
      hasPrefilled.current = true;
      return;
    }

    const currentExpense = expenses.find((e) => e.id === expenseId);
    if (currentExpense) {
      setAmount(currentExpense.amount.toString());
      setSelectedCategoryId(currentExpense.category_id || null);
      setNote(currentExpense.note || '');
      setSelectedDate(parseISO(currentExpense.expense_date));
      setPaymentMode(currentExpense.payment_mode);
      setTransactionType(currentExpense.type === 'income' ? 'income' : 'expense');
      hasPrefilled.current = true;
    }
  }, [isEdit, expenseId, expenses]);
```

In edit mode (`isEdit && expenseId`), `hasPrefilled.current = true` is only assigned inside the `if (currentExpense)` branch (`line 116`).

If `expenseId` is not found in the `expenses` array at the moment the effect executes:
1. `if (currentExpense)` evaluates to `false`.
2. `hasPrefilled.current` remains `false`.
3. The guard never latches.
4. Because `expenses` is in the dependency array, the effect re-runs on every subsequent change to `expenses` for the entire lifetime of the screen.

## Real Risk Analysis

Today, this flaw is normally masked under ideal network and state conditions because expenses have either already loaded or arrive quickly and prefill the form.

However, a race condition exists:
- If a user opens Edit mode and begins typing before prefill has run (or while `expenses` array is being synced in the background), any subsequent update to `expenses` triggers the effect.
- When `currentExpense` finally matches, it forcibly overwrites all form fields (`amount`, `selectedCategoryId`, `note`, `selectedDate`, `paymentMode`, `transactionType`) with the server values, wiping out the user's in-progress edits.
- Furthermore, if the `expenseId` does not exist in `expenses` at all (e.g. deleted on another device or stale route param), the guard stays unlatched indefinitely.

*Note: This behavior predates the decomposition refactor and was preserved verbatim from `src/screens/ExpenseFormScreen.tsx` to maintain exact runtime parity.*
