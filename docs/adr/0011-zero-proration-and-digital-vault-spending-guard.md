# 0011. Zero-Proration Policy and Digital Vault Spending Guard

## Status
Accepted (October 2026) — supersedes D4 in `0010-budget-cadence-periods.md`.

## Context
In previous iterations, partial budget periods (e.g. entering a Weekly budget on Friday or a Monthly budget mid-month) were designed with day-count mathematical proration (`fullBudget * remainingDays / totalDays`). 

However, rigorous analysis of the **Real-Money Invariant** revealed a critical contradiction:
1. Every rupee in Arthik represents real money transferred into a spending pool. When a user allocates ₹7,000 for a week starting Friday, they intend to spend from a ₹7,000 pool, not a scaled-down fraction.
2. Furthermore, as Arthik operates under the mental model of a **Digital Bank Vault**, a user cannot spend money that does not exist. If total available funds (inflow/budget allowance + income + reserves) equal ₹0, creating an expense outflow creates an artificial negative balance without real funds.

## Decision

### D1: Non-Prorated Budgets (Zero-Proration Invariant)
- When a user sets or switches to a Weekly or Monthly budget mid-period, the budget amount is **never scaled down or prorated**.
- The full amount entered by the user becomes the active spending pool for the remainder of the period.
- Pacing metrics (such as `suggestedDailyPace = remaining / remainingDays`) are computed and presented purely as non-binding guidance.
- D4 from ADR 0010 is formally superseded.

### D2: Natural Cycle Rollover vs Mid-Cycle Carry-Forward
- Unspent budget funds are deposited into the digital Gullak **only upon the natural completion of a full cycle** (Daily at 23:59:59, Weekly on Sunday at 23:59:59, Monthly at month-end).
- Switching cadences mid-cycle is strictly distinct from a completed cycle: `amountSaved = 0` (zero Gullak deposit), and unspent funds carry forward into the new cadence context (defaulting to Additive mode, with an Allocation option).
- Deficits (overspending) are settled against available income and Gullak reserves; they never carry forward as a negative budget pool into a new cadence.

### D3: Zero-Balance Spending Guard (Digital Bank Vault Invariant)
- Arthik enforces a digital vault constraint across both Budget Mode and Pure Mode:
  - If a user has zero available inflow/funds (i.e. zero active budget allowance, zero logged income, and zero liquid reserve), the user **cannot create an expense outflow**.
  - Attempting to log an expense with zero available liquidity immediately displays a blocking prompt: *"Aapke paas paise hain hi nahi. Pehle funds/income add karein ya allowance set karein."*
- Overspending past a daily/weekly cadence limit is permitted **only** when backed by overall liquidity (e.g. income or reserve), deducting from the user's broader funds as intended.

### D4: Cadence-Native Streaks
- Streaks track consecutive periods completed within budget, evaluated in units native to the cadence: Daily in days, Weekly in weeks (Monday–Sunday), and Monthly in calendar months.
- Daily fluctuations do not break Weekly or Monthly streaks as long as total period spend remains within budget.

## Consequences
- **Positive**: 100% adherence to real-world financial truth. Eliminates confusing fractions or artificial proration. Prevents phantom outflows when no real funds exist in the vault.
- **Negative**: Requires adding an inflow validation guard at transaction entry boundaries (`ExpenseFormScreen`). Requires aligning legacy tests and UI explainer copy that previously referenced proration.
