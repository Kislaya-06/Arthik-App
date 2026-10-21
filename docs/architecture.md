# Arthik — Architecture

> **Version:** v2.1.0 (October 2026)
> **Platform:** Android (Expo SDK 57, React Native 0.86)
> **Backend:** Supabase (Postgres + Auth + RLS)

---

## 1. System Overview

Arthik is a single-user personal finance mobile app for Android. It operates under two high-level operational modes:
1. **Pure Mode (`is_budget_mode_enabled: false`)**: Pure, unconstrained expense and income tracking with a 4-tab interface, cashflow overview, and concentric Dual Ring chart. Spending is never blocked and may go negative (`SEC-001` amend). Pools ending in Pure retain unspent money as `pureLeftover` without converting to income (`PUR-002`). Switching from Pure to Budget Mode with a deficit automatically creates one balancing income transaction (`PUR-001`).
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
| **Pure Helpers** | Stateless calculations, formatters, classifiers, period engine | `src/lib/**` (including `heroDetails.ts`, `splitLedger.ts`, `gapFiller.ts`, `streakCalendarData.ts`, `asyncStorageList.ts`) |
| **Components** | Shared UI atoms, modals, bottom sheets | `src/components/**`, `src/components/split/**`, `src/components/profile/**`, `src/components/savings/**`, `HeroDetailsSheet.tsx`, `WelcomeBackGapModal.tsx`, `SplashCover.tsx` |
| **Hooks** | UI & screen-level state/data aggregation | `src/hooks/**` (including `useInsightsData.ts`, `useExpenseForm.ts`) |
| **Config** | Supabase client, design tokens (Light, Dark, AMOLED) | `src/config/supabase.ts`, `src/config/theme.ts` |
| **Tests** | Vitest unit tests (121 files, 1794 tests) | `tests/**` |
| **Automatic Logging** | On-device SMS / notification / email → transactions | `modules/arthik-autolog/**`, `src/features/autoLog/**` — see [AUTO_LOGGING.md](AUTO_LOGGING.md) |
| **Schema** | Postgres DDL + RLS (source of truth) | `schema.sql` |

### Strict boundary rule
> Screens render UI and dispatch store actions. Screens **never** import Supabase or write to AsyncStorage directly. All I/O is owned by stores.

---

## 3. Stores

Twelve core Zustand stores (plus AutoLog store). Each owns a well-defined domain. To avoid monolithic file explosion, high-complexity stores (`dailyBudgetStore`, `expenseStore`) are decomposed into cohesive sub-modules in dedicated subdirectories while maintaining their canonical root export interface (see [ADR 0013](adr/0013-store-module-split.md)).

| Store | Domain | Persisted? | Reset on sign-out? |
|---|---|---|---|
| `authStore` | Session, user profile, sign-in/out | No | — (orchestrates resets) |
| `expenseStore` | Transaction CRUD, offline queues, sync (split: `pendingQueues`, `syncPending`, `payload`, `recoveryMiddleware`, `moneyBack`, `types`) | No (manual AsyncStorage) | ✅ `resetExpenses` |
| `dailyBudgetStore` | Multi-cadence budgets, periods, Gullak, streaks (split: `classifiers`, `expenseBridge`, `hydrate`, `metrics`, `pendingStorage`, `planActions`, `rollover`, `selfHealing`, `types`) | ✅ `persist` (AsyncStorage key `arthik-daily-budget-storage-v2`) | ✅ `resetDailyBudget` |
| `categoryStore` | User categories, placeholders, cache | No (manual AsyncStorage) | ✅ `resetCategories` |
| `notificationStore` | In-app notification list, unread count | No (manual AsyncStorage) | ✅ `clearNotifications` |
| `networkStore` | Online/offline flag, banner state | No | — |
| `navBarStore` | Bottom navigation bar visibility | No | — |
| `themeStore` | Light / dark / amoled theme | No (reads `Appearance` / AsyncStorage) | — |
| `appLockStore` | Biometric gate, lock/unlock state | No (manual AsyncStorage) | ✅ `reset` |
| `transferRulesStore` | Remembered self-transfer notes (`self_transfer_rules` table) | No | ✅ `reset` |
| `ambientStore` | Ambient background animation state, toggle | ✅ `persist` (AsyncStorage key `arthik-ambient-preference`) | — |
| `otaStore` | Expo OTA update check, pending release highlights, in-app update prompt | No | — |

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

See [ADR 0001](adr/0001-offline-first-asyncstorage-write-path.md).

```
User action (addExpense)
        │
        ▼
Optimistic update in Zustand state (pending: true)
        │
        ├─── Online? ─── YES ──► Supabase upsert
        │                              │
        │                        Success? ─ YES ──► clear pending flag, update state with server row
        │                              │
        │                        Error? ──────────► queue in @arthik_pending_expenses_<userId>
        │                                           (same path as offline)
        │
        └─── Online? ─── NO ───► queue in @arthik_pending_expenses_<userId>
                                        │
                                 On reconnect (networkStore)
                                        │
                                 syncPendingExpenses() ──► retry with exponential backoff
                                        │                   [2s, 5s, 15s, 30s, 60s], max 5 attempts
                                        │
                                 Still failing? ──────────► @arthik_failed_sync_<userId>
                                                            (user can retry or discard)
```

**AsyncStorage keys per user:**

| Key | Content |
|---|---|
| `@arthik_pending_expenses_<userId>` | Pending creates |
| `@arthik_pending_updates_<userId>` | Pending updates |
| `@arthik_pending_deletes_<userId>` | Pending deletes |
| `@arthik_failed_sync_<userId>` | Permanently failed items |
| `@arthik_cached_expenses_<userId>` | Cold-start expense cache |
| `@arthik_cached_categories_<userId>` | Cold-start category cache |
| `@arthik_pending_settings_<userId>` | Pending profile budget changes |
| `@arthik_app_lock_enabled` | Global biometric lock preference |
| `@arthik_app_lock_enabled_<userId>` | Per-user biometric lock preference |
| `arthik-daily-budget-storage-v2` | Persisted Zustand daily budget slice |

---

## 5. Startup Hydration Sequence

The order is load-bearing. Categories **must** be in memory before `hydrateFromSupabase` runs `checkAndRollover`, or income classification will miscount expenses as spending.

```
App boot (App.tsx: auth state listener fires)
    │
    ├─ await loadPendingExpenses()         # restore offline queue into state
    ├─ await fetchCategories(true)         # categories must be loaded FIRST
    └─ await Promise.all([
           fetchExpenses(),                # fetch confirmed expenses from Supabase
           hydrateFromSupabase(userId),    # restore budget records, run checkAndRollover
       ])
           │
           └─ if online: syncPendingExpenses()   # flush any queued offline writes
```

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
- Switching cadences as well as toggling between Pure Mode and Budget Mode takes effect **tomorrow at 12:00 AM (00:00:00)** (`computeEffectiveFrom`), allowing today's budget and transactions to conclude cleanly under the active plan.
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

See [ADR 0008](adr/0008-unified-income-classification.md). Single function `isIncomeTransaction(item, category)` in `src/lib/transactionUtils.ts` is used everywhere:
1. Check `item.type === 'income'` → true
2. Check `item.type === 'expense'` → false
3. Inert legacy fallback (rule `TXN-002`, only for old rows with no `type`; the database makes `type` NOT NULL): match `category.name` against `DEFAULT_INCOME_KEYWORDS`

Self-transfers are identified ONLY by `transaction_class === 'self_transfer'` (`TXN-003`); notes and category names are never used to guess one.

**Split & money back (`SPL-001..SPL-006`)**: a third class, `transaction_class === 'recovery'`, marks money that came back for an expense already paid. It is excluded from income and expense totals like a self-transfer, and instead lists the expenses it went back to (`recovery_allocations`). `src/lib/splitLedger.ts` (pure) derives who owes what and plans settlements. Refunds on multi-person split expenses support interactive recipient attribution (Solution 2: `refund_target` in `recovery_allocations`), allowing proportional fair splits or targeted participant/user allocation so one person's settlement never falsely zeroes out another friend's debt. `src/store/expense/recoveryMiddleware.ts` wraps the expense store so that every write of `expenses` recomputes each expense's COUNTED amount (`amount paid − money back`); the paid amount stays in `gross_amount` (store-only, never sent to the database). Because the waterfall and day rollover already re-run on every expense change, money returns to its original budget day / income pool / Gullak with no extra source tracking. `src/store/expense/moneyBack.ts` records money back (and converts an already logged income); `src/store/expense/payload.ts` sends the new columns only when a row uses them.

### 6.8 Multi-Cadence Insights & Period Rollover Reconciliation (`INS-002`, `HEA-002`)
Insights breathing strips reconcile savings across all budget cadences without relying on nonexistent daily records for non-daily modes:
- **Weekly & Monthly Cadence Savings**: Weekly and Monthly insights aggregate finalized savings directly from `budget_periods` (`status === 'saved'`). Cross-month weekly periods attribute their savings at `activeEnd` matching true cash accounting rollovers.
- **Mid-Interval Cadence Switching**: Daily records and period slices combine additively (`autoSaved = dailySaved + periodSaved`) ensuring zero data loss and exact reconciliation.
- **Option 2 (Month Budget Share %)**: When monthly cadence users view the Weekly Insights tab, the second card renders `MONTH BUDGET SHARE` (showing current week's spend percentage of total monthly pool, status badge `🟢 On Track` / `⚠️ High Burn`, and contextual subtext `₹X of ₹Y pool`) paired with cadence-aware discipline takeaways.

---

## 7. Auth & Security

See [ADR 0004](adr/0004-supabase-anon-key-and-user-scoped-rls.md).

- **Auth**: Supabase email magic link + Google OAuth (`expo-auth-session`)
- **Keys**: Only `anon` key in bundle. Never `service_role`.
- **RLS**: Every table enforces `user_id = auth.uid()` on all operations.
- **Provisioning**: Default profile + categories created via `SECURITY DEFINER` trigger `handle_new_user()`.
- **Account deletion**: Delegated to Supabase Edge Function `delete-user-account` (requires `service_role` which is never client-side).
- **Deep links**: All auth deep links parsed and validated in `src/lib/authLinkHandler.ts`. Session fixation guard prevents switching accounts via crafted deep links.
- **Biometric App Lock**: `expo-local-authentication`. Preference stored in AsyncStorage (global + per-user key). Authentication required to toggle on or off.
- **Android backup**: Disabled (`allowBackup: false` in `app.json`) to prevent AsyncStorage extraction via `adb backup`.

---

## 8. Navigation

React Navigation v7 with:
- **Root Stack**: `NativeStack` — `Splash`, `Auth`, `Onboarding`, `ProfileSetup`, `AppTabs`, `AddExpense`, `EditExpense`, `ExpenseDetail`, `GullakDepositDetail`, `CategoryDetail`, `ManageCategories`, `AddEditCategory`, `Notifications`, `Profile`, `Savings`, `ResetPassword`, `Faq`
- **Tab Navigator** (inside Root Stack as `AppTabs`):
  - **Pure Mode**: 4 tabs (`Home`, `History`, `AddExpensePlaceholder` [Add], `Insights`). Direct attempts to access `Savings` safely redirect to `Home`.
  - **Budget Mode**: 5 tabs (`Home`, `Savings`, `AddExpensePlaceholder` [Add], `History`, `Insights`) with smooth capsule bar transition.

Cold start: `Splash` ends on solid mint, `useSplashCoverStore.show()` turns on the always-mounted mint `SplashCover` (App.tsx), `navigation.replace` swaps the route underneath, and `revealSoon()` dissolves the cover once the destination has laid out (hard cap 1.4s).

All routes typed in `src/types/index.ts` (`RootStackParamList`, `TabParamList`). Imperative navigation via `navigationRef`. Guard back actions with `navigation.canGoBack()`.

---

## 9. UI & Motion System

- **9.1 Theme & Design Tokens**: `src/config/theme.ts` — `LightColors`, `DarkColors` (with true AMOLED obsidian `DarkColors.amoled`), `Spacing`, `BorderRadius`, `FontSize`, `FontFamily`, `ControlHeight`. 3-theme picker supported on Profile (Light, Dark, AMOLED).
- **9.2 Rolling-Digit Numbers (`RollingText`)**: Vertical digit-by-digit odometer rolling animations on amount updates and screen focus across Home, Savings, Insights, and Category Details. Runs natively on the UI thread without layout shifts or text spasms. Premium feel: 460ms soft-landing ease, 18ms left-to-right digit ripple. Zero-flash synchronous render planning prevents any 1-frame static leak of new values before wheels mount.
- **9.2b Squish toggle (`AnimatedToggle`, `src/lib/toggleMotion.ts`)**: the single on/off switch used on Profile (4), Savings Budget Hub, Split, Self-transfer and AutoLog accounts. Press stretch, mid-trip stretch, landing squash, opacity colour cross-fade, selection haptic, reduce-motion support. Whole animation runs on the UI thread (the old version used JS-thread colour interpolation).
- **9.2a Segmented pills (`SegmentedControl`, `src/lib/segmentedMotion.ts`)**: Liquid two-edge pill (stretches in flight, distance-aware trailing spring, lands exactly in ~285ms), label colour cross-fade by pill position, tick on real change (+ iOS landing tick), reduce-motion aware. Heavy screens use `commitOnSettle` which commits at `PILL_COMMIT_MS` (200ms) to seamlessly overlap the pill's deceleration with content transitions (rolling numbers, card layout) without dead pauses, while the soft landing haptic plays at `PILL_SETTLE_MS` (320ms).
- **9.3 Ambient Background & Light Flow (`AmbientBackground`, `ambientStore`)**: Subtle, organic blurred gradient light bands moving slowly across the top of the screen surface. Automatically throttled/paused when tab/screen loses focus (`useSafeIsFocused`), app goes to background (`useAppActive`), or `useReduceMotion()` is active. User-toggleable in Profile.
- **9.4 Home Pull-to-Refresh & Pull-to-History Physics (`PullToHistoryContainer`, `pullToHistoryPhysics.ts`)**: Replaces default scroll view with unified drag, momentum, and pull-up gestures. Calibrated Instagram Vanish-mode spring physics (stiffness 42, damping 11.6, ~0.88 damping ratio) with countdown progress ring. Pull-down uses unified native refresh circle (`AppRefreshControl`) with haptic feedback and throttle cooldown.
- **9.5 Icons & Badges**: `lucide-react-native` (1.24+). Feature icons and badges strictly utilize `GradientIconBadge`.
- **9.6 Charts**: `react-native-svg` (15.15) — Concentric Dual Ring chart, animated donut rings, and gradient flow bars.
- **9.7 Safe Area & Bottom Nav**: `useSafeAreaInsets` from `react-native-safe-area-context`. Floating capsule `BottomNavBar` driven by `navBarStore` + `useScrollDirection`. Floating expanding capsule tabs animate with smooth in-place label reveal and cross-fading icon layers.

---

## 10. Notifications Architecture

See [`docs/notifications.md`](notifications.md) for the full product specification. The single source of truth is [`src/lib/notificationPolicy.ts`](../src/lib/notificationPolicy.ts) (tested via `tests/notificationPolicy.test.ts`).

- **Max 1 Per Day Rule (CRITICAL)**: At most **ONE** scheduled push notification per calendar day (priority order: Monthly recap > Weekly recap > Gullak reward > Evening nudge).
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
| JS/TS/UI fix | `eas update --branch preview` | No |
| New native module or permission | `eas build -p android --profile preview` | **Yes** |
| `app.json` change | `eas build -p android --profile preview` | **Yes** |
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

**Coverage as of v2.1.0**: 120 test files, 1777 tests (Node 22+). Split & money back adds `splitLedger`, `splitMoneyBackStore`, `splitMultiPerson`, and `splitPureModeTransitions`; the Home card details add `heroDetails`. v2 adds `autoLogParser`, `autoLogFlows`, `autoLogEmail`, `autoLogRollout`, `appUpdate`, offline characterization suites (`expenseSyncPending`, `dailyBudgetHydrate`, `dailyBudgetStore`), `bouncyCategoryFilter` & `SegmentedControl` UI-thread worklets, SectionList progressive section pagination, `recentTransactions` bounded selection, and granular store selector test suites.

| Test file | What it covers |
|---|---|
| `ambientBackground.test.ts` | Band math, phase wrapping, smootherstep easing, native animation parameters |
| `ambientStore.test.ts` | Ambient background toggle, AsyncStorage persistence, multi-user isolation |
| `amountKeypad.test.ts` | Calculator operators, ceiling limits, backspace, decimal paise parsing |
| `amountText.test.ts` | Currency symbol alignment, Indian grouping, rolling prop pass-through |
| `animationUtils.test.ts` | Spring physics, layout transitions, easing curves |
| `appButton.test.ts` | Button variants, tactile press feedback, loading state, disabled guards |
| `appLockStore.test.ts` | Biometric toggle, persistence, multi-user isolation, sign-out reset |
| `appUpdate.test.ts` | In-app APK updates, permission prompts, download progress, install intents |
| `authLinkHandler.test.ts` | Deep link parsing, recovery token, debounce, session exchange |
| `authStore.test.ts` | Auth session hydration, sign-in/out lifecycle, user profile store |
| `autoLogEmail.test.ts` | Bank email notification parsing, sender resolution, multi-source identity matching |
| `autoLogFixes.test.ts` | Regression tests for AutoLog parser and edge cases |
| `autoLogFlows.test.ts` | End-to-end AutoLog engine, review dismissal/discard, bulk clear, learned rules reset |
| `autoLogParser.test.ts` | Regex tokenizers, transaction extraction, noise rejection, dedupe tokens |
| `autoLogRollout.test.ts` | Feature flag rollout targeting, existing-user migration checks |
| `bottomSheetModal.test.ts` | BottomSheetModal backdrop dismiss, pan gestures, snap points |
| `bouncyCategoryFilter.test.ts` | UI-thread Reanimated worklet parity, Apple spring constants, zero-shift typography, immediate touch dispatch, lastActiveLayout isolation |
| `brandedHeroCard.test.ts` | Branded hero card metrics, dynamic pace presentation, non-binding hints |
| `breathingStrips.test.ts` | Weekly, Monthly, and Yearly breathing strip rendering and pulse physics |
| `budgetAlerts.test.ts` | Real-time budget alerts: threshold crossings, rollover summaries, resume notifications |
| `budgetCalculations.test.ts` | Streaks, rollover, status evaluation (`saved`/`missed`/`even`/`unknown`), duplicate prevention |
| `budgetModeUtils.test.ts` | Unprorated pacing previews, calendar streak cards, monthly matrices |
| `budgetModesStore.test.ts` | Pure mode vs budget mode toggles, cadence configuration, next-day scheduling, same-day reversal protection (PUR-003), persistence, offline queues |
| `budgetPeriods.test.ts` | Period timeline engine, active slices, finalization, idempotency |
| `budgetUtils.test.ts` | Budget resolution helpers, fallback logic, allowance math |
| `cadenceFixes.test.ts` | Next-day switch planning, Additive vs Allocation carry-forward, capacity limits |
| `cadenceSwitch.test.ts` | Next-day switch planning, Additive vs Allocation carry-forward, capacity limits |
| `canonicalStatusAndGuard.test.ts` | Canonical rule acceptance: BUD-008 missed status, SEC-001 digital vault spending guard |
| `carryAllocationWeeklyMonthly.test.ts` | CAR-001 Mode B allocation carry-forward across weekly and monthly cadences |
| `categoryStore.test.ts` | CRUD, ordering, user isolation, orphan prevention, sign-out reset |
| `chartUtils.test.ts` | SVG donut sweep calculations, flow bar coordinate mapping, color palettes |
| `colorUtils.test.ts` | Dynamic hex resolution, contrast math, gradient pairs |
| `dailyBudgetHydrate.test.ts` | Supabase hydration fast-path, persist-hydration gate, legacy row self-healing |
| `dailyBudgetPlanActions.test.ts` | Allowance updates, cadence switching, scheduled next-day plan actions, queue sync |
| `dailyBudgetRollover.test.ts` | Midnight rollover cycle, period finalization, daily record grouping |
| `dailyBudgetStore.test.ts` | Rollover finalization, hydration guard, Gullak deposits, store reset |
| `dailyBudgetSyncWithExpenses.test.ts` | Cross-store expense synchronization with daily records and spend totals |
| `dateFilters.test.ts` | Date range boundary logic, ISO string manipulation |
| `deepLinkGuard.test.ts` | Session fixation prevention, deep link validation |
| `expenseFilters.test.ts` | Transaction filtering, category sorting, payment mode slices |
| `expenseStore.test.ts` | Offline queues (create/update/delete), optimistic pending, reconnect sync |
| `expenseSyncPending.test.ts` | Offline pending expense synchronization, retry logic, error classification |
| `fetchExpensesTimeout.test.ts` | FIN-05: Range pagination per-page timeout scaling, retry resilience, cancellation guard, and NetInfo connectivity validation |
| `financialCorrectnessMatrix.test.ts` | 16-scenario financial matrix: zero proration, switches, mutations, boundary math |
| `formatters.test.ts` | `formatCurrency`, `formatAmountWithCommas`, `round2`, Indian numbering |
| `granularCategorySelectors.test.ts` | Granular Zustand store selector isolation in CategoryDetail and ManageCategories screens, rerender prevention |
| `gullakDeposits.test.ts` | Income vs external Gullak deposits, balance limits, timeline logs |
| `gullakIncomeDeleteEditGuard.test.ts` | FIN-06: Income deletion and reduction Gullak deficit calculation, auto-adjustment, and user alert confirmation |
| `gullakReconciliationHardCap.test.ts` | Gullak hard-cap reconciliation (GUL-001) preventing deposits exceeding net account liquidity |
| `heroDetails.test.ts` | Hero card details breakdown sheet, money in/out lines, money-back isolation |
| `homeCalculations.test.ts` | Home screen derived metrics, live spent, remaining balance |
| `homeSpendingNewUser.test.ts` | Cold-start user calculations, zero-data rendering guards |
| `incomeClassifier.test.ts` | Unified income classifier logic, fallback keywords inertness (TXN-002) |
| `insightsData.test.ts` | Analytical aggregations across weekly, monthly, and yearly intervals |
| `moneyExplainerContent.test.ts` | Explainer modal copy resolution, cadence help topic routing |
| `moneyFixesFour.test.ts` | Real-money invariant regression suite for 4 critical money bugs |
| `moneyWaterfall.test.ts` | Single source of truth money waterfall engine (WAT-001, WAT-002) |
| `moneyWaterfallStore.test.ts` | Integration between money waterfall and daily budget store metrics |
| `monthlyCardConsistency.test.ts` | Monthly hero card and detail card financial consistency across date slices |
| `monthlyInsightsData.test.ts` | Monthly aggregations, category breakdowns, week-over-week comparisons |
| `multiCadenceInsightsSavings.test.ts` | FIN-04: Multi-cadence savings reconciliation across weekly and monthly periods, cross-month attribution, mid-interval switches, and Option 2 share % |
| `navBarStore.test.ts` | Bottom navigation bar visibility state and toggle actions |
| `networkUtils.test.ts` | NetInfo state listener, reconnect queue trigger |
| `noteSuggestions.test.ts` | Autocomplete ranking by recency, frequency, and category affinity |
| `otaStore.test.ts` | In-app OTA modal triggers, version comparisons |
| `part2Consistency.test.ts` | Pure Mode invariants, category classification, carry-over rules |
| `paymentAndIconUtils.test.ts` | Payment mode resolution, icon key validation |
| `piggyBankCoinIcon.test.ts` | Gullak piggy icon and coin rendering |
| `profileUtils.test.ts` | Profile data sanitization, avatar upload URL derivation |
| `pullToHistoryPhysics.test.ts` | Reanimated worklet drag gesture physics, haptic threshold triggers |
| `pureModeRules.test.ts` | Pure mode allowance immunity, unspent immunity, negative balance allowance |
| `realTimeIncomeGullakDeduction.test.ts` | Real-time income-funded Gullak deposits deduction from daily budget pools |
| `recentTransactions.test.ts` | Home screen recent transaction slice, sorting, date grouping |
| `reviewSheetLayout.test.ts` | AutoLog ReviewSheet compact layout and bottom-sheet rendering |
| `rollingText.test.ts` | FIN-09: Number ticker digit roll planning, cross-filter forced spin, digit diff computation |
| `scaffoldExercises.test.ts` | Scaffolding validation |
| `segmentedControl.test.ts` | Segmented pill control selection, sliding indicator layout, `commitOnSettle` reports only the last tap after arrival (`PILL_COMMIT_MS`) |
| `toggleMotion.test.ts` | Squish switch: resting geometry equals old toggle for all 3 sizes, stretch anchoring, mid-trip stretch, never leaves the track, landing squash bound, no native `<Switch />` |
| `segmentedMotion.test.ts` | Liquid pill: settle within `PILL_SETTLE_MS` for 1-4 slot jumps, 95%+ travel by `PILL_COMMIT_MS`, same landing time for all distances, 120fps frame simulation of every slot move (in-bounds, no wobble, stretch 10-35%), slot geometry, label fade |
| `homeFilterMicroChoreography.test.ts` | Home pill commits after landing; no overlapping 220ms timer |
| `selfTransfersAndIncome.test.ts` | Self-transfer classification and exclusions from income totals |
| `splitEqualSharePrecision.test.ts` | FIN-07: Split equally remainder absorption and integer paise distribution preventing validation lockouts |
| `notificationPolicy.test.ts` | Pure notification policy: max 1/day, priority order, evening nudge, Gullak reward, recaps |
| `notificationStore.test.ts` | Add/dedup/cap-50, read status, multi-user isolation |
| `notificationSync.test.ts` | OS notification plan builder, diff-based scheduling, cancellation |
| `offlineStartup.test.ts` | Offline cold-launch boot sequence without network access |
| `otaStore.test.ts` | OTA update detection, modal prompt state, version binding |
| `part2Consistency.test.ts` | Multi-cadence and carry-forward state consistency verification |
| `paymentAndIconUtils.test.ts` | Payment labels/icons, unified income classification (`isIncomeTransaction`) |
| `piggyBankCoinIcon.test.ts` | Indian Rupee (₹) coin badge geometry, SVG path scaling, and theme stroke bindings |
| `profileUtils.test.ts` | 15-character name limit guardrail, display name resolution, initial letter extraction |
| `pullToHistoryPhysics.test.ts` | Instagram-calibrated rubber band pull physics, damping ratio, ring travel linearity |
| `pureModeRules.test.ts` | Acceptance suite for Pure Mode rules: SEC-001 amend, PUR-001 deficit switch, PUR-002 leftover retention |
| `realTimeIncomeGullakDeduction.test.ts` | Real-time income deduction from Gullak overspend and waterfall priority |
| `recentTransactions.test.ts` | Single-pass bounded top-5 transaction selection (`selectRecentTransactions`), tie-breaker stability, allocation reduction |
| `rollingText.test.ts` | Digit-by-digit vertical odometer roll, layout effect mount/reveal, decimal handling |
| `segmentedControl.test.ts` | Two-edge liquid pill, outer hitSlop, touch release selection, commit-after-landing |
| `selfTransfersAndIncome.test.ts` | Pure classification of self-transfers excluded from income/expense totals (TXN-003) |
| `splitLedger.test.ts` | Multi-person debt tracking, settlements, and summaries |
| `splitMoneyBackStore.test.ts` | Money back and refund store operations |
| `splitMultiPerson.test.ts` | Multi-person expense splitting and participant allocation |
| `splitPureModeTransitions.test.ts` | Pure Mode transitions for split expenses |
| `streakCalendarData.test.ts` | Calendar month grid data generation for savings streak modal |
| `streakFlame.test.ts` | Streak counter tiers, milestone badge triggers, flame stages |
| `themeStore.test.ts` | Light/dark/AMOLED toggle, Appearance listener, persistence |
| `transactionFunding.test.ts` | Waterfall transaction funding card breakdown resolution |
| `transactionUtils.test.ts` | Pure predicates: isCountedExpense, isCountedIncome, isExcludedFromTotals |
| `uiPrimitiveParity.test.ts` | UI primitive styling, typography tokens, and prop pass-through parity |
| `useExpenseForm.test.ts` | Expense and income form hook logic, split expense handling, validations |
| `useFocusEntry.test.ts` | Screen focus entry animation state and layout timing |
| `useFormKeyboard.test.ts` | Custom keypad numeric entry, backspace, and cursor positioning |
| `useInsightsData.test.ts` | Insights hook aggregations, category map caching, interval navigation |
| `useSavingsDashboard.test.ts` | Savings screen dashboard state aggregation and view model |
| `useScrollDirection.test.ts` | Scroll direction detection for floating bottom navigation bar |
| `vaultSpendingGuard.test.ts` | Digital Vault Spending Guard, net liquidity evaluation, inflow blockers |
| `vaultSpendingGuardAndBudgetEdit.test.ts` | In-sheet Add Money & Save workflow, zero-spend immediate budget adjustments (Daily/Weekly/Monthly) |
| `versionCheck.test.ts` | Semver comparison, update-required screen gating |
| `weeklyInsightsData.test.ts` | Weekly day-by-day aggregations, daily averages, weekend vs weekday spend |
| `yearlyInsightsData.test.ts` | 12-month calendar aggregation, annual savings, largest month-over-month increases |
| `yearlyInsightsInflowDeposits.test.ts` | FIN-03: Annual and 12-month inflow deposit filtering, income double-counting prevention (GUL-004) |
| `autoLogSettleReview.test.ts` | Payback review loop clearance on settle (ReviewSheet and moneyBack) |
| `splitPartialPaybackCategories.test.ts` | Oldest split first settlement and category-exact payback restoration (SPL-003) |
| `money/*.test.ts` | Canonical calculation layer tests: dateKeys, ledger, budgetAllowance (BUD-009), budgetStatus, overspendFunding |

---

## 13. Key ADRs

| # | Decision | Status |
|---|---|---|
| [0001](adr/0001-offline-first-asyncstorage-write-path.md) | Offline-first with AsyncStorage queues | Active |
| [0002](adr/0002-income-inferred-from-category-keywords.md) | Income inferred from category keywords | Legacy (inert fallback, `TXN-002`) |
| [0003](adr/0003-zustand-stores-as-sole-data-access-layer.md) | Zustand as sole data-access layer | Active |
| [0004](adr/0004-supabase-anon-key-and-user-scoped-rls.md) | Supabase anon key + RLS | Active |
| [0005](adr/0005-cross-store-wiring-via-registration-callbacks.md) | Cross-store via registration callbacks | Active |
| [0006](adr/0006-ota-updates-tied-to-app-version.md) | OTA tied to app version | Active |
| [0007](adr/0007-income-classification-divergence.md) | Dual-engine income divergence | **Superseded by 0008** |
| [0008](adr/0008-unified-income-classification.md) | Unified income classification | Active |
| [0009](adr/0009-vitest-unit-test-coverage.md) | Vitest unit test coverage policy | Active |
| [0010](adr/0010-budget-cadence-periods.md) | Multi-Cadence Budget Modes and Period Engine | Active (D4 superseded by 0011, amended by 0012) |
| [0011](adr/0011-zero-proration-and-digital-vault-spending-guard.md) | Zero-Proration Policy and Digital Vault Spending Guard | Active (amended by 0012, amended by canonical `SEC-001`) |
| [0012](adr/0012-one-budget-per-calendar-period.md) | One Budget per Calendar Period, and Pure Mode Keeps the Same Books | Active (D2/D3/D7 amended by canonical `PUR-002`, `PUR-003` & `SEC-001`) |
| [0013](adr/0013-store-module-split.md) | Store Helper Decomposition and Module Encapsulation | Active |
| [0014](adr/0014-canonical-rules-and-implementation-status.md) | Canonical Rules File, Retired Split Feature, and CAR-001 / Pure Mode Status | Active |
| [0015](adr/0015-ui-thread-reanimated-worklet-migration-and-render-optimizations.md) | UI-Thread Reanimated Worklet Migration and Render Optimizations | Active |
| [0016](adr/0016-split-expenses-and-money-back.md) | Split Expenses, Money Back and Refunds | Active |
| [0017](adr/0017-money-layer-and-payback-review.md) | Unified Money Layer and Payback Review Resolution | Active |

