# 0016. Split Expenses, Money Back and Refunds

## Status
Accepted (18 October 2026). Replaces item 2 of ADR 0014 (the removal of Split Expenses and "a friend paying back is plain Income"). Canonical rules: `SPL-001..SPL-006`, `TXN-004`.

## Context
When a user paid for a friend and the friend paid back later, the money counted as Income. The Income chip then showed money that was never earned, and Total Income went up. The old Split feature had been removed (ADR 0014) because it was complex and its numbers could drift.

## Decision
1. **An expense can be shared with one or more people** (`split_allocations JSONB`, backward-compatible with legacy single-person `split_person` and `split_amount`). The row keeps the full amount paid. The UI trigger is a compact capsule pill with an AnimatedToggle placed above the keypad fold.
2. **Money that comes back is one "money back" row** (`transaction_class = 'recovery'`, income direction) that lists the expenses it went back to (`recovery_allocations`). It is excluded from income and expense totals like a self-transfer.
3. **The counted amount of an expense is derived**, not stored: `amount paid − money back`. It is applied in one place, a store middleware (`recoveryMiddleware.ts`), whenever `expenses` is written. `gross_amount` (store-only) keeps the amount paid, and only the amount paid is ever sent to the database.
4. **No source tracking.** The waterfall (budget → income → Gullak) and the day / period rollover already run again on every expense change. A smaller expense on its ORIGINAL day returns money to the same place it came from, by itself.
5. **Nothing about who owes what is stored.** It is computed from the rows (`splitLedger.ts`), oldest expense first. A money-back row can be deleted to undo everything.
6. **Matching a bank credit to a person** uses name and amount first, then name only. The app only asks; it never settles by itself.
7. **Refund attribution for multi-person splits (Solution 2):** When a merchant refunds a split expense, the user interactively selects who the refund was for: (a) *Split among everyone* (proportional deduction across user and each participant), (b) *Specific friend* (targeted deduction), or (c) *Just for me* (targeted to user's share). `recovery_allocations` stores `refund_target` without schema changes, and `outstandingOnExpense` applies proportional and targeted deductions so one person's settlement never falsely zeroes out another person's debt.
8. **Safety:** an expense with money back cannot be deleted first; a money-back row cannot be edited (delete and add again); the new database columns are sent only by rows that use them, so the app keeps working before the SQL is run.
9. **Interactive Ledger Settlements (Mark as Paid & Settle All):** Users can directly settle offline payments (Cash or UPI) from the Ledger screen. Each open expense has a responsive `Paid` action pill, and each person card offers a `Settle all` shortcut. Settlements prompt a quick confirmation sheet (`SettleExpenseSheet`) with payment mode selection and record canonical recovery transactions without false income.

## Rejected
- *Negative expense on the day money arrives*: it would make that day look under budget and push the money into Gullak (breaks `BUD-003`).
- *Storing a balance per person*: it can drift from the rows.
- *Rewriting the expense `amount` in the database*: several rows would have to change together, and one failed offline write would leave the books wrong.
- *Naive remaining room clamping on multi-person refunds*: clamping individual shares against gross remaining room caused a participant's settlement to falsely clear remaining friends' debts.

## Consequences
- Total Income no longer includes money that only came back. Total Account Remaining rises by the money received.
- Past days and Gullak can change after a settlement. This is correct; the entry on the detail screen says which days.
- Multi-person refunds accurately maintain each participant's open debt with zero residual drift or premature settlement.
- Needs the SQL in `supabase/migrations/20261018_split_and_money_back.sql` and `20261018_multi_person_split.sql`.
