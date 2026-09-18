# 0002. Income Inferred from Category Keywords

## Context
The early schema and storage model of Arthik was built strictly around expense tracking, storing all entries in a single `expenses` table. As the feature set expanded to track incoming funds ("Add Money"), adding income transactions without breaking existing user data or requiring complex database migrations posed a challenge. Furthermore, legacy database rows lacked a populated or reliable transaction type column.

## Decision
We decided to store all transactions within the single `expenses` table and infer transaction direction using a hybrid heuristic in `src/lib/paymentUtils.ts`:
1. Check explicit `type === 'income'` or `type === 'expense'` first.
2. If `type` is missing or indeterminate, fall back to matching the associated category name against a predefined list of keyword substrings (`DEFAULT_INCOME_KEYWORDS` such as `salary`, `freelance`, `stipend`, `cashback`, `refund`, `gift`, etc.).
3. Income transactions are excluded from daily allowance spending calculations (`todayLiveSpent`, `spent_amount`) and expense category charts, but included in net cashflow calculations on the Home screen.

## Consequences
- **Positive**: Backward compatibility with legacy database rows is maintained. No destructive database migration or table splitting was required. Users can categorize income under familiar category names.
- **Negative**: Direction logic is implicit and heuristic-driven. If a user names an expense category with a keyword like "Rental Car", the keyword fallback could falsely classify it as income unless explicitly overridden by `type`. Defensive filtering is required across all reporting screens.

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- A planned, formal database migration backfills and strictly enforces a non-nullable `type` column (`'expense' | 'income'`) across all historical and future transactions in Supabase.
- User demand requires independent category hierarchies for income versus expense (e.g. dedicated Income Categories separate from Expense Categories).
