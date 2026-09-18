# Daily Budget & Savings Engine Audit Issues

This spec tracks data integrity, sync, and accounting defects identified in `src/store/dailyBudgetStore.ts` during the comprehensive codebase audit documented in `docs/daily-budget-map.md`.

## Issues Overview

1. `01-sentinel-500-budget-deletion.md`: ₹500 budget is treated as a sentinel value in `hydrateFromSupabase`, leading to silent deletion of legitimate user savings rows.
2. `02-ignore-duplicates-on-first-finalization.md`: `ignoreDuplicates: isInsertOnly` on initial day rollover causes Supabase upserts to silently discard final budget and savings values if a row already exists.
3. `03-untracked-days-get-status-even-instead-of-unknown.md`: Untracked zero-budget, zero-spend historical days are assigned status `'even'` instead of `'unknown'`, breaking the user's savings streak.
4. `04-timezone-handling-in-best-streak.md`: `new Date('yyyy-MM-dd')` UTC midnight parsing combined with local `.getDate()` shifts dates backwards in timezones west of UTC (UTC-1 to UTC-12), corrupting `bestStreak`.
