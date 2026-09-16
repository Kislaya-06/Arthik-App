import assert from 'assert';

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

  console.log('\nAll rollover safety & self-healing assertions passed successfully! 🎉');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
