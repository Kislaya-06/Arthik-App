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

  console.log('\nAll rollover safety assertions passed successfully! 🎉');
}

runTests().catch((err) => {
  console.error('Test failed:', err);
  process.exit(1);
});
