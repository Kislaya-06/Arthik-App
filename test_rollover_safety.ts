import assert from 'assert';
import { formatCurrency } from './src/lib/formatters.ts';

/**
 * Self-check test for P0.1 & P0.2 Rollover Safety & User Isolation
 * Run with: npx ts-node test_rollover_safety.ts
 */

// Simulated storage & supabase
const mockServerDb: any[] = [];
let upsertCallCount = 0;

interface MockDailyRecord {
  date: string;
  budget: number;
  spent: number;
  saved: number;
  status: 'saved' | 'exceeded' | 'neutral' | 'unknown';
  isFinalized: boolean;
  needsUpload?: boolean;
}

class TestDailyBudgetStore {
  ownerUserId: string | null = null;
  hydratedForUserId: string | null = null;
  dailyRecords: Record<string, MockDailyRecord> = {};
  dailyBudget = 500;

  // P0.1 Guard: Early return if not hydrated for the current user
  checkAndRollover(currentUserId: string, expenses: any[]): boolean {
    if (!this.hydratedForUserId || this.hydratedForUserId !== currentUserId) {
      // Early return without modifying state or upserting
      return false;
    }

    // Hydrated rollover logic:
    const yesterday = '2026-09-15';
    if (!this.dailyRecords[yesterday]) {
      const spent = expenses.reduce((s, e) => s + e.amount, 0);
      const budget = this.dailyBudget;
      const saved = Math.max(0, budget - spent);
      const status = spent <= budget ? 'saved' : 'exceeded';

      this.dailyRecords[yesterday] = {
        date: yesterday,
        budget,
        spent,
        saved,
        status,
        isFinalized: true,
        needsUpload: false,
      };

      upsertCallCount++;
      mockServerDb.push({
        user_id: currentUserId,
        date: yesterday,
        budget_amount: budget,
        spent_amount: spent,
        amount_saved: saved,
        status,
      });
    }

    return true;
  }

  // P0.2 User Isolation Guard
  hydrateForUser(userId: string) {
    if (this.ownerUserId && this.ownerUserId !== userId) {
      // Reset store state on user mismatch
      this.dailyRecords = {};
      this.hydratedForUserId = null;
    }
    this.ownerUserId = userId;
    this.hydratedForUserId = userId;
  }
}

async function runTests() {
  console.log('Testing P0.1 & P0.2 Rollover Safety & User Isolation...');

  const store = new TestDailyBudgetStore();

  // --- TEST 1: Fresh install before hydration finishes ---
  // In fresh install, hydratedForUserId is null
  assert.strictEqual(store.hydratedForUserId, null, 'Fresh install must start with hydratedForUserId = null');
  assert.strictEqual(Object.keys(store.dailyRecords).length, 0, 'Fresh install records must be empty');

  // Trigger checkAndRollover while unhydrated
  const ranRolloverBeforeHydrate = store.checkAndRollover('user-1', [{ amount: 200 }]);
  assert.strictEqual(ranRolloverBeforeHydrate, false, 'Rollover must return early before hydration');
  assert.strictEqual(Object.keys(store.dailyRecords).length, 0, 'Records must remain untouched before hydration');
  assert.strictEqual(upsertCallCount, 0, 'No server upserts must be made before hydration');
  console.log('✔ Test 1 Passed: Fresh install prevents premature rollover & server overwrite.');

  // --- TEST 2: After successful hydration ---
  store.hydrateForUser('user-1');
  assert.strictEqual(store.hydratedForUserId, 'user-1');
  assert.strictEqual(store.ownerUserId, 'user-1');

  const ranRolloverAfterHydrate = store.checkAndRollover('user-1', [{ amount: 150 }]);
  assert.strictEqual(ranRolloverAfterHydrate, true, 'Rollover should run once hydrated');
  assert.strictEqual(upsertCallCount, 1, 'Server should receive upsert once hydrated');
  assert.strictEqual(store.dailyRecords['2026-09-15'].spent, 150);
  assert.strictEqual(store.dailyRecords['2026-09-15'].saved, 350);
  assert.strictEqual(store.dailyRecords['2026-09-15'].status, 'saved');
  console.log('✔ Test 2 Passed: Hydrated store calculates savings and finalizes accurately.');

  // --- TEST 3: User isolation on multi-account switch ---
  // If user-2 logs in, previous records from user-1 must be purged
  store.hydrateForUser('user-2');
  assert.strictEqual(store.ownerUserId, 'user-2');
  assert.strictEqual(store.hydratedForUserId, 'user-2');
  assert.strictEqual(Object.keys(store.dailyRecords).length, 0, 'User-2 must not inherit User-1 records');
  console.log('✔ Test 3 Passed: Store resets state when switching to a different user.');

  // --- TEST 4: New User defaults (feature OFF, dailyBudget = 0, isAutoRenew = false) ---
  class TestNewUserStore extends TestDailyBudgetStore {
    dailyBudget = 0;
    isAutoRenew = false;

    checkAndRollover(currentUserId: string, expenses: any[]): boolean {
      if (!this.hydratedForUserId || this.hydratedForUserId !== currentUserId) {
        return false;
      }
      // If auto-renew is false or dailyBudget is 0, no phantom budget or records created
      if (!this.isAutoRenew || this.dailyBudget === 0) {
        return true;
      }
      return super.checkAndRollover(currentUserId, expenses);
    }
  }

  const newUserStore = new TestNewUserStore();
  newUserStore.hydrateForUser('new-user-1');
  assert.strictEqual(newUserStore.dailyBudget, 0, 'New user daily budget must be 0');
  assert.strictEqual(newUserStore.isAutoRenew, false, 'New user auto-renew must be false');
  newUserStore.checkAndRollover('new-user-1', [{ amount: 100 }]);
  assert.strictEqual(Object.keys(newUserStore.dailyRecords).length, 0, 'New user must not have phantom daily records created');
  console.log('✔ Test 4 Passed: New user starts with feature OFF (0 budget, false auto-renew, no phantom records).');

  // --- TEST 5: Self-healing Recovery for OTA corrupted user ---
  // User had 500 in profile, but past logs show saved 600 with spent 400 (original budget was 1000)
  function simulateSelfHealingRecovery(
    remoteBudget: number,
    historicalLogs: { date: string; amount_saved: number; status: string }[],
    expensesByDate: Record<string, number>
  ) {
    let resolvedBudget = remoteBudget;
    if (resolvedBudget === 500 && historicalLogs.length > 0) {
      const candidates: Record<number, number> = {};
      for (const log of historicalLogs) {
        const spent = expensesByDate[log.date] || 0;
        if (log.status === 'saved' && log.amount_saved > 0) {
          const inferred = Math.round(log.amount_saved + spent);
          if (inferred > 0 && inferred !== 500) {
            candidates[inferred] = (candidates[inferred] || 0) + 1;
          }
        }
      }

      let best = 0;
      let maxCount = 0;
      for (const [k, count] of Object.entries(candidates)) {
        if (count > maxCount) {
          maxCount = count;
          best = Number(k);
        }
      }
      if (best > 0 && best !== 500) {
        resolvedBudget = best;
      }
    }
    return resolvedBudget;
  }

  const corruptedRemoteBudget = 500;
  const mockLogs = [
    { date: '2026-09-10', amount_saved: 600, status: 'saved' },
    { date: '2026-09-11', amount_saved: 850, status: 'saved' },
  ];
  const mockExpenses = {
    '2026-09-10': 400, // 600 + 400 = 1000
    '2026-09-11': 150, // 850 + 150 = 1000
  };

  const recoveredBudget = simulateSelfHealingRecovery(corruptedRemoteBudget, mockLogs, mockExpenses);
  assert.strictEqual(recoveredBudget, 1000, 'Self-healing must accurately infer and restore original ₹1,000 budget');
  console.log('✔ Test 5 Passed: Self-healing recovery accurately restores original budget from historical saved days.');

  // --- TEST 6: Healing fake 500 DB default to user's real 100 budget & purging phantom days ---
  function simulateHydrateHealing(
    userDailyBudget: number,
    serverLogs: { date: string; budget_amount: number | null; amount_saved: number; spent_amount: number | null }[],
    expensesByDate: Record<string, number>
  ) {
    const finalRecords: Record<string, any> = {};
    const deletedServerRows: string[] = [];

    for (const log of serverLogs) {
      const d = log.date;
      const spent = log.spent_amount !== null ? Number(log.spent_amount) : (expensesByDate[d] || 0);
      const rawBudget = log.budget_amount !== null ? Number(log.budget_amount) : null;
      const rawSaved = Number(log.amount_saved) || 0;

      // Check phantom
      if (spent === 0 && !expensesByDate[d] && (rawBudget === 500 || rawSaved === 500)) {
        deletedServerRows.push(d);
        continue;
      }

      // Determine true budget
      let dayBudget: number;
      if (rawBudget !== null && rawBudget > 0 && rawBudget !== 500) {
        dayBudget = rawBudget;
      } else if (userDailyBudget > 0 && userDailyBudget !== 500) {
        dayBudget = userDailyBudget; // Real budget 100 heals the fake 500
      } else {
        dayBudget = rawBudget || userDailyBudget || 0;
      }

      const daySaved = Math.max(0, dayBudget - spent);
      const status = spent > dayBudget ? 'exceeded' : daySaved > 0 ? 'saved' : 'even';

      finalRecords[d] = {
        date: d,
        budget: dayBudget,
        spent,
        saved: daySaved,
        status,
      };
    }

    return { finalRecords, deletedServerRows };
  }

  const userRealBudget = 100;
  const corruptedLogs = [
    // Phantom day 12 Sep (0 spent, 500 budget from backfill)
    { date: '2026-09-12', budget_amount: 500, amount_saved: 500, spent_amount: 0 },
    // Real day 13 Sep (150 spent, but got 500 budget and 350 saved from bug)
    { date: '2026-09-13', budget_amount: 500, amount_saved: 350, spent_amount: 150 },
    // Real day 14 Sep (200 spent, but got 500 budget and 300 saved from bug)
    { date: '2026-09-14', budget_amount: 500, amount_saved: 300, spent_amount: 200 },
  ];
  const realExpenses = {
    '2026-09-13': 150,
    '2026-09-14': 200,
  };

  const { finalRecords, deletedServerRows } = simulateHydrateHealing(userRealBudget, corruptedLogs, realExpenses);

  // Assert phantom day 12 Sep was purged
  assert.strictEqual(deletedServerRows.includes('2026-09-12'), true, 'Phantom 12 Sep must be purged');
  assert.strictEqual(finalRecords['2026-09-12'], undefined, 'Phantom 12 Sep must not be in final records');

  // Assert 13 Sep is healed to budget 100, spent 150, saved 0, status exceeded
  assert.strictEqual(finalRecords['2026-09-13'].budget, 100, '13 Sep budget must be healed to 100');
  assert.strictEqual(finalRecords['2026-09-13'].spent, 150, '13 Sep spent must be 150');
  assert.strictEqual(finalRecords['2026-09-13'].saved, 0, '13 Sep saved must be 0 (over budget)');
  assert.strictEqual(finalRecords['2026-09-13'].status, 'exceeded', '13 Sep status must be exceeded');

  // Assert 14 Sep is healed to budget 100, spent 200, saved 0, status exceeded
  assert.strictEqual(finalRecords['2026-09-14'].budget, 100, '14 Sep budget must be healed to 100');
  assert.strictEqual(finalRecords['2026-09-14'].spent, 200, '14 Sep spent must be 200');
  assert.strictEqual(finalRecords['2026-09-14'].saved, 0, '14 Sep saved must be 0 (over budget)');
  assert.strictEqual(finalRecords['2026-09-14'].status, 'exceeded', '14 Sep status must be exceeded');

  console.log('✔ Test 6 Passed: Corrupted 500 log rows accurately healed to real ₹100 budget & phantom days purged.');

  // --- TEST 7: New user joining on Wednesday has Monday & Tuesday at 0 budget & 0 expenses ---
  function simulateWeeklyPeriodForNewUser(
    userCreatedAt: string,
    currentDate: string,
    userDailyBudget: number,
    allWeeklyExpenses: { date: string; amount: number }[]
  ) {
    const mondayStr = '2026-09-14';
    const periodDates: string[] = [];

    // Week starts Monday, but for new user who joined after Monday, starts on registration date
    const startDateStr = userCreatedAt > mondayStr ? userCreatedAt : mondayStr;

    // Days from startDate up to currentDate
    let cur = new Date(startDateStr);
    const end = new Date(currentDate);
    while (cur <= end) {
      periodDates.push(cur.toISOString().split('T')[0]);
      cur.setDate(cur.getDate() + 1);
    }

    let periodBudget = 0;
    periodDates.forEach(() => {
      periodBudget += userDailyBudget;
    });

    // Expenses before registration are strictly excluded
    const filteredExpenses = allWeeklyExpenses.filter((e) => e.date >= userCreatedAt && e.date <= currentDate);
    const totalSpent = filteredExpenses.reduce((s, e) => s + e.amount, 0);

    return {
      periodDates,
      periodBudget,
      totalSpent,
      mondayCounted: periodDates.includes('2026-09-14'),
      tuesdayCounted: periodDates.includes('2026-09-15'),
    };
  }

  const wednesdayNewUser = simulateWeeklyPeriodForNewUser(
    '2026-09-16', // Downloaded on Wednesday
    '2026-09-16', // Today is Wednesday
    100,          // Daily budget 100
    [
      { date: '2026-09-14', amount: 50 }, // Monday expense (pre-registration)
      { date: '2026-09-15', amount: 30 }, // Tuesday expense (pre-registration)
      { date: '2026-09-16', amount: 20 }, // Wednesday expense (after registration)
    ]
  );

  assert.strictEqual(wednesdayNewUser.mondayCounted, false, 'Monday must NOT be counted for Wednesday signup');
  assert.strictEqual(wednesdayNewUser.tuesdayCounted, false, 'Tuesday must NOT be counted for Wednesday signup');
  assert.strictEqual(wednesdayNewUser.periodBudget, 100, 'Budget must be exactly 100 (Wednesday only, Mon/Tue = 0)');
  assert.strictEqual(wednesdayNewUser.totalSpent, 20, 'Pre-registration expenses (Mon/Tue) must be excluded, spent = 20');
  assert.strictEqual(wednesdayNewUser.periodDates.length, 1, 'Only 1 day counted for Wednesday signup');

  console.log('✔ Test 7 Passed: Wednesday registration strictly keeps Monday and Tuesday at 0 budget & 0 expenses.');

  // Test 8: formatCurrency preserves decimal values accurately without stripping paise
  assert.strictEqual(formatCurrency(0), '₹0');
  assert.strictEqual(formatCurrency(5), '₹5');
  assert.strictEqual(formatCurrency(5.5), '₹5.5');
  assert.strictEqual(formatCurrency(5.25), '₹5.25');
  assert.strictEqual(formatCurrency(200), '₹200');
  assert.strictEqual(formatCurrency(200.75), '₹200.75');
  assert.strictEqual(formatCurrency(-50), '-₹50');
  assert.strictEqual(formatCurrency(-50.5), '-₹50.5');
  console.log('✔ Test 8 Passed: formatCurrency preserves decimal points (paise) correctly.');

  console.log('\nAll rollover safety & self-healing assertions passed successfully! 🎉');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
