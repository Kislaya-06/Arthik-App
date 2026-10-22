# 0019. Income Categories and Required Category on Review

## Status
Accepted (22 October 2026). Canonical rules: `CAT-004` (new), `CAT-001` and `TXN-002` (amended). `CAT-002` is unchanged.

## Context
1. On the Automatic Logging review sheet, saving a credit with the "None" category logged it with `needsCategory = true` (`engine.logEvent`). The transaction came straight back to review asking for a category, so the review could never be finished.
2. Income added with the + button had no category at all (`TXN-002` said `category_id = null`), so reports could not show where money came from (Salary, Freelance, Refund, ...).
3. Manage Categories and the category pickers only knew expense categories.

## Decision
1. **Category is required on review.** The "None" chip is gone. Save stays disabled until a category is chosen. Settle with a person, Mark as self transfer and Teach Format work without one, as before.
2. **Categories have a side.** `categories.kind` is `'expense'` or `'income'` (default `'expense'`, so old rows and old caches are expense categories). `categoryKindOf` and `categoriesOfKind` (pure helpers in `categoryStore.ts`) are the only place that reads it.
3. **Pickers show one side.** The Add / Edit form and the review sheet show income categories for income and expense categories for expenses. Switching the side clears or re-picks the category.
4. **Income needs a category.** `useExpenseForm` blocks saving a normal income without one. Money back and self transfers have no category. An old income that points at an expense category must get an income category when it is edited.
5. **Top-up money lands in "Other Income".** "Added to balance" (the not-enough-money guard) uses `FALLBACK_INCOME_CATEGORY_NAME`, or the first income category if that one is gone. The Pure Mode auto-balance income keeps `category_id = null` (`PUR-001`).
6. **One Manage Categories screen** with an `Expense | Income` toggle. The Add button creates a category on the visible side. Income categories use their own icon set.
7. **Seeding.** `handle_new_user()` seeds 7 expense and 5 income categories (Salary, Freelance, Interest, Gift, Other Income). Existing users get the 5 income categories once from migration `20261022120000_income_categories.sql`.
8. **Deletion is unchanged (`CAT-002`).** A category with transactions cannot be deleted. We did NOT add "move to Other on delete".

## Consequences
- Direction still comes only from `type` (`TXN-001`). A category never changes any amount, balance or budget.
- Insights count only spending, so income categories never show in category charts.
- The migration must run BEFORE the new app version is released, because the app now sends `kind` when it saves a category.

## What Would Have to Be True to Revisit
- If users need to move transactions between categories in bulk, a reassign tool (not auto-delete) is the safer way to let them delete a used category.
