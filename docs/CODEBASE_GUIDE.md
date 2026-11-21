# Arthik — Codebase Guide (where things are, what each file does)

A map of the code for a new reader. Rules live in [`ARTHIK_CANONICAL_RULES.md`](ARTHIK_CANONICAL_RULES.md) (supreme),
the system design in [`architecture.md`](architecture.md), the budget store in
[`maps/daily-budget-map.md`](maps/daily-budget-map.md). This guide does not replace them.

How to read it: sections 1–2 are the app's money brain (everything else rests on them), 3–4 the layers and folders,
13 tells you where to go to change something.

---

## 1. The app in one paragraph
Arthik is an **expense and savings tracker** (React Native + Expo, Android only, Supabase backend). The user records
income and spending and may set a **budget** (daily, weekly or monthly); unspent budget goes into the **Gullak**
(savings jar). The app works offline. Bank SMS and bank emails can log spending **automatically** (Automatic Logging,
Beta).

### Words you will meet everywhere
| Word | Meaning |
|---|---|
| **Budget Mode** | Budget + Gullak + spending guard on (`isBudgetModeEnabled = true`) |
| **Pure Mode** | Tracking only: no limits, no Gullak on screen. The books stay the same; only the screens change |
| **Cadence** | How long a budget lasts: `daily`, `weekly` (Monday start), `monthly` |
| **Allowance / budget pool** | Money set aside for one day / week / month of spending |
| **Income** | What the user logged as income (`type = 'income'`) |
| **Gullak** | Savings. Money enters only two ways: unspent budget at the end of a period, and manual deposits |
| **Waterfall** | Where a spend was paid from: budget first, then income, then Gullak |
| **Remaining (All)** | Money left in the whole account: allowance + income + external deposits − spending. Can be negative |
| **Carry** | Unspent money moved into a new plan when the cadence changes (Mode A or B) |
| **Self-transfer** | Money between the user's own accounts. Neither income nor expense |
| **Missed / Saved / Even** | Status of a day or period: overspent / money left / exactly used up |

---

## 2. The money brain

Every rule below exists because of a real problem.

**"Where did this ₹500 come from?"** — One calculation answers it: `src/lib/moneyWaterfall.ts`. Order: **budget,
then income, then Gullak** (`WAT-001`). Each day applies income and deposits before spending (`WAT-002`), so today's
income cannot pay for yesterday's overspend. Home chips, the Gullak total and the expense funding card all read this
one function, so they never disagree.

**"Income went into the Gullak?"** — Never by itself (`BUD-003`). Only unspent **budget** and manual deposits enter
the Gullak.

**"The Gullak shows more than the real money"** — Gullak = `min(accumulated savings, Total Remaining ≥ 0)`
(`GUL-001`). It is never negative and never more than the real money.

**"Cadence changed mid-month — where does the unspent money go?"** — Not to the Gullak (the period has not ended,
`CAR-001`). It is **carried** (`src/lib/cadenceSwitch.ts`, `src/lib/periods/carry.ts`):
- **Mode A (Additive):** added once on top of the new budget.
- **Mode B (Allocation):** funds the coming periods. Example: ₹13,000 carried, weekly ₹5,000 → weeks 1–2 fully
  funded, week 3 gets ₹3,000 from carry and the user adds ₹2,000.
- Only the carry-funded part is left out of the Home All pill; Home All and the account total are always the same
  number. When carry runs out, one notice says "Carried money has run out … Add ₹X".

**Pure Mode** (`PUR-*`):
- Spending is never blocked and may go negative (`SEC-001`).
- A period ending in Pure Mode keeps its unspent money as hidden `pureLeftover`; it never becomes income and sends
  no message (`PUR-002`). Spending in Pure uses leftover, then income, then Gullak.
- Switching Pure → Budget with a negative Remaining adds one balancing income (note `Auto-balance (Pure Mode deficit)`)
  and a notification (`PUR-001`). It counts in Total Income but not in the Home budget chip.
- Mode switches take effect tomorrow at 12:00 AM; switching back the same day cancels it (`PUR-003`). A new account or
  one with no expenses turns Budget Mode on today (`BPR-002`).

**"Is this row income or expense?"** — The `type` field decides (`TXN-001`); category names never do (the keyword
fallback is inert, `TXN-002`). `transaction_class = 'self_transfer'` is never income or expense (`TXN-003`). Money
coming back (a friend paying back, a refund) is `transaction_class = 'recovery'`, never income (`TXN-004`).

**Split and money back** (`SPL-001..006`) — The expense keeps the full paid amount (`split_allocations`). A money-back
row lists the expenses it went back to (`recovery_allocations`). `src/store/expense/recoveryMiddleware.ts` recomputes
each expense's **counted** amount (`paid − money back`) on every write; the paid amount stays in `gross_amount`. Because
the waterfall and rollover re-run on every change, money returns to where it came from: that day's budget (and Gullak),
the income pool, or the Gullak (`SPL-003`). Who owes what is derived, never stored (`src/lib/splitLedger.ts`, `SPL-002`).
More money than owed is normal income (`SPL-004`); a bank message matching a person only asks (`SPL-005`); a refund on a
multi-person split goes to everyone, the user, or one person (`SPL-006`).

**"No money — how can I spend?" (Budget Mode)** — `src/lib/vaultSpendingGuard.ts`: overspending a budget is covered by
unspent income and Gullak; a new expense is blocked only when the whole account (`accountRemaining`) is ₹0 or less
(`SEC-001`). Then `VaultSpendingGuardModal` lets the user add money and save without losing the typed expense.

**"Why can't today's budget change today?"** — It can when nothing is spent yet in the current day / week / month
(`BPR-002`); otherwise the change starts with the next cycle so the running period ends cleanly.

---

## 3. Layers

```
 Screens (src/screens)          what the user sees
     │ use
 Components (src/components) + Hooks (src/hooks)
     │ read / write
 Stores (src/store)             Zustand: state + Supabase + offline queues
     │ call for calculations
 Lib (src/lib), src/money       PURE functions (no React, store or network)
     │
 Supabase (schema.sql)   AsyncStorage (offline cache + queues)   SQLite (Automatic Logging, encrypted)
```

Two firm rules:
1. **Engines in `src/lib` are pure.** Input in, number out. They do the money math and are easy to test.
2. **Stores never import each other.** They meet through registration callbacks (ADR 0005): `registerExpenseGetter`,
   `registerAddExpense`, `registerStoreResetCallback` … so there are no circular imports.

---

## 4. Folder map

| Path | What it is |
|---|---|
| `App.tsx`, `index.ts` | App start. `index.ts` imports the Automatic Logging background tasks |
| `src/screens/` | Full screens (Home, History, Savings, Insights, Profile, Add Transaction, Automatic Logging …) |
| `src/components/` | Reusable UI: cards, sheets, charts, buttons; `ui/` = design-system primitives |
| `src/hooks/` | Screen logic hooks |
| `src/store/` | Zustand stores (data + sync) |
| `src/lib/`, `src/money/` | Pure engines and helpers |
| `src/features/autoLog/` | Automatic Logging |
| `src/navigation/` | Root stack, tabs, `navigationRef.ts` (imperative navigation) |
| `src/config/` | Supabase client, theme tokens |
| `src/types/` | Shared types and route params (`lucide-icons.d.ts` types the per-icon imports) |
| `modules/arthik-autolog/` | Android (Kotlin) native module — any change needs a new APK |
| `supabase/` | SQL migrations, `delete-user-account` edge function |
| `schema.sql` | Database source of truth |
| `tests/` | Vitest (`npm test`) |
| `app.json`, `eas.json` | Expo config, OTA highlights, build profiles |

Commands: `npm test`, `npm run typecheck`, `npm run test:native`, `npx expo start --port 8081`.

---

## 5. How the app starts

- **Cold start** (`SplashScreen.tsx` → `src/lib/startupLoad.ts`, `OFL-001`): opens from data saved on the phone
  (pending queue → categories → expenses → app lock) and refreshes from the server in the background. Only a first run
  with nothing saved waits, at most 5 s.
- **`App.tsx`**: fonts and theme, version check (`versionCheck.ts` → `UpdateRequiredScreen`), OTA listener
  (`otaStore`), network listener, notification sync and tap handler, deep links, sign-in hydration
  (`SIGNED_IN`: pending queue → categories → expenses + `hydrateFromSupabase`), the touch fence flush
  (`selectionCommitFence`) and the mint `SplashCover`.
- **Foreground**: pending sync, pending daily-record upload, app-lock check, quiet Home refresh after 5+ minutes away.
- **Navigation** (`src/navigation/index.tsx`): tabs Home, History, Savings, Insights (Savings is guarded in Pure Mode);
  stack screens are listed in [`architecture.md`](architecture.md) §8.

---

## 6. Database (`schema.sql`)

| Table | Holds |
|---|---|
| `profiles` | Profile + budget settings (mode, cadence, amounts) |
| `categories` | Defaults + the user's own; `kind` = expense / income (`CAT-004`) |
| `expenses` | **Every transaction** (expense and income): `amount`, `type`, `category_id`, `payment_mode`, `expense_date`, `transaction_class` (`normal` / `self_transfer` / `recovery`), split and money-back columns, `note` |
| `daily_savings_log` | Daily records: budget, spent, saved, `status` (`saved` / `missed` / `even` / `unknown`) |
| `gullak_deposits` | Manual deposits (`source`: income or external) |
| `budget_plan_changes` | Plan history (which plan from when, carry mode, carried amount) |
| `budget_periods` | Finalized weekly / monthly periods |
| `self_transfer_rules` | Remembered "this note is my own transfer" rules |
| `expense_sync_versions` | Per-user expense change counter (`OPT-69`) |
| `autolog_profiles` | Automatic Logging settings (no message content) |
| `app_config` | Force update (`version_control`) and rollout flags (`feature_flags`) |
| `expense_shares` | Table of the first split feature; the app no longer uses it |

`handle_new_user()` creates the profile and default categories. Row-level security: each user sees only their own
rows (ADR 0004). A new table or column = `schema.sql` + a new file in `supabase/migrations/`.

---

## 7. `src/money/` — one question, one answer

| File | Job |
|---|---|
| `dateKeys.ts` | One way to name a day (`yyyy-MM-dd`): `toDateKey`, `todayDateKey`, day counts, days in a month |
| `ledger.ts` | Cleans a row once: `amountPaid` and `amountCountedAfterMoneyBack`; per-day totals |
| `budgetAllowance.ts` | Per-day budget rate (`BUD-009`): monthly ÷ that month's real days |
| `budgetStatus.ts` | Left / over / how full, on top of `calculateCycleFinancials` |
| `overspendFunding.ts` | Whether income or Gullak covered an overspend (from the waterfall) |

New money logic goes here, with a test (`MNY-001`).

## 8. `src/lib/` — engines and helpers

**Transaction identity**
| File | Job |
|---|---|
| `transactionUtils.ts` | `isIncomeTransaction`, `isCountedIncome`, `isCountedExpense`, `isExcludedFromTotals`, `getTransactionClass`, `PURE_DEFICIT_NOTE` |
| `incomeClassifier.ts` | Builds list-wide classifiers from the functions above plus categories |
| `transferRules.ts` | Self-transfer rule matching: by note only, never by amount |
| `paymentUtils.ts` | Payment-mode icons and labels |

**Budgets and periods**
| File | Job |
|---|---|
| `budgetCalculations.ts` | `calculateCycleFinancials`, `evaluateDayStatus`, `computeSpentByDate`, `computeIncomeByDate`, streak and savings metrics, `DailyRecord` |
| `budgetPeriods.ts` (facade) + `periods/` (`core`, `pools`, `carry`, `streak`, `calendar`, `periodSummary`, `finalize`) | Period bounds, date owner (`getDateOwner`), budget pools, carry, period finalization, cadence streaks. Pure, no `new Date()` |
| `cadenceSwitch.ts` | What is left, how much carries, capacity check, `buildCadenceSwitchPlan`, Mode B summary |
| `budgetUtils.ts`, `budgetModeUtils.ts` | Budget resolution on hydrate; tabs per mode, labels, streak cards (`buildWeeklyStreakCards`, `buildMonthlyStreakMatrix`), `resolveAutoRenewForPlan` |
| `dateFilters.ts`, `gapFiller.ts` | Is a date in a period; zero-activity days for Welcome Back savings (`ROL-004`) |

**Funding and display**
| File | Job |
|---|---|
| **`moneyWaterfall.ts`** | **The one answer to "where did the money come from"**: per-spend `fromBudget / fromLeftover / fromIncome / fromGullak`, per-day totals, income left, Gullak used, `pureLeftover`. Reuses a result when every input is the same reference (`OPT-75`) |
| `transactionFunding.ts` | Funding breakdown on Expense Detail |
| `homeCalculations.ts` | Home hero card: `calculatePeriodSummary` for All / Daily / Weekly / Monthly (amounts, labels, copy) |
| `heroDetails.ts`, `heroRing.ts` | Home card details sheet; ring's real % and second lap (`UX-004`), display only |
| `splitLedger.ts`, `settleReview.ts` | Who owes what, settlements, refund planning; the review sheet's settle summary and button text |
| `vaultSpendingGuard.ts` | `calculateVaultLiquidity`, `canAddExpense`; always allowed in Pure Mode |
| `gullakReconciliation.ts` | When income that funded a Gullak deposit is deleted or reduced, the unbacked part is taken back from the Gullak after a confirmation (`GUL-001`, `GUL-004`) |
| `savingsHistoryGroups.ts`, `historyRows.ts`, `notificationGroups.ts`, `homeNetworkPill.ts` | Display grouping: Savings history weeks / months, History rows and time labels, Notifications date sections and Gullak stacks, one Home offline message at a time |

**Insights** — `weeklyInsightsUtils.ts`, `monthlyInsightsUtils.ts`, `yearlyInsightsUtils.ts`, `insightsCommon.ts`:
spend, budget health, safe daily pace (`INS-001`), day-matched comparisons, multi-cadence savings.

**Notifications**
| File | Job |
|---|---|
| `notificationPolicy.ts` | **The rulebook** (pure): nudge, Gullak reward, recaps, carry notices, channels, copy |
| `notificationSync.ts` | Builds the plan from app data and replaces the OS schedule when data changes |
| `notificationService.ts` | `expo-notifications`: permission, schedule, cancel (`cancelTonightNudge`) |
| `budgetAlerts.ts` | Live alerts: limit crossed, rollover, budget updated (alert kind `exceeded` ≠ budget status) |

**Offline, sync and security** — `queueLock.ts` (`runExclusive`, one writer per key), `asyncStorageList.ts`
(`changeStoredList`, `removeFromStoredList`), `supabasePaging.ts` (`fetchAllPages`), `expenseListEquality.ts` +
`expenseCacheMemo.ts` (skip identical lists and writes), `startupLoad.ts`, `signOutCleanup.ts` (SEC-01),
`secureSessionStorage.ts` + `expoSessionCipher.ts` + `sessionCodec.ts` (SEC-02), `networkUtils.ts`,
`authLinkHandler.ts` + `deepLinkGuard.ts`, `versionCheck.ts` + `apkInstaller.ts` (force update, SEC-03),
`friendlyError.ts` (short user-facing error text), `perfMarks.ts` (dev-only timing marks).

**UI helpers (no money math)** — `formatters.ts` (`formatCurrency`, `round2`), `amountKeypad.ts`, `profileUtils.ts`,
`chartUtils.ts` (facade over `charts/`: `donutSegments`, `monthlyCharts`, `gullakMilestones`, `dualRing`), `categoryIconRegistry.ts` (every picker icon must be here), `iconUtils.ts`,
`colorUtils.ts`, `flameUtils.ts`, `rollingText.ts` + `quicksandMetrics.ts`, `segmentedMotion.ts` +
`selectionCommitFence.ts` (ADR 0020), `toggleMotion.ts`, `sheetTransition.ts`, `whileVisibleSelector.ts`,
`pressFeedback.ts` (`PRESS_DIM_OPACITY`), `scrim.ts`, `alertButtonPalette.ts`, `saveFeedback.ts` (success haptic on
save), `skeletonMotion.ts`, `fontScale.ts`, `navBarLayout.ts`, `pullToHistoryPhysics.ts`, `ambientBackground.ts` (+
`ambientGrain`, `ambientWind`), `animationUtils.ts`, `streakCalendarData.ts`, `expenseFilters.ts`, `noteSuggestions.ts`,
`moneyExplainerContent.ts`, `quickCategoryPick.ts` + `quickCategories.ts` (top categories for notification buttons).

---

## 9. Stores (`src/store/`)

**`dailyBudgetStore.ts`** (facade) + `dailyBudget/` — the budget brain. State: `dailyRecords`, `gullakDeposits`,
`totalAccumulatedSavings`, streaks, `isBudgetModeEnabled`, `budgetCadence`, amounts, `planChanges`, `budgetPeriods`.
Persist key `arthik-daily-budget-storage-v2` (version 4). Main actions: `syncWithExpenses`, `checkAndRollover`,
`setBudgetCadence`, `setBudgetModeEnabled`, `addGullakDeposit`, `hydrateFromSupabase`. Every submodule is described in
[`maps/daily-budget-map.md`](maps/daily-budget-map.md).

**`expenseStore.ts`** (facade) + `expense/` — every transaction, offline-first (ADR 0001): optimistic in the list,
queued before the request, removed when the server confirms.
| File | Job |
|---|---|
| `mutationActions.ts`, `loadActions.ts`, `failedSyncActions.ts` | Add / update / delete; pending and cached loads; failed-sync list |
| `pendingQueues.ts`, `syncPending.ts` | Queue keys, retry / backoff; sends deletes → adds → updates → side queues |
| `saveGuards.ts` | `SAVE_TIMEOUT_MS` (10 s), confirmed-cache writes |
| `versionProbe.ts` | Expense change counter: same counter → skip the download (`OPT-69`) |
| `payload.ts` | Sends split / money-back columns only for rows that use them |
| `recoveryMiddleware.ts`, `moneyBack.ts` | Counted amount after money back; record money back / refunds |

`fetchExpenses` stays in the facade (its download counters are shared with `resetExpenses`).

**Other stores**
| Store | Job |
|---|---|
| `authStore.ts` | Session, profile, sign out (resets every store, `clearUserCachesOnSignOut`), account delete |
| `categoryStore.ts` | Categories, offline queues, `categoryKindOf` / `categoriesOfKind` |
| `transferRulesStore.ts` | Remembered self-transfer notes, works offline (`OPT-73`) |
| `networkStore.ts` | Online / offline, banner, reconnect sync |
| `notificationStore.ts` | In-app bell, capped at 50 |
| `appLockStore.ts`, `themeStore.ts`, `ambientStore.ts`, `navBarStore.ts` | App lock, theme, ambient background, nav bar visibility |
| `otaStore.ts` | OTA check + "What's new" modal (fallback highlights) |
| `alertStore.ts` | Queue of themed dialogs (`AppAlertModal`) |
| `splashCoverStore.ts` | Mint cover over the splash → first screen hand-off |

---

## 10. Screens, components, hooks

**Screens** — `HomeScreen` (hero card, ring, recent items), `HistoryScreen` (FlashList, filters, swipe to delete),
`SavingsScreen` (Budget Hub, Gullak, streak, history), `InsightsScreen` + `insights/` (`PeriodNavigator`,
`periodUtils`, `useInsightsData`), `ExpenseFormScreen` (Add / Edit Transaction; logic in `useExpenseForm`),
`ExpenseDetailScreen`, `LedgerScreen` (+ `ledger/LedgerParts`), `ProfileScreen`, `NotificationsScreen`,
`CategoryDetailScreen`, `ManageCategoriesScreen`, `AddEditCategoryScreen`, `GullakDepositDetailScreen`, `FaqScreen`,
`UpdateRequiredScreen`, sign-in flow (`SplashScreen`, `OnboardingScreen`, `AuthScreen`, `ResetPasswordScreen`,
`ProfileSetupScreen`), and `autolog/` (`AutoLogIntroScreen`, `AutoLogSetupScreen`, `AutoLogCenterScreen`,
`AutoLogReviewScreen`, `AutoLogAccountsScreen`, `AutoLogEmailScreen`, `AutoLogInfoScreen`, `AutoLogWelcomeBackScreen`).
Big screens keep styles in `<Screen>.styles.ts` and rows in a folder: `home/HomeRecentItems`, `history/` (`HistoryRows`,
`HistoryEmptyState`, `historyHelpers`), `expenseForm/CategoryChipItem`, `ledger/LedgerParts`.

**Components**
- *Home*: `BrandedHeroCard`, `HeroDetailsSheet`, `DonutChart`, `RollingText`, `TransactionRow`, `PullToHistoryList` +
  `PullToHistoryIndicator`, `WelcomeBackGapModal`, `BouncyFilterToggle`; `ExpenseFundingCard` on Expense Detail.
- *Budget / Savings*: `BudgetEditModal`, `CadenceSwitchModal`, `PeriodRenewalModal`, `DepositGullakModal`,
  `StreakCalendarModal`, `StreakFlame`, `VaultSpendingGuardModal`, `MoneyExplainerModal`, `PiggyBankCoinIcon`,
  `SavingsRecordRow`, `GullakDepositRow`,
  `savings/` (`SavingsHeader`, `SavingsHeroCard`, `BudgetHubSection`, `SavingsHistorySection`),
  `profile/` (`PauseBudgetModal`, `EditProfileModal`, `DeleteAccountModal`).
- *Split*: `split/` (`SplitExtras`, `MoneyBackExtras`, `MoneyBackSheet`, `SplitDetailCard`, `SettleExpenseSheet`);
  *transfer*: `transfer/` (`TransferExtras`, `TransferDetailCard`).
- *Charts*: `CashFlowChart`, `YearlyCashFlowChart`, `SpendingFlowChart`, `AnimatedCategoryDonut`, `BreathingStripShell`
  + `WeeklyBreathingStrip` / `MonthlyBreathingStrip` / `YearlyBreathingStrip`, `YearlySavingsMilestoneCard`,
  `BehavioralInsightRow`.
- *Form*: `BouncyTypeToggle`, `BouncyPaymentToggle`, `BouncyCategoryFilter`, `KeyButton`, `CustomDatePickerModal`,
  `CategoryRowItem`, `GradientIconBadge`, `SwipeableHistoryRow`, `AnimatedToggle` (the one on/off switch).
- *App-wide*: `BottomNavBar`, `AmbientBackground`, `AppLockOverlay`, `SplashCover`, `OfflineBanner`,
  `SyncFailedBanner`, `OtaUpdateModal`, `ErrorBoundary`, `AppRefreshControl`, `RefreshScrollShell`, `GoogleIcon`.
- *`ui/` primitives*: `AppButton`, `AmountText`, `SegmentedControl`, `BottomSheetModal`, `AppAlertModal`,
  `ScreenHeader`, `HeaderBackButton`, `EmptyState`, `PressableOpacity`, `FormGroup` / `FormRow`, `StatusBadge`,
  `ItemRowShell`, `KeypadGrid`, `Skeleton`, `ChevronRotator`, `AuthFormField`, `AuthMessageBanner`. Rules for using
  them: [`design-system.md`](design-system.md), ADR 0021.
- *`autolog/`*: `ReviewSheet` (+ `review/CategoryChipItem`), `WhyLoggedCard`, `AutoLogHomeBanner`, `AutoLogGate`, `EmailSourceInfo`,
  `RenameAccountSheet`, `AutostartGuideCard`, `AutoLogUi` (+ `BetaPill`).

**Hooks** — `useExpenseForm` (+ `expenseForm/types`), `useSavingsDashboard`, `useFormKeyboard`, `useFocusEntry`,
`useScrollDirection`, `useReduceMotion` (one live source in `lib/reduceMotionStore.ts`, `OPT-43`), `useNavBarMetrics`, `usePullRefresh`,
`useRingSweep`, `useStoreWhileVisible` (hidden popups keep their last store value, `OPT-74`), `useScrimColor`.

---

## 11. Automatic Logging

Full design: [`AUTO_LOGGING.md`](AUTO_LOGGING.md). In short: bank SMS (`SmsReceiver.kt`) and bank-email
notifications (`PaymentNotificationListener.kt`) pass the native privacy gate (`FinancialFilter.kt`) into a queue
(`EventQueue.kt`); `AutoLogHeadlessService.kt` wakes JS; `service.processQueue` → `engine.processSms / processEmail`
→ logged, pending review, ignored, transfer or merged → `ledger.createTransaction`. Other modules: `parser`, `senders`,
`accounts`, `merchants`, `matching`, `reviews`, `ledger`, `paybackGuard`, `notify`, `notificationActions`, `digest`,
`autostart`, `permissions`, `remote`, `rollout`, `db`, `store` — each described in AUTO_LOGGING.md §4. Three modes: Discovery (learns,
never creates), Recovery (re-checks a gap), Live. Payment-app notifications are not used. Message content never leaves
the phone.

## 12. One expense, end to end

Budget Mode, daily ₹500, the user adds ₹300:
1. `ExpenseFormScreen` → `useExpenseForm`: validate, spending guard (`calculateVaultLiquidity`).
2. `expenseStore.addExpense`: row appears at once (optimistic), queued, then sent; `dailyBudgetStore.syncWithExpenses`
   runs.
3. `metrics.ts` → `runWaterfall`: ₹300 from today's budget, ₹200 left.
4. Home recalculates (`calculatePeriodSummary`); numbers roll.
5. `notificationSync` re-plans (tonight's nudge is cancelled — something was logged).
6. After midnight `checkAndRollover` → `finalizeDailyRecords`: the day is `saved` (₹200 to Gullak), `missed` or `even`.

## 13. Where to change what

| Task | Go to |
|---|---|
| Income / expense identity | `transactionUtils.ts`, `incomeClassifier.ts` |
| Where a spend was paid from | `moneyWaterfall.ts` (+ `transactionFunding.ts` for display) |
| Home numbers / text | `homeCalculations.ts`, `heroRing.ts` |
| Total remaining / Gullak total | `store/dailyBudget/metrics.ts` |
| Spending guard | `vaultSpendingGuard.ts`, `VaultSpendingGuardModal.tsx` |
| Cadence change / carry | `cadenceSwitch.ts`, `periods/carry.ts`, `store/dailyBudget/cadenceActions.ts`, `CadenceSwitchModal.tsx` |
| Day / period status, Gullak deposits at rollover | `budgetCalculations.ts`, `store/dailyBudget/rollover.ts` |
| Pure Mode rules | `moneyWaterfall.ts` (leftover), `store/dailyBudget/pureDeficit.ts`, `vaultSpendingGuard.ts` |
| Notifications | `notificationPolicy.ts` (rules), `notificationSync.ts` (data), `notificationService.ts` (device) |
| Offline sync | `store/expense/*`, `store/dailyBudget/pendingStorage.ts`, `lib/queueLock.ts` |
| New table / column | `schema.sql` + new `supabase/migrations/*.sql` + docs |
| Automatic Logging parsing / duplicates | `features/autoLog/parser.ts`, `senders.ts`, `matching.ts` |
| Colours, spacing, sizes | `config/theme.ts` + `docs/design-system.md` |
| Insights math | `*InsightsUtils.ts`, `screens/insights/useInsightsData.ts` |

## 14. Staying safe when changing code
1. Check the change against the canonical rules; if it contradicts one, stop and name the rule ID (AGENTS.md).
2. Change money math only in the engines (`src/lib`, `src/money`), never in UI, so every screen shows one number.
3. New money logic gets a test whose title names the canonical rule ID.
4. Home's number and the account total must always be the same; never write a second formula.
5. `npm run typecheck` and `npm test` green before any release.
6. Update CHANGELOG and every touched doc in the same change; a database change needs `schema.sql` and a migration.
