# Arthik — Architecture

> **Version:** 2.1.0 APK + OTA updates (November 2026)
> **Platform:** Android (Expo SDK 57, React Native 0.86)
> **Backend:** Supabase (Postgres + Auth + RLS)

---

## 1. System Overview

Arthik is a single-user personal finance mobile app for Android. It operates under two high-level operational modes:
1. **Pure Mode (`is_budget_mode_enabled: false`)**: Pure, unconstrained expense and income tracking with a 4-tab interface, cashflow overview, and the same single expense ring (`DonutChart`) as Budget Mode. Spending is never blocked and may go negative (`SEC-001` amend). Pools ending in Pure retain unspent money as `pureLeftover` without converting to income (`PUR-002`). Switching from Pure to Budget Mode with a deficit automatically creates one balancing income transaction (`PUR-001`).
2. **Budget Mode (`is_budget_mode_enabled: true`)**: Structured financial discipline across three cadences (**Daily**, **Weekly**, **Monthly**), dynamic non-binding pace suggestions, solvency guard (`SEC-001`), automatic period rollovers into a digital **Gullak** (savings reserve), and next-day cadence switching.

Arthik functions as a **Digital Bank Vault** grounded in the foundational **Real-Money Invariant**: every rupee tracked represents real money in the user's possession. Outflows cannot be created in Budget Mode if available liquidity is zero, and mid-cycle switches preserve unspent capital without artificial proration or premature Gullak dumps. The app is built offline-first and syncs to Supabase when connectivity is available.

```
┌──────────────────────────────────────────────────────────────┐
│                        USER DEVICE                           │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │                  React Native App                      │  │
│  │                                                        │  │
│  │  Screens  ──call──►  Zustand Stores  ──write──►  AsyncStorage  │
│  │     │                     │                    (offline queues) │
│  │     └──render◄────state──-┘                            │  │
│  └────────────────────────────────────────────────────────┘  │
│                          │  sync (online only)               │
└──────────────────────────┼───────────────────────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │  Postgres   │
                    │  + Auth     │
                    │  + RLS      │
                    └─────────────┘
```

---

## 2. Layer Map

| Layer | Responsibility | Key Files |
|---|---|---|
| **Entry** | App boot, theme, OTA listener | `App.tsx`, `index.ts` |
| **Navigation** | Screen routing, typed params | `src/navigation/index.tsx`, `src/navigation/navigationRef.ts`, `src/types/index.ts` |
| **Screens** | UI render + dispatch store actions | `src/screens/**` (including `LedgerScreen.tsx`), `src/screens/insights/**`, `src/screens/autolog/**` |
| **Stores** | Business logic, Supabase I/O, offline queues, derived state | `src/store/**`, `src/store/expense/**`, `src/store/dailyBudget/**` |
| **Money** | Turns stored rows into the numbers a card shows; Money Scope = every Home hero / Savings allowance card figure from one call (ADR 0022) | `src/money/**` (`scopeMoney.ts`, `ledger.ts`, …), `src/hooks/useMoneySnapshot.ts` |
| **Pure Helpers** | Stateless calculations, formatters, classifiers, period engine | `src/lib/**` (including `heroDetails.ts`, `splitLedger.ts`, `gapFiller.ts`, `streakCalendarData.ts`, `asyncStorageList.ts`) |
| **Components** | Shared UI atoms, modals, bottom sheets | `src/components/**`, `src/components/split/**`, `src/components/profile/**`, `src/components/savings/**`, `HeroDetailsSheet.tsx`, `WelcomeBackGapModal.tsx`, `SplashCover.tsx` |
| **Hooks** | UI & screen-level state/data aggregation | `src/hooks/**` (including `useInsightsData.ts`, `useExpenseForm.ts`) |
| **Config** | Supabase client, design tokens (Light, Dark, AMOLED) | `src/config/supabase.ts`, `src/config/theme.ts` |
| **Tests** | Vitest unit tests (`npm test`) + Kotlin JUnit for `FinancialFilter` (`npm run test:native`) | `tests/**`, `modules/arthik-autolog/jvm-test/` |
| **Automatic Logging** | On-device SMS / notification / email → transactions | `modules/arthik-autolog/**`, `src/features/autoLog/**` — see [AUTO_LOGGING.md](AUTO_LOGGING.md) |
| **Schema** | Postgres DDL + RLS (source of truth) | `schema.sql` |

### Strict boundary rule
> Screens render UI and dispatch store actions. Screens **never** import Supabase or write to AsyncStorage directly. All I/O is owned by stores.

---

## 3. Stores

Fourteen Zustand stores in `src/store/` (plus the Automatic Logging store in `src/features/autoLog/store.ts`). Each owns a well-defined domain. To avoid monolithic file explosion, high-complexity stores (`dailyBudgetStore`, `expenseStore`) are decomposed into cohesive sub-modules in dedicated subdirectories while maintaining their canonical root export interface (see [ADR 0013](adr/0013-store-module-split.md)). Since the November 2026 facade split, store actions that grew live in submodule factories that receive the store's own `set` / `get` and are spread into the store (`dailyBudget/gullakActions`, `syncActions`, `recordActions`; `expense/mutationActions`, `loadActions`, `failedSyncActions`); pure engines follow the same rule (`budgetPeriods.ts` over `src/lib/periods/*`, `chartUtils.ts` over `src/lib/charts/*`). Every old import path still works.

| Store | Domain | Persisted? | Reset on sign-out? |
|---|---|---|---|
| `authStore` | Session, user profile, sign-in/out | No | — (orchestrates resets) |
| `expenseStore` | Transaction CRUD, offline queues, sync (split: `pendingQueues`, `syncPending`, `payload`, `recoveryMiddleware`, `moneyBack`, `versionProbe`, `saveGuards`, `mutationActions`, `loadActions`, `failedSyncActions`, `types`) | No (manual AsyncStorage) | ✅ `resetExpenses` |
| `dailyBudgetStore` | Multi-cadence budgets, periods, Gullak, streaks (split: see [`maps/daily-budget-map.md`](maps/daily-budget-map.md)) | ✅ `persist` (AsyncStorage key `arthik-daily-budget-storage-v2`) | ✅ `resetDailyBudget` |
| `categoryStore` | User categories, placeholders, cache | No (manual AsyncStorage) | ✅ `resetCategories` |
| `notificationStore` | In-app notification list, unread count | No (manual AsyncStorage) | ✅ `clearNotifications` |
| `networkStore` | Online/offline flag, banner state | No | — |
| `navBarStore` | Bottom navigation bar visibility | No | — |
| `themeStore` | Light / dark / amoled theme | No (reads `Appearance` / AsyncStorage) | — |
| `appLockStore` | Biometric gate, lock/unlock state | No (manual AsyncStorage) | ✅ `reset` |
| `transferRulesStore` | Remembered self-transfer notes (`self_transfer_rules` table) | No | ✅ `reset` |
| `ambientStore` | Ambient background animation state, toggle | ✅ `persist` (AsyncStorage key `arthik-ambient-preference`) | — |
| `otaStore` | Expo OTA update check, pending release highlights, in-app update prompt | No | — |
| `alertStore` | Queue of themed alert dialogs (`AppAlertModal`) | No | — |
| `splashCoverStore` | Mint cover that hides the splash → first screen hand-off | No | — |

### Cross-store wiring (no circular imports)

All cross-store coordination is done via explicit registration callbacks at module evaluation time. See [ADR 0005](adr/0005-cross-store-wiring-via-registration-callbacks.md).

```
expenseStore ─ registerExpenseGetter ──────────► dailyBudgetStore
expenseStore ─ registerExpensesLoadedGetter ───► dailyBudgetStore
expenseStore ─ registerSyncCallback ───────────► networkStore
expenseStore ─ registerStoreResetCallback ─────► authStore
transferRulesStore ─ registerStoreResetCallback ► authStore
categoryStore ─ registerStoreResetCallback ────► authStore
categoryStore ─ registerCategoryDeleteCallback ► expenseStore
dailyBudgetStore ─ registerStoreResetCallback ─► authStore
notificationStore ─ registerStoreResetCallback ► authStore
appLockStore ─ registerStoreResetCallback ─────► authStore
autoLogStore ─ registerStoreResetCallback ─────► authStore
```

---

## 4. Offline-First Write Path

See [ADR 0001](adr/0001-offline-first-asyncstorage-write-path.md) and `docs/optimisation.md` Phase 8 (OPT-60..OPT-64).

```
User action (addExpense / updateExpense / deleteExpense)
        │
        ▼
Optimistic update in Zustand state (pending: true for adds)
        │
        ├─── Online? ─── NO ───► queue in @arthik_pending_*_<userId>  (unchanged)
        │
        └─── Online? ─── YES ──► OPT-60 write-ahead: queue it FIRST (same queue as offline)
                                        │
                                 Supabase request (Promise.resolve → sent once), wait max SAVE_TIMEOUT_MS = 10 s
                                        │
             ┌──────────────────────────┼───────────────────────────────┬──────────────────────────┐
         Success                   Network error                   Refused (DB error)         Timed out
  remove queue entry only if    keep queued, setOffline +      put queue back exactly as    keep queued, stays
  unchanged; refresh offline    banner (unchanged)             before; rollback; throw      "sync pending"; no
  copy (OPT-62)                                                (unchanged)                  banner; late answer
                                                                                            still applied
                                        │
                                 On reconnect / before every online fetch (networkStore, fetchExpenses)
                                        │
                                 syncPendingExpenses(): deletes → adds → updates → flushSideQueues
                                 (settings, daily records, periods, plan changes, Gullak, categories, profile, cache)
                                 retry with exponential backoff [2s, 5s, 15s, 30s, 60s], max 5 attempts
                                        │
                                 Still failing? ──────────► @arthik_failed_sync_<userId>
                                                            (user can retry or discard)
```

Every queue read→change→write runs under `runExclusive(key)` (`src/lib/queueLock.ts`, OPT-61), so two writers can never
overwrite each other. This covers the budget and category side queues too (OPT-72, `OFL-001`): settings, plan changes,
budget periods, Gullak adds / deletes, category adds / updates / deletes and remembered transfer notes. A flush never
writes back the copy it read BEFORE the request: it re-reads the queue under the lock and removes only the items the
server confirmed (`removeFromStoredList`, `clearSentPendingSettings`), so something queued while the request was in
flight is kept. Any queued profile setting is sent on reconnect (weekly / monthly amount, cadence and mode too), and
remembered transfer notes (`syncPendingTransferRules`) are sent BEFORE the expenses that point to them. Adds are idempotent (`upsert … ignoreDuplicates` + `.maybeSingle()`: a row already on the server
counts as saved, OPT-62).

**AsyncStorage keys per user:**

| Key | Content |
|---|---|
| `@arthik_pending_expenses_<userId>` | Pending creates |
| `@arthik_pending_updates_<userId>` | Pending updates |
| `@arthik_pending_deletes_<userId>` | Pending deletes |
| `@arthik_failed_sync_<userId>` | Permanently failed items |
| `@arthik_cached_expenses_<userId>` | Cold-start expense cache |
| `@arthik_cached_categories_<userId>` | Cold-start category cache |
| `@arthik_cached_transfer_rules_<userId>` | Saved remembered self-transfer notes (offline matching, OPT-73) |
| `@arthik_pending_transfer_rules_<userId>` | Remembered notes made offline, sent before the expenses (OPT-73) |
| `@arthik_pending_deficit_check_<userId>` | Cold-start PUR-001 deficit check still to run (activation date, FIN-16) |
| `@arthik_pending_settings_<userId>` | Pending profile budget changes |
| `@arthik_app_lock_enabled` | Global biometric lock preference |
| `@arthik_app_lock_enabled_<userId>` | Per-user biometric lock preference |
| `arthik-daily-budget-storage-v2` | Persisted Zustand daily budget slice |

---

## 5. Startup Hydration Sequence

The order is load-bearing. Categories **must** be in memory before `hydrateFromSupabase` runs `checkAndRollover`, or income classification will miscount expenses as spending.

**Offline-first (`OFL-001`, OPT-71):** the splash screen opens from the data saved ON THE PHONE and never waits for the
server. `runLocalFirstStartup` (`src/lib/startupLoad.ts`) runs two steps in this order:

```
SplashScreen (cold start)
    │
    ├─ session: supabase.auth.getSession() (capped 2 s) → else restoreOfflineSession() (saved user + profile)
    │     setSession(): a saved profile is enough, the profile request runs in the background (OPT-71)
    │     the connectivity check (NetInfo, capped 1.5 s) runs in parallel and is NOT waited for
    │
    └─ runLocalFirstStartup({ loadLocalData, refreshFromServer })
         │
         ├─ loadLocalData (storage reads only):
         │     loadPendingExpenses → loadCachedCategories → loadCachedExpenses → appLock.init
         │     → returns { hasCachedExpenses }
         │
         ├─ the splash exit animation ends and the app opens          ← usually < 1 s, any network
         │
         └─ refreshFromServer (background, errors swallowed):
               await connectivity → fetchCategories(true) → Promise.all([fetchExpenses(), hydrateFromSupabase(userId)])
               → syncPendingExpenses (queues, reconnect)
```

Only a phone with NO saved expenses yet (first run) lets the splash wait for `refreshFromServer`, for at most 5 s
(`FIRST_RUN_WAIT_MS`), because there is nothing to show before it. `hydrateFromSupabase` is single-flight per user: the
splash, the Home screen and the sign-in listener share one run (no duplicate requests). A scheduled Pure ↔ Budget
switch that matured while the app was closed is applied by this hydration with the same auto-save rule as the midnight
rollover (`resolveAutoRenewForPlan`, `PUR-003`), and the PUR-001 deficit check waits for server-fresh expenses
(`deficitCheck.ts`).

The sign-in listener in `App.tsx` (`SIGNED_IN`) still runs the sequential chain `loadPendingExpenses → fetchCategories(true)
→ Promise.all([fetchExpenses, hydrateFromSupabase])` (a brand-new login has nothing saved yet).

---

## 6. Budget Modes, Cadence Periods & Gullak Engine

See [`docs/adr/0010-budget-cadence-periods.md`](adr/0010-budget-cadence-periods.md), [`docs/adr/0011-zero-proration-and-digital-vault-spending-guard.md`](adr/0011-zero-proration-and-digital-vault-spending-guard.md), and [`docs/maps/daily-budget-map.md`](maps/daily-budget-map.md).

### 6.1 Multi-Cadence Budget Architecture
Arthik supports three distinct budget cadences:
- **Daily**: Day-by-day allowance renewed each midnight.
- **Weekly**: Calendar weeks starting Monday 00:00:00 and ending Sunday 23:59:59.
- **Monthly**: Calendar months starting on the 1st and ending on the final calendar day (28, 29, 30, or 31 days).

### 6.2 Zero-Proration Policy & Dynamic Pacing Guidance
Entered budgets are **never scaled down or prorated** due to mid-cycle starts or switches. The full user-entered budget becomes active immediately for the remainder of the period (`isProrated: false`). Dynamic non-binding guidance is calculated by `getCurrentPeriodSummary`:
- **Daily Pace**: `remainingBudget / remainingDays`
- **Weekly Pace**: `(remainingBudget / remainingDays) * 7`
- **Projected Monthly Budget**: `(weeklyBudget / 7) * daysInMonth`

### 6.3 Next-Day Mode & Cadence Switching (`PUR-003`) & Carry-Forward Engine
- Switching cadences as well as toggling between Pure Mode and Budget Mode takes effect **tomorrow at 12:00 AM (00:00:00)** (`computeEffectiveFrom`), allowing today's budget and transactions to conclude cleanly under the active plan. Exception: new accounts on day one or any account with 0 expenses logged enable Budget Mode immediately on "Today" (`BPR-002` #3).
- **Same-Day Reversal Protection (`PUR-003`)**: If a user switches modes (scheduled for tomorrow) and toggles back on the same day, the pending switch is immediately cancelled (`handleCancelPendingPlanChange`), scheduled notifications are removed, and the app seamlessly remains in its currently active mode with zero glitches.
- **Pure Mode Hero Card Details Guard**: In Pure Mode, Hero Card tap is disabled and "Tap the card for details" hint is hidden (`GUL-002`).
- **Zero Mid-Cycle Gullak Dumps (Golden Invariant)**: Mid-cycle cadence switching carries unspent funds forward into the new cadence rather than prematurely dumping them into Gullak (`amountSaved = 0`).
- **Carry-Forward Modes (CAR-001)**:
  - **Additive (`'additive'`)**: Remaining balance is added once on top of the first period's target budget ceiling (`targetBudget + carriedOverAmount`) via `carryForPeriod`.
  - **Allocation (`'allocation'`)**: Carried funds $U$ provide multi-period drawdown across Daily, Weekly, and Monthly targets:
    - Daily: `dailyCarryForDate`, `dailyCarryRemaining`.
    - Weekly & Monthly: `periodCarryForPeriod`, `periodCarryRemaining`. In each period $k$, $\text{funded}_k = \min(B, \text{remaining}_{k-1})$ and user gap $\text{toAdd}_k = B - \text{funded}_k$.
    - **All-Pill Zero Double-Counting**: In `homeCalculations` and `metrics.ts`, only the carry-FUNDED part of a period budget is excluded from the All pill (`pc.funded`); the gap part counts like any budget and real money added grows it by exactly that amount. Home and the account total are always the same number.
    - **Lifecycle Notifications**: Scheduled at period start (08:30) for fully funded periods and partial gap periods, and exactly one "carried money has run out" notice on the first unfunded day / week / month (`buildCarryEnds`), then silence.
- **Deficit Isolation**: Overspent periods are settled from available income/Gullak reserves; they clamp to 0 (`Math.max(0, ...)`) and never carry negative debt into a new cadence.

### 6.4 Natural Cycle Rollover vs. Mid-Cycle Switches
Gullak savings deposits happen **exclusively upon the natural completion of a full cycle**:
- Daily at 23:59:59 $\to$ unspent daily allowance saved to Gullak.
- Weekly on Sunday at 23:59:59 $\to$ unspent weekly allowance saved to Gullak.
- Monthly at month-end 23:59:59 $\to$ unspent monthly allowance saved to Gullak.

### 6.5 Digital Vault Spending Guard
Arthik operates as a financial bank vault (`src/lib/vaultSpendingGuard.ts`):
- If total net liquid funds across the entire account (`accountRemaining`) equal ₹0 or negative, outflow (expense) creation is blocked at the input boundary (`canAddExpense: false`).
- Users are prompted to add income or configure their allowance before spending money that does not exist.
- Overspending past daily, weekly, or monthly allowance (e.g. "Over by ₹1,000 this week") is fully permitted when backed by available unspent income or Gullak reserves. It only blocks when all account liquidity is exhausted.

### 6.6 Gullak Total Accumulated Savings Formula

```
totalAccumulatedSavings = Σ(DailyRecord.saved for finalized days)
                        + Σ(BudgetPeriodRecord.amountSaved for finalized weekly/monthly periods)
                        + Σ(GullakDeposit.amount for all deposits)
                        − Σ(DailyRecord overspend not covered by income)
```
Overspending from allowances is absorbed by available income first before any deduction from Gullak savings.

### 6.7 Income classification (unified, single engine)

See [ADR 0023](adr/0023-one-transaction-classifier.md). One classifier in `src/lib/transactionUtils.ts`, which takes the row only (never a category):
- `classifyTransaction(row)` → `spending` / `income` / `moneyBack` / `selfTransfer`; totals ask `isCountedIncome(row)` / `isCountedExpense(row)`, built on it.
- `isIncomeTransaction(row)` is the direction only (`type === 'income'`, `TXN-001`), for display. A row without `type` is spending, like the database default (`TXN-002`).

Categories have a side (`categories.kind` = `'expense'` | `'income'`, rule `CAT-004`, [ADR 0019](adr/0019-income-categories.md)). The side only decides which picker shows a category; it never decides direction. Helpers: `categoryKindOf`, `categoriesOfKind` in `src/store/categoryStore.ts`.

Self-transfers are identified ONLY by `transaction_class === 'self_transfer'` (`TXN-003`); notes and category names are never used to guess one.

**Split & money back (`SPL-001..SPL-006`)**: a third class, `transaction_class === 'recovery'`, marks money that came back for an expense already paid. It is excluded from income and expense totals like a self-transfer, and instead lists the expenses it went back to (`recovery_allocations`). `src/lib/splitLedger.ts` (pure) derives who owes what and plans settlements. Refunds on multi-person split expenses support interactive recipient attribution (Solution 2: `refund_target` in `recovery_allocations`), allowing proportional fair splits or targeted participant/user allocation so one person's settlement never falsely zeroes out another friend's debt. `src/store/expense/recoveryMiddleware.ts` wraps the expense store so that every write of `expenses` recomputes each expense's COUNTED amount (`amount paid − money back`); the paid amount stays in `gross_amount` (store-only, never sent to the database). Because the waterfall and day rollover already re-run on every expense change, money returns to its original budget day / income pool / Gullak with no extra source tracking. `src/store/expense/moneyBack.ts` records money back (and converts an already logged income); `src/store/expense/payload.ts` sends the new columns only when a row uses them.

### 6.8 Multi-Cadence Insights & Period Rollover Reconciliation (`INS-002`, `HEA-002`)
Insights breathing strips reconcile savings across all budget cadences without relying on nonexistent daily records for non-daily modes:
- **Weekly & Monthly Cadence Savings**: Weekly and Monthly insights aggregate finalized savings directly from `budget_periods` (`status === 'saved'`). Cross-month weekly periods attribute their savings at `activeEnd` matching true cash accounting rollovers.
- **Mid-Interval Cadence Switching**: Daily records and period slices combine additively (`autoSaved = dailySaved + periodSaved`) ensuring zero data loss and exact reconciliation.
- **Option 2 (Month Budget Share %)**: When monthly cadence users view the Weekly Insights tab, the second card renders `MONTH BUDGET SHARE` (showing current week's spend percentage of total monthly pool, status badge `On Track` (mint dot, ≤ 25%) / `High Burn` (coral dot, > 25%) / `Critical Burn` (coral dot, > 50%), drawn icons instead of emoji (`pillIcon`, INS-002), and contextual subtext `₹X of ₹Y pool`) paired with cadence-aware discipline takeaways.

---

## 7. Auth & Security

See [ADR 0004](adr/0004-supabase-anon-key-and-user-scoped-rls.md).

- **Auth**: Supabase email + password and Google OAuth (PKCE, `expo-auth-session`)
- **Keys**: Only `anon` key in bundle. Never `service_role`.
- **RLS**: Every table enforces `user_id = auth.uid()` on all operations.
- **Provisioning**: Default profile + categories created via `SECURITY DEFINER` trigger `handle_new_user()`.
- **Account deletion**: Delegated to Supabase Edge Function `delete-user-account` (requires `service_role` which is never client-side), followed by complete device data wipe (unlinking local encrypted AutoLog SQLCipher database, purging SecureStore keys, and `AsyncStorage.clear()`).
- **Deep links**: All auth deep links parsed and validated in `src/lib/authLinkHandler.ts`. Session fixation guard prevents switching accounts via crafted deep links.
- **Biometric App Lock**: `expo-local-authentication`. Preference stored in AsyncStorage (global + per-user key). Authentication required to toggle on or off.
- **Android backup**: Disabled (`allowBackup: false` in `app.json`) to prevent AsyncStorage extraction via `adb backup`.

---

## 8. Navigation

React Navigation v7 with:
- **Root Stack**: `NativeStack` — `Splash`, `Onboarding`, `Auth`, `ProfileSetup`, `AppTabs`, `AddExpense`, `EditExpense`, `ExpenseDetail`, `GullakDepositDetail`, `CategoryDetail`, `ManageCategories`, `AddEditCategory`, `Ledger`, `Notifications`, `Profile`, `Savings`, `ResetPassword`, `Faq`, and the Automatic Logging screens (`AutoLogIntro`, `AutoLogSetup`, `AutoLogCenter`, `AutoLogReview`, `AutoLogAccounts`, `AutoLogEmail`, `AutoLogInfo`, `AutoLogWelcomeBack`). `UpdateRequiredScreen` is not a route: `App.tsx` shows it instead of the navigator when a force update is on.
- **Tab Navigator** (inside Root Stack as `AppTabs`):
  - Tab screens: `Home`, `History`, `Savings`, `Insights`; the centre **Add** button is drawn by `BottomNavBar` and opens `AddExpense`.
  - **Pure Mode** shows Home, History, Add, Insights; opening `Savings` redirects to `Home`. **Budget Mode** shows Home, Savings, Add, History, Insights.

Cold start: `Splash` ends on solid mint, `useSplashCoverStore.show()` turns on the always-mounted mint `SplashCover` (App.tsx), `navigation.replace` swaps the route underneath, and `revealSoon()` dissolves the cover once the destination has laid out (hard cap 1.4s).

All routes typed in `src/types/index.ts` (`RootStackParamList`, `TabParamList`). Imperative navigation via `navigationRef`. Guard back actions with `navigation.canGoBack()`.

---

## 9. UI & Motion System

- **9.1 Theme & Design Tokens**: `src/config/theme.ts` — `LightColors`, `DarkColors`, `AmoledColors`, `Spacing`, `BorderRadius`, `FontSize`, `FontFamily`, `ControlHeight`. 3-theme picker supported on Profile (Light, Dark, AMOLED).
- **9.2 Rolling-Digit Numbers (`RollingText`)**: Vertical digit-by-digit odometer rolling animations on amount updates across Home, Savings, Insights, and Category Details. Instant static presentation on screen focus without delay. Runs natively on the UI thread without layout shifts or text spasms. Premium feel: 240ms soft-landing ease, 10ms left-to-right digit ripple, with unchanged digits remaining static and `forceSpin` available for filter transitions. Zero-flash synchronous render planning prevents any 1-frame static leak of new values before wheels mount.
- **9.2b Squish toggle (`AnimatedToggle`, `src/lib/toggleMotion.ts`)**: the single on/off switch used on Profile (4), Savings Budget Hub, Split, Self-transfer and AutoLog accounts. Press stretch, mid-trip stretch, landing squash, opacity colour cross-fade, selection haptic, reduce-motion support. ON = filled track (mint by default) with a contrasting thumb (`toggleThumbOnColor`); no ON/OFF words. Whole animation runs on the UI thread.
- **9.1a UI consistency contract (ADR 0021)**: every pushed page uses `ScreenHeader` (48dp bar, `HeaderBackButton` = 24px arrow / 44dp touch / dim on press, right actions, 20px title centred on the bar with a symmetric inset, announced as a heading); main tabs keep the 28px left-aligned title. Tappable rows / icons / chips dim to `PRESS_DIM_OPACITY` (0.7, `src/lib/pressFeedback.ts`); real buttons are `AppButton` (scale 0.97). Button size ladder: 60 for page / bottom-sheet buttons (and every button stacked with one), 48 for centered dialogs and full-width buttons inside a card, 36 for small pill actions; heights always from `ControlHeight`. Every popup dims the screen with `useScrimColor()` (`src/lib/scrim.ts`). `AppButton variant="danger"` uses the alert dialog's readable red. Empty pages / lists / cards use `EmptyState` (gradient badge + title + one line + optional compact button, `screen` / `section` size). Small uppercase labels share `LetterSpacing.label` (0.8). See [ADR 0021](adr/0021-ui-consistency-contract.md).
- **9.2a Segmented pills (`SegmentedControl`, `src/lib/segmentedMotion.ts`)**: Liquid two-edge pill (stretches in flight, distance-aware trailing spring, lands exactly in ~285ms), label colour cross-fade by pill position, tick on real change (+ iOS landing tick), reduce-motion aware. The pill is drawn transform-only (two round caps + a scaled flat middle + one `boxShadow` box, `pillPiecesFor`), never by animating `width`. Heavy screens use `commitOnSettle`: `onChange` arrives only when the pill has LANDED (both edges within 1px, `pillLandingMs`), because any React commit pauses Reanimated's UI commits until it is mounted. A touch fence (`src/lib/selectionCommitFence.ts`, flushed from `App.tsx`'s root `onTouchStart`) delivers a pending value before any other touch, so a form can never save a stale value. See [ADR 0020](adr/0020-transform-only-pills-and-commit-after-landing.md).
- **9.3 Ambient Background & Light Flow (`AmbientBackground`, `ambientStore`)**: Subtle, organic blurred gradient light bands moving slowly across the top of the screen surface. Automatically throttled/paused when tab/screen loses focus (`useSafeIsFocused`), app goes to background (`useAppActive`), or `useReduceMotion()` is active. User-toggleable in Profile.
- **9.4 Home Pull-to-Refresh & Pull-to-History Physics (`PullToHistoryList`, `pullToHistoryPhysics.ts`)**: Replaces default scroll view with unified drag, momentum, and pull-up gestures. Calibrated Instagram Vanish-mode spring physics (stiffness 42, damping 11.6, ~0.88 damping ratio) with countdown progress ring. Pull-down uses unified native refresh circle (`AppRefreshControl`) with haptic feedback and throttle cooldown.
- **9.5 Icons & Badges**: `lucide-react-native` (1.24+). Feature icons and badges strictly utilize `GradientIconBadge`.
- **9.6 Charts**: `react-native-svg` (15.15) — animated donut rings (Home ring in both modes), and gradient flow bars.
- **9.7 Safe Area & Bottom Nav**: `useSafeAreaInsets` from `react-native-safe-area-context`. Floating capsule `BottomNavBar` driven by `navBarStore` + `useScrollDirection`. All nav SPACING (bottom gap above system navigation, side margin, center + slot, label room) comes from `src/lib/navBarLayout.ts` via `useNavBarMetrics`; tab screens use `useNavBarContentInset()` for bottom padding and Home uses `getNavTopOffset(inset, width)`, so the bar and the content never disagree. The tab animation itself (per-tab capsule fade, label expand, icon press bounce) is unchanged.

---

## 10. Notifications Architecture

See [`docs/notifications.md`](notifications.md) for the full product specification. The single source of truth is [`src/lib/notificationPolicy.ts`](../src/lib/notificationPolicy.ts) (tested via `tests/notificationPolicy.test.ts`).

- **Deliver Every Necessary Notification**: each scheduled message fires when its trigger is met; there is no per-day cap (a morning Gullak reward and an evening recap can both arrive on the same day).
- **Never-Nag Invariant**: Evening nudge (20:30) exists only on days with zero expenses logged, and goes quiet after 3 consecutive unopened evenings. Logging an expense immediately cancels tonight's nudge via `notificationSync.ts`.
- **Morning Gullak Reward**: Fires at 08:30 next morning for daily cadence users when yesterday was logged and ended with savings.
- **Periodic Recaps**: Sunday 19:00 weekly recap (≥ 3 expenses) and month-end 21:00 monthly recap (≥ 6 expenses).
- **In-App Bell vs. OS Push Separation**: Actions triggered by the user's active session (80% budget limit reached, rollover notice, budget plan updates) stay strictly in-app (`notificationStore`), capped at 50 items with read/unread tracking. Crossing the budget limit triggers a silent banner.
- **Android Channels**: 4 lazily registered channels (`Budget alerts`, `Reminders`, `Gullak updates`, `Weekly & monthly recaps`), each individually mutable in system settings.

---

## 11. OTA Updates & Deployment

See [ADR 0006](adr/0006-ota-updates-tied-to-app-version.md).

| Scenario | Command | Requires new APK? |
|---|---|---|
| JS/TS/UI fix, `app.json` OTA highlights | `eas update --branch preview --environment preview` | No |
| New native module or permission | `eas build -p android --profile preview` | **Yes** |
| Native `app.json` config (plugins, permissions, android / ios keys) | `eas build -p android --profile preview` | **Yes** |
| Version bump | Both build + update | **Yes** |

`runtimeVersion.policy = "appVersion"` — OTA only reaches devices on the exact matching `expo.version`.

**Force update (v2):** `app_config.version_control` → `UpdateRequiredScreen` (no skip). v2+ downloads the APK in-app (`src/lib/apkInstaller.ts`) and opens Android's installer; v1.x opens `release_url` in the browser. Release assets: `Arthik-vX.Y.Z.apk` + copy `Arthik.apk`. Full playbook: [RELEASE_PROCESS.md](RELEASE_PROCESS.md).

### 11.1 Release Invariants
- **In-App Update Modal Highlights (`OtaUpdateModal`)**: When publishing an OTA release without bumping the version, always update `app.json` (`expo.extra.otaUpdate.title` and `expo.extra.otaUpdate.highlights`) and `src/store/otaStore.ts` to ensure the on-device update popup displays accurate "What's New" information to users upon downloading the update.
- **Version Bump Guard & Pre-OTA Confirmation (CRITICAL)**: Because OTA bundles only target matching `appVersion` binaries, publishing an OTA update with a bumped version that does not match the user's installed APK runtime will cause the update to be ignored by all user devices. The agent must verify `app.json` / `package.json` version before every OTA run, and MUST stop and request explicit user confirmation whenever a version bump is present. Version bumps are permitted only when specifically requested by the user for new binary builds, with mandatory confirmation before execution.

---

## 12. Test Architecture

See [ADR 0009](adr/0009-vitest-unit-test-coverage.md).

**Framework**: Vitest (v5), `npm test` → `vitest run`, config at `vitest.config.mjs`.

Tests live in `tests/<subject>.test.ts`; the file name says what it covers. Run `npm test` for the current count (docs do not record it). Conventions:
- **Money and rules**: a test that protects a canonical rule names the rule ID (`BUD-008`, `CAR-001`, `SPL-003` …) in its title.
- **Change records**: `opt<NN>…`, `sec<NN>…` and `ux<NN>…` files guard the matching item in [`optimisation.md`](optimisation.md) or the UX rounds.
- **Automatic Logging**: `autoLog*.test.ts`; flow tests use `tests/helpers/autoLogTestEnv.ts` (real db + engine + service on `node:sqlite`, fake native / ledger / server).
- **Source-reading tests** (UI contracts such as `uiConsistency`, `pillButterySmooth`, `buttonSizeLadder`) read split files through `tests/helpers/readSplitSource.ts`, so a pure code move never changes an assertion.
- **Date-dependent tests** freeze the clock (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`).
- **Native**: `npm run test:native` runs the Kotlin JUnit tests for `FinancialFilter` (`modules/arthik-autolog/jvm-test/`, never packaged).

---

## 13. Key ADRs

| # | Decision | Status |
|---|---|---|
| [0001](adr/0001-offline-first-asyncstorage-write-path.md) | Offline-first with AsyncStorage queues | Active |
| [0002](adr/0002-income-inferred-from-category-keywords.md) | Income inferred from category keywords | Retired (removed by 0023, `TXN-002`) |
| [0003](adr/0003-zustand-stores-as-sole-data-access-layer.md) | Zustand as sole data-access layer | Active |
| [0004](adr/0004-supabase-anon-key-and-user-scoped-rls.md) | Supabase anon key + RLS | Active |
| [0005](adr/0005-cross-store-wiring-via-registration-callbacks.md) | Cross-store via registration callbacks | Active |
| [0006](adr/0006-ota-updates-tied-to-app-version.md) | OTA tied to app version | Active |
| [0007](adr/0007-income-classification-divergence.md) | Dual-engine income divergence | **Superseded by 0008** |
| [0008](adr/0008-unified-income-classification.md) | Unified income classification | **Superseded by 0023** |
| [0009](adr/0009-vitest-unit-test-coverage.md) | Vitest unit test coverage policy | Active |
| [0010](adr/0010-budget-cadence-periods.md) | Multi-Cadence Budget Modes and Period Engine | Active (D4 superseded by 0011, amended by 0012) |
| [0011](adr/0011-zero-proration-and-digital-vault-spending-guard.md) | Zero-Proration Policy and Digital Vault Spending Guard | Active (amended by 0012, amended by canonical `SEC-001`) |
| [0012](adr/0012-one-budget-per-calendar-period.md) | One Budget per Calendar Period, and Pure Mode Keeps the Same Books | Active (D2/D3/D7 amended by canonical `PUR-002`, `PUR-003` & `SEC-001`) |
| [0013](adr/0013-store-module-split.md) | Store Helper Decomposition and Module Encapsulation | Active |
| [0014](adr/0014-canonical-rules-and-implementation-status.md) | Canonical Rules File, Retired Split Feature, and CAR-001 / Pure Mode Status | Active |
| [0015](adr/0015-ui-thread-reanimated-worklet-migration-and-render-optimizations.md) | UI-Thread Reanimated Worklet Migration and Render Optimizations | Active |
| [0016](adr/0016-split-expenses-and-money-back.md) | Split Expenses, Money Back and Refunds | Active |
| [0017](adr/0017-money-layer-and-payback-review.md) | Unified Money Layer and Payback Review Resolution | Active |
| [0018](adr/0018-settle-review-choose-then-confirm.md) | Payback Review: Choose the Person, Then Confirm | Active |
| [0019](adr/0019-income-categories.md) | Income Categories and Required Category on Review | Active |
| [0020](adr/0020-transform-only-pills-and-commit-after-landing.md) | Transform-Only Pills, Commit After Landing, and the Touch Fence | Active |
| [0021](adr/0021-ui-consistency-contract.md) | UI Consistency Contract: Back Button, Press Feedback, Button Heights, Scrim | Active |
| [0022](adr/0022-money-scope-module.md) | Money Scope Module: Screens Get Card Figures from `src/money` Only | Active |
| [0023](adr/0023-one-transaction-classifier.md) | One Transaction Classifier, No Categories (TXN-002 Retired) | Active |
| [0024](adr/0024-architecture-review-candidates-not-pursued.md) | Architecture Review Candidates Not Pursued (Expense Sync, Budget Period, Insights Data) | Active |

