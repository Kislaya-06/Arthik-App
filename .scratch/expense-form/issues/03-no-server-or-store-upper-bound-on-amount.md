# No server-side or store-side upper bound on amount

Status: needs-triage

## Description

In the current architecture, the custom UI keypad (`src/lib/amountKeypad.ts`) is the only defense in the entire application preventing overflowing or unrealistic financial amounts from reaching the database. Neither the form submission handler, nor the Zustand store, nor the Postgres schema enforce any maximum upper bound on `amount`.

---

## Code Locations

### 1. Form Validation Handler (`src/hooks/useExpenseForm.ts:168`)
```typescript
const numAmount = parseFloat(amount);
// ...
const isValid = numAmount > 0 && isCategorySelectedAndReal;
```
`handleSave` only checks `numAmount > 0`. There is no check against a ceiling or maximum allowed magnitude.

### 2. Store Action Layer (`src/store/expenseStore.ts:842-860`)
```typescript
const payload: any = {
  id: newId,
  user_id: user.id,
  amount,
  // ...
};
const { data, error } = await supabase
  .from('expenses')
  .upsert(payload, { onConflict: 'id', ignoreDuplicates: true })
```
`addExpense` and `updateExpense` forward `amount` directly to Supabase without validation.

### 3. Database Schema (`schema.sql:100`)
```sql
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    -- ...
);
```
Postgres only enforces `CHECK (amount > 0)`. The only upper boundary is the hardware limit of `NUMERIC(12, 2)` (max 10 integer digits: `9,999,999,999.99`).

---

## Failure Mode & Offline Sync Invariant

If an oversized or malformed amount (e.g. > `9,999,999,999.99`) is written while offline:
1. The optimistic update succeeds locally in AsyncStorage pending queues (`@arthik_pending_expenses_<userId>`).
2. Upon reconnecting, the background network sync worker pushes the payload to Supabase.
3. Postgres rejects the row with error `22003: numeric field overflow`.
4. The transaction fails sync and is parked into `@arthik_failed_sync_<userId>`.
5. The user sees a `SyncFailedBanner` with an unrecoverable database error that they cannot act on or edit from the UI.

---

## Suggested Remediation (Do Not Implement Without Migration)

Add an explicit upper bound check constraint to `schema.sql` (and Supabase migration):
```sql
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_amount_positive;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_amount_valid CHECK (amount > 0 AND amount <= 999999999.99);
```
And add matching validation in `useExpenseForm.ts` before calling `addExpense`/`updateExpense`.
