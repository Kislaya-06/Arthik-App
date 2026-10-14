import type { Expense } from '../expense/types';
import type { DailyRecord } from '../../lib/budgetCalculations';
import type { BudgetCadence, BudgetPlanChange, BudgetPeriodRecord } from '../../types';

export type GullakDepositSource = 'income' | 'external';

export interface GullakDeposit {
  id: string;
  amount: number;
  date: string; // 'yyyy-MM-dd'
  note?: string;
  source: GullakDepositSource;
  created_at: string;
}

export interface ProfileSettingsPatch {
  daily_budget?: number;
  is_auto_renew?: boolean;
  is_budget_mode_enabled?: boolean;
  budget_cadence?: string;
  weekly_budget?: number;
  monthly_budget?: number;
}

export interface DailyBudgetState {
  ownerUserId: string | null;
  hydratedForUserId: string | null;
  dailyBudgetAmount: number; // default daily recurring amount
  isAutoRenew: boolean; // toggle ON: auto-add daily budget; OFF: manual add
  dailyRecords: Record<string, DailyRecord>;
  gullakDeposits: GullakDeposit[];
  totalAccumulatedSavings: number;
  savingsStreak: number;
  bestStreak: number;

  // Notification deduplication tracking
  lastWarningNotifiedDate: string | null;
  lastExceededNotifiedDate: string | null;
  lastRolloverNotifiedDate: string | null;

  // Next-day scheduled budget
  scheduledNextDailyBudget: number | null;
  scheduledBudgetSetDate: string | null;

  // --- Budget Modes & Multi-Cadence (Oct 2026) ---
  isBudgetModeEnabled: boolean;
  budgetCadence: BudgetCadence;
  weeklyBudgetAmount: number;
  monthlyBudgetAmount: number;
  planChanges: BudgetPlanChange[];
  budgetPeriods: Record<string, BudgetPeriodRecord>; // keyed by `${cadence}_${activeStart}`
  bestStreakByCadence: Record<BudgetCadence, number>;
  lastPeriodWarningKey: string | null;
  lastPeriodExceededKey: string | null;
  lastPeriodRolloverKey: string | null;
  lastRenewedPeriodKey: string | null;

  // Actions
  setDailyBudget: (amount: number) => void;
  scheduleNextDailyBudget: (amount: number) => void;
  cancelScheduledNextDailyBudget: () => void;
  toggleAutoRenew: (enabled: boolean) => void;
  addGullakDeposit: (amount: number, note?: string, source?: GullakDepositSource) => void;
  removeGullakDeposit: (id: string) => void;
  getAvailableIncomeBalance: () => number;
  getGrossIncomeBalance: () => number;
  /** Everything left across the whole account (budgets + income + reimbursements + external deposits - spent). Can be <= 0. */
  getTotalAccountRemaining: () => number;
  /** Money that is left in the running budget and could be carried into a new cadence right now. */
  getCarryableAmount: () => number;
  getPriorAvailableIncomeBalance: () => number;
  syncWithExpenses: (expenses: Expense[]) => void;
  checkAndRollover: (expenses: Expense[], skipRolloverNotification?: boolean) => void;
  uploadPendingDailyRecords: () => Promise<void>;
  syncPendingGullakDeposits: () => Promise<void>;
  hydrateFromSupabase: (userId: string) => Promise<void>;
  resetDailyBudget: () => void;
  getTodayRecord: () => DailyRecord;
  getPastRecordsList: () => DailyRecord[];

  // --- Multi-Cadence Actions & Selectors ---
  setBudgetModeEnabled: (enabled: boolean) => void;
  setBudgetCadence: (
    cadence: BudgetCadence,
    options?: {
      amount?: number;
      carryMode?: 'additive' | 'allocation';
      carriedOverAmount?: number;
    }
  ) => void;
  setWeeklyBudget: (amount: number) => void;
  setMonthlyBudget: (amount: number) => void;
  getPendingPlanChange: () => BudgetPlanChange | null;
  getEffectiveFromLabel: (change?: BudgetPlanChange | null) => string;
  cancelPendingPlanChange: () => void;
  uploadPendingBudgetPeriods: () => Promise<void>;
  syncPendingPlanChanges: () => Promise<void>;
  setLastRenewedPeriodKey: (key: string) => Promise<void>;
}

export type DailyBudgetGet = () => DailyBudgetState;
export type DailyBudgetSet = (
  partial:
    | DailyBudgetState
    | Partial<DailyBudgetState>
    | ((state: DailyBudgetState) => DailyBudgetState | Partial<DailyBudgetState>),
  replace?: boolean | undefined
) => void;
