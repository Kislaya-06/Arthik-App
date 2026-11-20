import AsyncStorage from '@react-native-async-storage/async-storage';
import { round2 } from '../../lib/formatters';
import { resolvePlanForDate } from '../../lib/budgetPeriods';
import { resolveAutoRenewForPlan } from '../../lib/budgetModeUtils';
import { markDeficitCheckPending, restoreDeficitCheckPending } from './deficitCheck';
import type { BudgetCadence, BudgetPlanChange, BudgetPeriodRecord, BudgetPeriodStatus } from '../../types';
import type { DailyBudgetState, GullakDeposit } from './types';
import {
  computeMetrics,
  isDailyOwnedDate,
  getTodayDateStr,
  getUserCreatedAtLocalDate,
  dailyCarryExtraFor,
} from './metrics';
import { getLastRenewedPeriodKey } from './pendingStorage';
import { useNotificationStore } from '../notificationStore';
import { useNetworkStore } from '../networkStore';
import { useAuthStore } from '../authStore';
import { getCurrentExpenses, areExpensesLoaded, areExpensesFreshFromServer } from './expenseBridge';
import { buildCategoryClassifier, buildEligibleIncomeClassifier } from './classifiers';
import { computeSpentByDate, computeIncomeByDate } from '../../lib/budgetCalculations';
import {
  selfHealDefaultBudget,
  selfHealCorruptedRows,
} from './selfHealing';
import { fetchRemoteBudgetData, fetchGullakDepositsRaw, mergeGullakDeposits } from './hydrateRemote';
import { PersistStoreLike, waitForPersistHydration, readPendingSettings, buildOfflineHydrationPatch, persistActivatedPlanSettings, mergePendingPlanChanges, mergePendingPeriods } from './hydrateOffline';
export { PersistStoreLike, waitForPersistHydration, readPendingSettings, buildOfflineHydrationPatch, persistActivatedPlanSettings, mergePendingPlanChanges, mergePendingPeriods } from './hydrateOffline';

export { RemoteProfileData, RemotePlanChangeEntry, RemoteBudgetPeriodEntry, RemoteBudgetData, fetchRemoteBudgetData, fetchGullakDepositsRaw, mergeGullakDeposits, hydrateGullakDeposits } from './hydrateRemote';

export interface HydrateContext {
  get: () => DailyBudgetState;
  set: (partial: Partial<DailyBudgetState> | ((state: DailyBudgetState) => Partial<DailyBudgetState>)) => void;
  userId: string;
  store: PersistStoreLike;
}

export async function runHydrateFromSupabase(ctx: HydrateContext): Promise<void> {
  const { get, set, userId, store } = ctx;
  if (!userId) return;
  try {
    // P0.1: Wait for zustand persist rehydration if not already done
    await waitForPersistHydration(store);

    // P0.2: Reset state if owner changed
    if (get().ownerUserId && get().ownerUserId !== userId) {
      get().resetDailyBudget();
    }
    set({ ownerUserId: userId });

    // Also set owner on notificationStore
    useNotificationStore.getState().setOwnerUserId(userId);

    const todayStr = getTodayDateStr();
    await restoreDeficitCheckPending(userId);

    // Check pending settings key (P0.13)
    const pendingSettings = await readPendingSettings(userId);

    // Offline fast-path: return immediately with persisted state from Zustand persist
    if (useNetworkStore.getState().isOffline) {
      const patch = buildOfflineHydrationPatch(get, pendingSettings, todayStr, userId);
      set(patch);
      return;
    }

    // 1. Fetch user profile, logs, plan changes, budget periods, and gullak deposits in parallel with timeout
    const depositsRawPromise = fetchGullakDepositsRaw(userId).catch((e) => ({ data: null, error: e as Error }));
    const { profileData, logsData, plansData, periodsData } = await fetchRemoteBudgetData(userId);

    let resolvedBudget = get().dailyBudgetAmount;
    let resolvedAutoRenew = get().isAutoRenew;
    // Track whether Supabase returned the migration-default 500 so self-healing can fire
    // even on fresh installs where local state is already default (and resolvedBudget gets set).
    let remoteBudgetWasMigrationDefault = false;

    if (pendingSettings.daily_budget !== undefined) {
      resolvedBudget = pendingSettings.daily_budget;
    } else if (profileData && profileData.daily_budget !== null && profileData.daily_budget !== undefined) {
      const remoteBudget = Math.max(0, round2(Number(profileData.daily_budget)));
      // Guard: Remote is the migration default 500 AND local has a different value (including fresh install).
      // In both cases the self-healing recovery block below will infer the real budget from savings logs,
      // so we defer — leave resolvedBudget as whatever local already has and let recovery overwrite if needed.
      if (remoteBudget === 500) {
        remoteBudgetWasMigrationDefault = true;
        resolvedBudget = get().dailyBudgetAmount;
      } else {
        resolvedBudget = remoteBudget;
      }
    } else {
      resolvedBudget = get().dailyBudgetAmount;
    }

    if (pendingSettings.is_auto_renew !== undefined) {
      resolvedAutoRenew = Boolean(pendingSettings.is_auto_renew);
    } else if (profileData && profileData.is_auto_renew !== null && profileData.is_auto_renew !== undefined) {
      resolvedAutoRenew = Boolean(profileData.is_auto_renew);
    } else {
      resolvedAutoRenew = get().isAutoRenew;
    }

    // Resolve 4 new profile columns
    let resolvedBudgetModeEnabled = get().isBudgetModeEnabled;
    if (pendingSettings.is_budget_mode_enabled !== undefined) {
      resolvedBudgetModeEnabled = Boolean(pendingSettings.is_budget_mode_enabled);
    } else if (profileData && profileData.is_budget_mode_enabled !== null && profileData.is_budget_mode_enabled !== undefined) {
      resolvedBudgetModeEnabled = Boolean(profileData.is_budget_mode_enabled);
    }

    let resolvedCadence: BudgetCadence = get().budgetCadence || 'daily';
    if (pendingSettings.budget_cadence !== undefined) {
      resolvedCadence = pendingSettings.budget_cadence as BudgetCadence;
    } else if (profileData && profileData.budget_cadence) {
      resolvedCadence = profileData.budget_cadence as BudgetCadence;
    }

    let resolvedWeeklyBudget = get().weeklyBudgetAmount || 0;
    if (pendingSettings.weekly_budget !== undefined) {
      resolvedWeeklyBudget = pendingSettings.weekly_budget;
    } else if (profileData && profileData.weekly_budget !== null && profileData.weekly_budget !== undefined) {
      resolvedWeeklyBudget = Math.max(0, round2(Number(profileData.weekly_budget)));
    }

    let resolvedMonthlyBudget = get().monthlyBudgetAmount || 0;
    if (pendingSettings.monthly_budget !== undefined) {
      resolvedMonthlyBudget = pendingSettings.monthly_budget;
    } else if (profileData && profileData.monthly_budget !== null && profileData.monthly_budget !== undefined) {
      resolvedMonthlyBudget = Math.max(0, round2(Number(profileData.monthly_budget)));
    }

    // Process plan changes
    let resolvedPlanChanges: BudgetPlanChange[] = [];
    if (plansData && plansData.length > 0) {
      resolvedPlanChanges = (plansData as Array<{
        id: string;
        effective_from: string;
        is_enabled: boolean;
        cadence: string;
        amount: number | string;
        carry_mode?: 'additive' | 'allocation';
        carried_over_amount?: number | string | null;
        created_at?: string;
      }>).map((p) => ({
        id: p.id,
        userId,
        effectiveFrom: p.effective_from,
        isEnabled: Boolean(p.is_enabled),
        cadence: p.cadence as BudgetCadence,
        amount: Number(p.amount) || 0,
        carryMode: p.carry_mode,
        carriedOverAmount: Number(p.carried_over_amount) || 0,
        createdAt: p.created_at,
      }));
    } else {
      resolvedPlanChanges = get().planChanges || [];
    }
    resolvedPlanChanges = await mergePendingPlanChanges(userId, resolvedPlanChanges);
    const activePlanForToday = resolvePlanForDate(resolvedPlanChanges, todayStr);
    // PUR-003: a scheduled Pure <-> Budget switch that matured while the app was closed is applied HERE (the cold
    // start hydrates before the first rollover, which would then see the mode as already switched). It must decide
    // auto-save exactly like the rollover does, and save the new settings, or the user sees Budget Mode ON with a
    // paused allowance (₹0 today) and the next start could undo a later "pause auto-save".
    let activatedPlan: BudgetPlanChange | null = null;
    if (activePlanForToday) {
      if (activePlanForToday.isEnabled !== resolvedBudgetModeEnabled) {
        resolvedAutoRenew = resolveAutoRenewForPlan(
          activePlanForToday.isEnabled,
          resolvedBudgetModeEnabled,
          resolvedAutoRenew
        );
        activatedPlan = activePlanForToday;
      }
      resolvedBudgetModeEnabled = activePlanForToday.isEnabled;
      if (activePlanForToday.isEnabled) {
        resolvedCadence = activePlanForToday.cadence;
      }
    }

    // Process budget periods
    let resolvedPeriods: Record<string, BudgetPeriodRecord> = { ...get().budgetPeriods };
    if (periodsData && periodsData.length > 0) {
      for (const p of periodsData) {
        resolvedPeriods[p.id] = {
          id: p.id,
          userId,
          cadence: p.cadence as 'weekly' | 'monthly',
          periodStart: p.period_start,
          periodEnd: p.period_end,
          activeStart: p.active_start,
          activeEnd: p.active_end,
          budgetAmount: Number(p.budget_amount) || 0,
          spentAmount: Number(p.spent_amount) || 0,
          amountSaved: Number(p.amount_saved) || 0,
          status: p.status as BudgetPeriodStatus,
          isProrated: Boolean(p.is_prorated),
          carryMode: p.carry_mode,
          carriedOverAmount: Number(p.carried_over_amount) || 0,
          createdAt: p.created_at,
        };
      }
    }
    resolvedPeriods = await mergePendingPeriods(userId, resolvedPeriods);

    const records = { ...get().dailyRecords };

    const currentUser = useAuthStore.getState().user;
    const userCreatedAtStr = getUserCreatedAtLocalDate(currentUser?.created_at);

    // ------------------------------------------------------------------------------------
    // SELF-HEALING RECOVERY (Fix for OTA Update Bug where user budget was reset to 500)
    // ------------------------------------------------------------------------------------
    const currentExpenses = getCurrentExpenses();
    const isIncomeFn = buildCategoryClassifier();
    const isEligibleIncomeFn = buildEligibleIncomeClassifier();
    const spentByDate = computeSpentByDate(currentExpenses, isIncomeFn);
    const incomeByDate = computeIncomeByDate(currentExpenses, isEligibleIncomeFn);

    resolvedBudget = selfHealDefaultBudget({
      resolvedBudget,
      remoteBudgetWasMigrationDefault,
      logsData,
      userCreatedAtStr,
      spentByDate,
      records,
      userId,
    });

    selfHealCorruptedRows({
      logsData,
      userCreatedAtStr,
      spentByDate,
      resolvedPlanChanges,
      resolvedBudget,
      records,
      incomeByDate,
      userId,
      expensesLoaded: areExpensesLoaded(),
      // OPT-63: only rewrite server rows when the expense list came from the server in this session.
      allowServerWrites: areExpensesFreshFromServer(),
    });

    // Ensure today's record exists if not present
    if (!records[todayStr]) {
      const todayDaily = isDailyOwnedDate(resolvedPlanChanges, todayStr);
      const todayBudget = resolvedBudgetModeEnabled && resolvedAutoRenew && resolvedBudget > 0 && todayDaily ? resolvedBudget + dailyCarryExtraFor(todayStr) : 0;
      records[todayStr] = {
        date: todayStr,
        budget: todayBudget,
        spent: 0,
        saved: todayBudget,
        isFinalized: false,
        status: resolvedBudgetModeEnabled && resolvedAutoRenew && resolvedBudget > 0 && todayDaily ? 'active' : 'unknown',
      };
    } else if (resolvedBudgetModeEnabled && !records[todayStr].isFinalized) {
      if (resolvedAutoRenew && resolvedBudget > 0 && isDailyOwnedDate(resolvedPlanChanges, todayStr)) {
        if (records[todayStr].budget === 0) {
          records[todayStr].budget = resolvedBudget;
          records[todayStr].saved = Math.max(0, resolvedBudget - records[todayStr].spent);
          records[todayStr].status = records[todayStr].spent > resolvedBudget ? 'missed' : 'active';
        }
      } else {
        // Auto-renew paused (OFF) -> today's unfinalized record has budget 0
        records[todayStr] = {
          ...records[todayStr],
          budget: 0,
          saved: 0,
          status: 'unknown',
        };
      }
    } else if (!resolvedBudgetModeEnabled && !records[todayStr].isFinalized) {
      records[todayStr] = {
        ...records[todayStr],
        budget: 0,
        saved: 0,
        status: 'unknown',
      };
    }

    // 2b. Merge manual gullak deposits from the parallel Supabase query
    let resolvedDeposits: GullakDeposit[];
    try {
      resolvedDeposits = await mergeGullakDeposits(userId, get().gullakDeposits || [], await depositsRawPromise);
    } catch (depErr) {
      if (__DEV__) console.log('Error hydrating gullak_deposits from Supabase:', depErr);
      resolvedDeposits = get().gullakDeposits || [];
    }

    // 3. Recalculate metrics from combined records
    const metrics = computeMetrics(
      records,
      resolvedDeposits,
      userCreatedAtStr,
      resolvedPeriods,
      resolvedCadence,
      get().bestStreakByCadence
    );

    set({
      dailyBudgetAmount: resolvedBudget,
      isAutoRenew: resolvedAutoRenew,
      isBudgetModeEnabled: resolvedBudgetModeEnabled,
      budgetCadence: resolvedCadence,
      weeklyBudgetAmount: resolvedWeeklyBudget,
      monthlyBudgetAmount: resolvedMonthlyBudget,
      planChanges: resolvedPlanChanges,
      budgetPeriods: resolvedPeriods,
      dailyRecords: records,
      gullakDeposits: resolvedDeposits,
      ownerUserId: userId,
      hydratedForUserId: userId,
      lastRenewedPeriodKey: await (async () => {
        try {
          return await AsyncStorage.getItem(getLastRenewedPeriodKey(userId));
        } catch {
          return null;
        }
      })(),
      ...metrics,
    });

    if (activatedPlan) {
      await persistActivatedPlanSettings(userId, activatedPlan, resolvedAutoRenew);
      // PUR-001: Pure -> Budget Mode matured on a cold start; its deficit check runs once the expenses are server-fresh.
      if (activatedPlan.isEnabled) {
        await markDeficitCheckPending(userId, activatedPlan.effectiveFrom);
      }
    }

    // P0.1: Trigger checkAndRollover once after successful hydration.
    // If fresh expenses are already loaded (e.g. fetchExpenses finished first),
    // allow rollover notification so yesterday's celebration is never dropped due to race condition.
    // If expenses are not loaded yet, skip notification to avoid notifying on stale cache.
    const skipNotification = !areExpensesLoaded();
    get().checkAndRollover(currentExpenses, skipNotification);

    // P0.14: Also upload any records that need upload
    get().uploadPendingDailyRecords();
  } catch (e) {
    if (__DEV__) console.error('Error hydrating daily budget from Supabase:', e);
  }
}

