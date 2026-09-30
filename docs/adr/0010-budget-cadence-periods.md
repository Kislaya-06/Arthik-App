# 0010. Multi-Cadence Budget Modes and Period Engine

## Status
Accepted (September 2026).

## Context
Originally, Arthik was designed around a single financial model: a fixed daily spending allowance that rolled over unused funds into a digital Gullak at midnight. While effective for day-to-day discipline, users requested greater flexibility:
1. **Pure Expense Tracking**: Users who do not want an artificial daily spending limit or Gullak savings, but desire a clean, modern expense tracker with full inflow, outflow, and category insights.
2. **Weekly & Monthly Budgeting**: Salaried users and household managers who plan finances around weekly (Monday–Sunday) or monthly pay cycles rather than strict daily allowances.
3. **Financial Invariant (Real Money)**: In Arthik, every tracked rupee represents real money. Daily budget allowances allocated during active days represent real deposited cash funded into the user's account. If a user turns Budget Mode off (Pure Mode), past active allowances must never be dropped, ignored, or wiped out from historical cashflow or Inflow metrics.

## Decision
We established a comprehensive Multi-Cadence Budget Architecture governed by decisions D1 through D7:

### D1: Two High-Level Modes
- **Pure Mode (`isBudgetModeEnabled: false`)**: The default for all new accounts. The bottom navigation bar renders 4 tabs (`Home`, `History`, `Add`, `Insights`). The Home screen showcases an executive Inflow/Outflow financial overview centered on a concentric `DualRingChart`. Direct navigation to the `'Savings'` screen is guarded by `resolveSavingsRoute` and safely falls back to `'Home'`.
- **Budget Mode (`isBudgetModeEnabled: true`)**: Activates spending allowances, Gullak savings rollovers, and a 5th navigation tab (`Savings`) with smooth entrance/exit animations.

### D2: Three Supported Cadences
Budget Mode supports three distinct cadences:
- **Daily**: Day-by-day allowance renewed each midnight.
- **Weekly**: Calendar weeks starting Monday at 00:00:00 and ending Sunday at 23:59:59.
- **Monthly**: Calendar months starting on the 1st and ending on the last day of each month.

### D3: Effective from Tomorrow for Plan Changes
To prevent retroactive churn, maintain financial discipline, and preserve current-period progress, any change to a user's budget amount or cadence takes effect starting **tomorrow at 12:00 AM** (or the next period boundary). First-time enablement from Pure Mode takes effect immediately ("Today"). Users can review and cancel pending scheduled changes at any time prior to midnight.

### D4: Proration for Mid-Period Switches
When switching cadences or modifying a budget mid-cycle, partial periods are calculated via standard day-count proration:
$$\text{Prorated Budget} = \text{round}\left(\frac{\text{Full Budget}}{\text{Total Days in Cycle}} \times \text{Remaining Active Days}\right)$$
This ensures fair targets without requiring users to wait until month-end or Monday to adjust their financial strategy.

### D5: Continuous Active Slices
The timeline engine (`src/lib/budgetPeriods.ts`) walks the chronological list of `planChanges` and decomposes the user's history into non-overlapping active slices `[activeStart, activeEnd]`. Each day belongs to at most one slice, preventing overlapping and eliminating double-counting across cadence transitions.

### D6: Multi-Cadence Streak Tracking & Period Finalization
- Completed periods are evaluated by `buildPeriodsToFinalize` and permanently recorded in Supabase `budget_periods`.
- Streaks track consecutive successful periods for the current cadence (`bestStreakByCadence`), displayed in units matching the cadence ("5 days", "3 weeks", "2 months").
- Intervals where Budget Mode was toggled off are marked as "Paused" in the adaptive streak calendar and do not count as broken streaks or red penalty days.

### D7: Offline-First Queueing & Sync
All plan adjustments and finalized periods persist in AsyncStorage (`@arthik_pending_plan_changes_${userId}`, `@arthik_pending_budget_periods_${userId}`) and flush to Supabase upon reconnect. The Zustand persist schema was migrated to version 3 with comprehensive backwards-compatibility for existing accounts.

## Consequences
- **Positive**: Complete user freedom to choose between pure tracking and multi-cadence budgeting without sacrificing the foundational Real Money invariant. Zero double-counting across transitions. Reliable offline resilience.
- **Negative**: Increased complexity in period evaluation and aggregation (`budgetPeriods.ts`, `dailyBudgetStore.ts`). Required adding dedicated unit test suites covering timeline walking, proration, and notification deduplication.
