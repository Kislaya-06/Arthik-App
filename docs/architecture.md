# Arthik — Architecture

> **Version:** v1.2.4 (September 2026)
> **Platform:** Android (Expo SDK 57, React Native 0.86)
> **Backend:** Supabase (Postgres + Auth + RLS)

---

## 1. System Overview

Arthik is a single-user personal finance app for Android. It tracks daily expenses, income, and automatically accumulates unspent daily budget into a savings pot called the **Gullak**. The app is built to work fully offline and sync to Supabase when connectivity is available.

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
| **Screens** | UI render + dispatch store actions | `src/screens/**` |
| **Stores** | Business logic, Supabase I/O, offline queues, derived state | `src/store/**` |
| **Pure Helpers** | Stateless calculations, formatters, classifiers | `src/lib/**` |
| **Components** | Shared UI atoms | `src/components/**` |
| **Config** | Supabase client, design tokens | `src/config/supabase.ts`, `src/config/theme.ts` |
| **Tests** | Vitest unit tests | `tests/**` |
| **Schema** | Postgres DDL + RLS (source of truth) | `schema.sql` |

### Strict boundary rule
> Screens render UI and dispatch store actions. Screens **never** import Supabase or write to AsyncStorage directly. All I/O is owned by stores.

---

## 3. Stores

Nine Zustand stores. Each owns a well-defined domain.

| Store | Domain | Persisted? | Reset on sign-out? |
|---|---|---|---|
| `authStore` | Session, user profile, sign-in/out | No | — (orchestrates resets) |
| `expenseStore` | Transaction CRUD, offline queues, sync | No (manual AsyncStorage) | ✅ `resetExpenses` |
| `dailyBudgetStore` | Daily budget, rollover, Gullak, streak | ✅ `persist` (AsyncStorage key `arthik-daily-budget-storage-v2`) | ✅ `resetDailyBudget` |
| `categoryStore` | User categories, placeholders, cache | No (manual AsyncStorage) | ✅ `resetCategories` |
| `notificationStore` | In-app notification list, unread count | No (manual AsyncStorage) | ✅ `clearNotifications` |
| `networkStore` | Online/offline flag, banner state | No | — |
| `navBarStore` | Bottom navigation bar visibility | No | — |
| `themeStore` | Light / dark / system theme | No (reads `Appearance`) | — |
| `appLockStore` | Biometric gate, lock/unlock state | No (manual AsyncStorage) | ✅ `reset` |

### Cross-store wiring (no circular imports)

All cross-store coordination is done via explicit registration callbacks at module evaluation time. See [ADR 0005](adr/0005-cross-store-wiring-via-registration-callbacks.md).

```
expenseStore ─ registerExpenseGetter ──────────► dailyBudgetStore
expenseStore ─ registerExpensesLoadedGetter ───► dailyBudgetStore
expenseStore ─ registerSyncCallback ───────────► networkStore
expenseStore ─ registerStoreResetCallback ─────► authStore
categoryStore ─ registerStoreResetCallback ────► authStore
categoryStore ─ registerCategoryDeleteCallback ► expenseStore
dailyBudgetStore ─ registerStoreResetCallback ─► authStore
notificationStore ─ registerStoreResetCallback ► authStore
appLockStore ─ registerStoreResetCallback ─────► authStore
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

## 6. Daily Budget & Gullak Engine

The financial heart of the app. See [daily-budget-map.md](maps/daily-budget-map.md) for the full function catalog.

### Day status state machine

```
     ┌──────────────────────────────────────────────────────┐
     │   ACTIVE (today, not yet finalized)                  │
     │   spent <= budget                                    │
     └──────────────────────────┬───────────────────────────┘
                                │ midnight (checkAndRollover)
             ┌──────────────────┼────────────────────────────┐
             ▼                  ▼                            ▼
          SAVED              EXCEEDED                      EVEN
     (saved > 0)          (spent > budget)         (spent == budget)
          │                    │                            │
          └──────────── Finalized, locked ──────────────────┘
                               │
                          UNKNOWN (budget == 0 or untracked day)
```

### Gullak total accumulated savings formula

```
totalAccumulatedSavings = Σ(DailyRecord.saved for all finalized days)
                        + Σ(GullakDeposit.amount for all manual deposits)
                        − Σ(DailyRecord overspend for exceeded days)
```

Computed by `calculateSavingsMetrics` in `src/lib/budgetCalculations.ts`.

### Income classification (unified, single engine)

See [ADR 0008](adr/0008-unified-income-classification.md). Single function `isIncomeTransaction(item, category)` in `src/lib/paymentUtils.ts` is used everywhere:
1. Check `item.type === 'income'` → true
2. Check `item.type === 'expense'` → false
3. Fallback: match `category.name` against `DEFAULT_INCOME_KEYWORDS`

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
- **Root Stack**: `NativeStack` — Splash, Auth, Onboarding, ProfileSetup, ResetPassword, ExpenseForm, ExpenseDetail, CategoryDetail, ManageCategories, AddEditCategory, Notifications, Profile
- **Tab Navigator** (inside Root Stack): Home, History, Insights, Savings (custom `BottomNavBar`)

All routes typed in `src/types/index.ts` (`RootStackParamList`, `TabParamList`). Imperative navigation via `navigationRef`.

---

## 9. UI System

- **Theme**: `src/config/theme.ts` — `LightColors`, `DarkColors`, `Spacing`, `BorderRadius`, `FontSize`, `FontFamily`, `ControlHeight`. Active theme via `themeStore`.
- **Fonts**: Quicksand (400/500/600/700) via `@expo-google-fonts/quicksand`.
- **Icons**: `lucide-react-native` (1.24+).
- **Charts**: `react-native-svg` (15.15).
- **Safe Area**: `useSafeAreaInsets` from `react-native-safe-area-context`. Never `SafeAreaView` from `react-native`.
- **Bottom Nav**: Custom floating capsule `BottomNavBar` driven by `navBarStore` + `useScrollDirection`.

---

## 10. OTA Updates & Deployment

See [ADR 0006](adr/0006-ota-updates-tied-to-app-version.md).

| Scenario | Command | Requires new APK? |
|---|---|---|
| JS/TS/UI fix | `eas update --branch preview` | No |
| New native module or permission | `eas build -p android --profile preview` | **Yes** |
| `app.json` change | `eas build -p android --profile preview` | **Yes** |
| Version bump | Both build + update | **Yes** |

`runtimeVersion.policy = "appVersion"` — OTA only reaches devices on the exact matching `expo.version`.

---

## 11. Test Architecture

See [ADR 0009](adr/0009-vitest-unit-test-coverage.md).

**Framework**: Vitest (v5), `npm test` → `vitest run`, config at `vitest.config.mjs`.

**Coverage as of v1.2.4**: 18 test files, 308 tests, ~645 ms.

| Test file | What it covers |
|---|---|
| `expenseStore.test.ts` | Offline queue add/update/delete, optimistic pending, sync on reconnect, user isolation, sign-out reset |
| `dailyBudgetStore.test.ts` | Rollover finalization (saved/exceeded), hydration guard, gullak deposits, store reset |
| `categoryStore.test.ts` | CRUD, ordering, user isolation, sign-out reset |
| `appLockStore.test.ts` | Biometric toggle, persistence, sign-out reset |
| `authLinkHandler.test.ts` | Deep link parsing, recovery token, debounce, session exchange |
| `notificationStore.test.ts` | Add/dedup/cap-50, read status, multi-user isolation |
| `themeStore.test.ts` | Light/dark/system toggle, Appearance listener |
| `paymentAndIconUtils.test.ts` | Payment labels/icons, income classification, icon fallback |
| `budgetCalculations.test.ts` | Full suite: streaks, rollover, status evaluation, `shouldIgnoreDuplicates` |
| `amountKeypad.test.ts` | Calculator operators, ceiling limits, backspace |
| `formatters.test.ts` | `formatCurrency`, `formatAmountWithCommas`, `round2` |
| `homeCalculations.test.ts` | Home screen derived metrics |
| `budgetUtils.test.ts` | Budget resolution helpers |
| `expenseFilters.test.ts` | Filter/sort correctness |
| `dateFilters.test.ts` | Date range filter logic |
| `noteSuggestions.test.ts` | Suggestion ranking |
| `deepLinkGuard.test.ts` | Session fixation guard |
| `versionCheck.test.ts` | Semver comparison, update-required logic |

---

## 12. Key ADRs

| # | Decision | Status |
|---|---|---|
| [0001](adr/0001-offline-first-asyncstorage-write-path.md) | Offline-first with AsyncStorage queues | Active |
| [0002](adr/0002-income-inferred-from-category-keywords.md) | Income inferred from category keywords | Active |
| [0003](adr/0003-zustand-stores-as-sole-data-access-layer.md) | Zustand as sole data-access layer | Active |
| [0004](adr/0004-supabase-anon-key-and-user-scoped-rls.md) | Supabase anon key + RLS | Active |
| [0005](adr/0005-cross-store-wiring-via-registration-callbacks.md) | Cross-store via registration callbacks | Active |
| [0006](adr/0006-ota-updates-tied-to-app-version.md) | OTA tied to app version | Active |
| [0007](adr/0007-income-classification-divergence.md) | Dual-engine income divergence | **Superseded by 0008** |
| [0008](adr/0008-unified-income-classification.md) | Unified income classification | Active |
| [0009](adr/0009-vitest-unit-test-coverage.md) | Vitest unit test coverage policy | Active |
