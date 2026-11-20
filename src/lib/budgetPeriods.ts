/**
 * budgetPeriods.ts
 *
 * Pure, framework-free calculation engine for budget cadences (Daily, Weekly, Monthly),
 * date ownership, proration, period finalization slices, and cadence streaks.
 *
 * ARCHITECTURAL INVARIANTS:
 * - Pure functions only: NO React, NO Zustand, NO Supabase, NO Date.now() / new Date().
 * - Every function takes explicit inputs (including todayStr in 'yyyy-MM-dd' format).
 * - Dates are manipulated strictly with date-fns using yyyy-MM-dd strings and parseISO.
 * - Week strictly starts on Monday (weekStartsOn: 1).
 * - Financial amounts rounded via round2 from formatters.
 * - Single-owner principle (D2): every date belongs to exactly one owner ('paused' | 'daily' | 'weekly' | 'monthly').
 * - Zero-Proration Policy: budget is 100% active immediately without fractional day scaling.
 */

export { buildPeriodsToFinalize } from './periods/finalize';

export { PeriodSummaryInfo, getCurrentPeriodSummary } from './periods/periodSummary';

export { CalendarCadenceConnectionInfo, computeCalendarConnections } from './periods/calendar';

export { StreakUnit, computeCadenceStreak } from './periods/streak';

export { DailyCarryDay, dailyCarryForDate, dailyCarryRemaining, PeriodCarry, periodCarryForPeriod, periodCarryRemaining } from './periods/carry';

export { BudgetPool, poolKeyFor, buildBudgetPools, poolForDate, poolSpentBefore } from './periods/pools';

export { PeriodBounds, DateOwner, EffectiveFromKind, getPeriodBounds, carryForPeriod, resolvePlanForDate, getDateOwner, hasNeverEnabledBudgetMode, isFirstDayFirstEnable, computeEffectiveFrom, upsertPendingChange, isDailyGovernedDate, BUDGET_RULES_V2_FROM, getNextPeriodStart } from './periods/core';
