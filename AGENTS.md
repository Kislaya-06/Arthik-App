# AGENTS.md

Guide for AI coding agents working on **Arthik** (personal expense + savings tracker).
Read this fully before touching code. If a rule here conflicts with a user instruction, the user wins — but the agent MUST strictly adhere to the following protocol:
1. **Explain Rule Breach**: State out loud which rule is being broken and why.
2. **Thorough Impact Explanation**: If breaking the rule affects critical logic, touches financial metrics, or creates cascading changes across the app, provide a comprehensive explanation of the implications before writing code. Because every rupee in Arthik is REAL MONEY, any calculation flaw or balance mismatch directly harms the user.
3. **MANDATORY LOGIC APPROVAL GATE**: The agent must NEVER unilaterally alter or modify any calculation, financial metric, or core app logic. Any change in logic must be explicitly presented to the user and approved by them first before execution.
4. **MANDATORY DOCUMENTATION ATOMICITY & PERPETUAL RECONCILIATION (CRITICAL - ZERO DOCUMENTATION LAG)**: Whenever ANY change, feature, bugfix, policy update, refactor, UI modification, or direct documentation edit is made in the app (whether in code OR in any documentation file), ALL related, dependent, and interconnected documentation files across the repository (`docs/maps/*`, `docs/adr/*`, `docs/specs/*`, `docs/*.md`, `AGENTS.md`, `CHANGELOG.md`, `README.md`) MUST be updated immediately in the SAME change. From now on and for all future tasks, every single document in the project MUST remain 100% fresh, accurate, and up-to-date forever — NO document is ever allowed to lag behind, drift, or contradict true code reality.
5. **MANDATORY PROACTIVE SKILL UTILIZATION (CRITICAL)**: Whenever ANY work or task is initiated, the agent MUST proactively identify, read, and strictly leverage the appropriate installed skill relevant to the task without waiting for the user to explicitly ask for it. Matt Pocock's skills (`mattpocock-skills:*`) are the default, Expo's (`expo:*`) cover Expo / EAS work, and `kislaya-skills:animate-expo` / `kislaya-skills:review-animations` cover app motion; see §14 for which skill fits which task. For app UI, [`docs/design-system.md`](docs/design-system.md) and §9 are the guide.

> **CANONICAL RULES SUPREMACY (CRITICAL — read before ANY change)**: [`docs/ARTHIK_CANONICAL_RULES.md`](docs/ARTHIK_CANONICAL_RULES.md) is the owner's supreme file for every business / financial / accounting rule (transactions, split expenses and money back, budgets, Gullak, cadence switching and carry-forward, rollover, insights, notifications, AutoLog privacy, categories, form guardrails). It exists so that no new feature, edit or refactor can silently break how money behaves.
> 1. **Never break it silently.** Before writing code for any feature, change, bugfix or refactor, check it against the canonical rules. Changes that touch money logic must keep every rule true.
> 2. **If a change would contradict a rule, STOP and tell the owner first**: name the rule ID (e.g. `BUD-003`), say what would break and what else it affects. Change nothing — not code, not the canonical file — until the owner explicitly says to change the rule.
> 3. **Only after that explicit "yes"**: update the code, the tests, the canonical file itself, and EVERY document the change touches (list below), precisely, in the same change.
> 4. **Rules not covered by the canonical file**: if you find money behaviour the file does not mention, tell the owner before building on it; the owner decides whether to add a rule.
> 5. **Never edit the canonical file on your own initiative**, even to "fix a typo" in a rule's meaning.
> 6. **Documentation-sync checklist after every change** (nothing may lag): `docs/ARTHIK_CANONICAL_RULES.md` (only if rules changed, with approval) · `AGENTS.md` · `CONTEXT.md` · `README.md` · `docs/prd.md` · `docs/architecture.md` · `docs/maps/*` · `docs/adr/*` (+ index tables in `docs/README.md` and `docs/architecture.md` §13) · `docs/specs/*` · `docs/AUTO_LOGGING.md` · `docs/notifications.md` · `docs/RELEASE_PROCESS.md` · `schema.sql` / `supabase/migrations/*` · `CHANGELOG.md` · `app.json` OTA highlights · tests. A rule ID in a doc must exist in the canonical file.

> **PONYTAIL PRECEDENCE (owner rule, 2026-11-22)**: the `ponytail` plugin (lazy senior dev mode: YAGNI, stdlib first, the shortest solution that works) is installed. When ponytail and this file disagree on HOW code is written (size, abstractions, diff scope, polish), **ponytail wins**: follow it without a §20 conflict prompt. **Money logic is the one exception**: for anything the canonical rules cover, every balance / budget / Gullak / income / expense / rollover / split calculation, and the offline queues and sync that carry money data (§6.1, §7, §8), this file and `docs/ARTHIK_CANONICAL_RULES.md` win, including §5.2 "quality first", tests and the approval gates.

> **STRICT GIT & RELEASE INVARIANT (CRITICAL)**: Under NO circumstances should any code be committed (`git commit`), pushed to remote (`git push`), merged (`git merge`), or released as an OTA update (`eas update`) unless the user explicitly and directly instructs you to do so in their prompt. The agent must never autonomously commit, push, merge, or release updates without direct, explicit, and unambiguous user command.

---

# 1. Project Overview

Arthik is a personal finance, expense and daily-savings tracking app.

**Core Financial Principle (CRITICAL)**: Every single rupee in Arthik is **REAL MONEY** — nothing is virtual, fake, or gamified. When a user sets a daily allowance (e.g. ₹250 or ₹500/day), they are transferring and allocating real cash into their spending pool in real life. If a user turns Budget Mode OFF (switching to Pure Mode), past active days' allowances represent real money deposited into the account and must NEVER be wiped out, ignored, or vanished from historical cashflow or all-time Inflow. Always calculate all metrics with this real-money invariant.

| Layer | Tech |
| --- | --- |
| Framework | React Native 0.86 + Expo SDK 57 (`expo-dev-client`, no Expo Go) |
| Language | TypeScript (`strict: true`) |
| State | Zustand (some stores use `persist` + AsyncStorage) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Navigation | React Navigation (native-stack + bottom-tabs) |
| Dates | `date-fns` |
| Icons / Charts | `lucide-react-native`, `react-native-svg` |
| Fonts | Quicksand via `@expo-google-fonts/quicksand` |
| Animations & Gestures | `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `expo-haptics` |
| Lists & Performance | `@shopify/flash-list` (preferred for heavy feeds alongside VirtualizedList / ScrollView) |
| Security & Biometrics | `expo-local-authentication` (App Lock), `expo-secure-store` |
| Screen Safe Area | `react-native-safe-area-context` |
| Updates | `expo-updates` (EAS Update, OTA) |
| Offline | `@react-native-community/netinfo` + AsyncStorage pending queues |
| On-device secure storage | `expo-sqlite` with **SQLCipher** (Automatic Logging DB), `expo-secure-store` (DB key) |
| Native (Android) | Local Expo module `modules/arthik-autolog` (Kotlin): SMS receiver, payment/email notification listener, headless task |
| Background | `expo-task-manager`, `expo-background-task` |
| In-app APK updates | `expo-file-system`, `expo-intent-launcher`, `expo-application` (+ `REQUEST_INSTALL_PACKAGES`) |
| Tests | Vitest (`npm test` → `vitest run`, config: `vitest.config.mjs`) — **Node 22+** (Auto Logging tests use `node:sqlite`) |

Android is the only shipped platform today (package `com.kislaya_agarwal.arthik`). iOS config exists but is untested — do not claim iOS support. Follow the existing architecture, patterns, and conventions.

---

# 2. Repository Map

```
App.tsx                 # fonts, theme boot, version check (force update), OTA listener, network listener, deep links, sign-in hydration (the cold start is in SplashScreen via lib/startupLoad.ts)
index.ts                # entry; imports src/features/autoLog/background (headless + periodic tasks) — must stay
schema.sql              # Supabase DDL + RLS policies (source of truth for DB)
CHANGELOG.md            # user-facing change log — keep updated
tests/                  # Vitest unit tests (run with npm test); helpers/autoLogTestEnv.ts = Auto Logging test doubles
docs/                   # architecture, AUTO_LOGGING, RELEASE_PROCESS, design-system, CODEBASE_GUIDE, adr/, specs/
supabase/               # migrations/ (budget modes, autolog_profiles, release flags, sign-up name safety + expense change counter, SEC-11 RLS reference ownership, allowance pause history), functions/delete-user-account
modules/arthik-autolog/ # Kotlin native module (FinancialFilter, SmsReceiver, PaymentNotificationListener,
                        # EventQueue, AutoLogHeadlessService, ArthikAutoLogModule) — change = new APK.
                        # FinancialFilter (no Android types) has JUnit tests in jvm-test/ (outside the module, never packaged):
                        # `npm run test:native`
src/
├── components/   ui/ (AppButton, AmountText, SegmentedControl, BottomSheetModal, AppAlertModal, ScreenHeader, HeaderBackButton, EmptyState, ChevronRotator, PressableOpacity, FormGroup (+ FormRow: Add Transaction details card), …),
│                 profile/ (PauseBudgetModal, EditProfileModal, DeleteAccountModal, styles),
│                 savings/ (SavingsHeader, SavingsHeroCard, BudgetHubSection, SavingsHistorySection, styles),
│                 transfer/ (TransferExtras, TransferDetailCard),
│                 split/ (SplitExtras, MoneyBackExtras, MoneyBackSheet, SplitDetailCard),
│                 BottomNavBar (+ long-press + opens RepeatEntrySheet), RepeatEntrySheet, tour/ (WhatsNewTour overlay, TourTarget), BrandedHeroCard, HeroDetailsSheet, CadenceSwitchModal, VaultSpendingGuardModal,
│                 PeriodRenewalModal, CustomDatePickerModal, BudgetEditModal, MoneyExplainerModal,
│                 StreakCalendarModal, DepositGullakModal, GradientIconBadge, PiggyBankCoinIcon,
│                 CategoryRowItem, AppLockOverlay, SplashCover, OtaUpdateModal, PullToHistoryList, ErrorBoundary, OfflineBanner, SyncFailedBanner,
│                 autolog/ (AutoLogUi + BetaPill, ReviewSheet, WhyLoggedCard, AutoLogHomeBanner, AutoLogGate, EmailSourceInfo, RenameAccountSheet, AutostartGuideCard)
├── features/     autoLog/ (parser, senders, accounts, merchants, digest, autostart, matching, engine, db, service, reviews, ledger, paybackGuard, rollout, background, notificationActions,
│                 notify, permissions, remote, store, copy, types)
├── config/       supabase.ts (client + env; login session stored encrypted through lib/secureSessionStorage, SEC-02), theme.ts (LightColors / DarkColors, design tokens)
├── money/        Money Scope (ADR 0022): scopeMoney.ts (`heroMoney` = every Home hero number, `allowanceCardMoney` = the Savings allowance card) — screens get card figures only from here; ledger.ts, inflow.ts (outside "new money" deposits of a date range), gullakSaved.ts (the day a finished period's savings belong to, INS-002), budgetAllowance.ts, budgetStatus.ts, overspendFunding.ts, dateKeys.ts (`toDateKey`, `WEEK_OPTIONS`: weeks start on Monday, pass it to every date-fns week function)
├── hooks/        useMoneySnapshot.ts (store data for the Money Scope functions), useExpenseForm.ts (+ expenseForm/types.ts), useStoreWhileVisible.ts, useFormKeyboard.ts, useSavingsDashboard.ts, usePullRefresh.ts, useScrollDirection.ts, useFocusEntry.ts, useRingSweep.ts, useNavBarMetrics.ts, useScrimColor.ts
├── lib/          formatters.ts, paymentUtils.ts, iconUtils.ts, budgetUtils.ts, budgetPeriods.ts (facade over periods/ core, pools, carry, streak, calendar, periodSummary, finalize),
│                 budgetCalculations.ts, homeCalculations.ts, heroDetails.ts, heroRing.ts (Home ring real % + second lap, UX-004), moneyWaterfall.ts, transferRules.ts,
│                 cadenceSwitch.ts, vaultSpendingGuard.ts, notificationPolicy.ts, notificationService.ts,
│                 notificationSync.ts, authLinkHandler.ts, amountKeypad.ts, budgetModeUtils.ts, splitLedger.ts,
│                 insights/ (habits, forecast, moneyFlows, yearStory: pure helpers of the 2026-11-25 Insights sections, INS-007..011),
│                 savingsHistoryGroups.ts (Savings history week / month groups + totals, display only), notificationGroups.ts (Notifications date sections + `stackRepeatedNotifications`: 3+ Gullak savings in a row fold into one row that opens; nothing removed),
│                 homeNetworkPill.ts (Home offline / syncing pill waits while the top OfflineBanner is on screen),
│                 allowancePauses.ts (days with no budget: skipped stretches and old pauses, INS-004), streakCalendarData.ts, absence.ts (days the app was closed + few-days-left notice, ROL-004), removalCheck.ts (the one delete check for every screen), periods/allTimeBudget.ts, quickCategoryPick.ts + quickCategories.ts (top categories for the notification buttons), quickAdd.ts (Add again list + time-of-day category pre-pick), whatsNewTour.ts (tour id + steps; next release: new TOUR_ID), asyncStorageList.ts (locked list helpers `changeStoredList` / `removeFromStoredList`), queueLock.ts (one writer per queue key), startupLoad.ts (offline-first splash order, OFL-001), supabasePaging.ts (no silent 1,000-row cut), signOutCleanup.ts (Log Out removes the user's cached copies of server data, never the unsynced queues), secureSessionStorage.ts + expoSessionCipher.ts + sessionCodec.ts (SEC-02: Supabase session encrypted with AES-256-GCM, key in secure storage; plain-text fallback when encryption cannot be proven; never read `sb-*-auth-token` from AsyncStorage directly), navBarLayout.ts, settleReview.ts, chartUtils.ts (facade over charts/ donutSegments, monthlyCharts, gullakMilestones, dualRing), profileUtils.ts,
│                 sheetTransition.ts (shared enter / exit motion of the Cadence, Period Renewal and Vault sheets), whileVisibleSelector.ts (hidden popups keep their last store value),
│                 versionCheck.ts + apkInstaller.ts (force update / in-app APK install),
│                 segmentedMotion.ts (pill springs, landing time, transform-only pill pieces), selectionCommitFence.ts (touch fence for deferred pill values),
│                 alertButtonPalette.ts (themed dialog button colours + contrast; also AppButton `danger`),
│                 pressFeedback.ts (`PRESS_DIM_OPACITY`), scrim.ts (one popup scrim per theme),
│                 appLockGate.ts (`isLockScreenShown`: when the App Lock cover shows)
├── navigation/   index.tsx (Root stack + tabs), navigationRef.ts
├── screens/      Splash, Onboarding, Auth, ProfileSetup, Home (+ HomeScreen.styles, home/HomeRecentItems), History (+ HistoryScreen.styles, history/ HistoryRows, HistoryEmptyState, historyHelpers),
│                 ExpenseForm (+ ExpenseFormScreen.styles, expenseForm/CategoryChipItem),
│                 Insights (with insights/ periodUtils, PeriodNavigator, useInsightsData, useInsightsExtras + InsightsExtraSections + InsightBreakdownCard (the 2026-11-25 sections), YearStory, styles),
│                 Savings, ExpenseForm, ExpenseDetail, Ledger (+ ledger/LedgerParts: TallyBar, PersonInitial), CategoryDetail, ManageCategories,
│                 AddEditCategory, Notifications, Profile, ResetPassword, GullakDepositDetail, Faq,
│                 UpdateRequired, autolog/ (Center, Setup, WelcomeBack, Review, Accounts, Info, Intro, Email)
├── store/        authStore, categoryStore,
│                 expenseStore (facade; expense/ pendingQueues, syncPending, types, payload, recoveryMiddleware, moneyBack, versionProbe,
│                   saveGuards, mutationActions (add / update / delete), loadActions, failedSyncActions),
│                 dailyBudgetStore (facade; dailyBudget/ deficitCheck, expenseBridge, metrics, pendingStorage, rollover, types,
│                   gullakActions, syncActions (syncWithExpenses / checkAndRollover / uploadPendingDailyRecords), recordActions,
│                   planActions → planSync, absenceActions, lastOpenSync, moneyImpact, pureDeficit, pendingPlan, cadenceActions, budgetModeActions,
│                   hydrate → hydrateRemote, hydrateOffline),
│                 transferRulesStore, notificationStore, networkStore, navBarStore, themeStore, appLockStore, ambientStore, otaStore, tourStore ("What's new" tour step + spotlight targets, shown once per TOUR_ID), splashCoverStore, alertStore
└── types/        index.ts (RootStackParamList, TabParamList)
```

**Pill rule (ADR 0020)**: pills animate transform / opacity / backgroundColor only (never `width`, `left`, Text `color`), and heavy screens hear about a tap only after the pill has landed (`commitOnSettle`). `App.tsx`'s root `onTouchStart` must keep flushing `selectionCommitFence`.

**UI consistency rule (ADR 0021)**: every pushed page with a title uses `ScreenHeader` (`src/components/ui/ScreenHeader.tsx`): 48dp bar, `HeaderBackButton` on the left, actions on the right, 20px bold title centred on the bar and announced as a heading; only main tabs use the 28px left-aligned title. Never draw an `ArrowLeft` back button or a title row by hand. Every tappable element gives press feedback: `AppButton` (scale) for real buttons, `PressableOpacity activeOpacity={PRESS_DIM_OPACITY}` (`src/lib/pressFeedback.ts`) for rows / icons / chips; a raw `Pressable` without feedback is only for backdrops. Button size ladder (only three heights, `tests/buttonSizeLadder.test.ts`): 60 (`cta`) for every full-width button at the bottom of a page or bottom sheet, and every button stacked with it (Log Out, Delete, Not now); 48 (`standard`) in centered dialogs and for full-width buttons inside a card or content block; 36 (`compact`) for small pill actions inside content (Change, See More, Edit, empty-state actions). A pill's height is set with `ControlHeight`, never made from `paddingVertical`. Never 44 / 46 / 50 / 52 / 56. Every dialog / sheet scrim comes from `useScrimColor()` (`src/lib/scrim.ts`). Every empty page / list / card uses `EmptyState` (`src/components/ui/EmptyState.tsx`, `size="screen"` or `"section"`). Savings (Gullak) violet and Insights coral come only from `ScreenHue` (`src/config/theme.ts`, the vivid original hues, restored by the owner 2026-11-21; never write their hex in a component). Mint / coral used as TEXT (amounts, links) use `colors.mintText` / `colors.coralText` (readable on Light, brand values on Dark / AMOLED); the brand fills stay for pills and backgrounds. Every small UPPERCASE label uses `letterSpacing: LetterSpacing.label` (0.8; badges, chart labels and fixed tiles excepted). Guarded by `tests/uiConsistency.test.ts`.

**High blast-radius files**: `dailyBudgetStore.ts (+ src/store/dailyBudget/*)`, `expenseStore.ts (+ src/store/expense/*)`, `budgetPeriods.ts (+ src/lib/periods/*)`, `cadenceSwitch.ts`, `vaultSpendingGuard.ts`, `budgetCalculations.ts`, `moneyWaterfall.ts`, `ExpenseFormScreen.tsx`, `SavingsScreen.tsx`, `HomeScreen.tsx`, `features/autoLog/engine.ts`, `features/autoLog/matching.ts`, `features/autoLog/service.ts`, `modules/arthik-autolog/**` (native → APK), `UpdateRequiredScreen.tsx` + `lib/versionCheck.ts` (force update for every user).
> **File inspection rule**: Inspect ONLY the relevant sections/functions needed for the current task. Do NOT scan entire files or read whole files end-to-end unless the task strictly requires it.

---

# 3. Commands

```bash
npm install                      # install dependencies
npm test                         # vitest run — all unit tests
npx tsc --noEmit                 # type check (covers src/ and tests/) — same as npm run typecheck
npm run test:native              # Automatic Logging Kotlin unit tests on the JVM (needs a JDK on JAVA_HOME)
npx vitest run tests/autoLogParser.test.ts tests/autoLogFlows.test.ts tests/autoLogEmail.test.ts   # Auto Logging only
```

**Definition of Done (MANDATORY 4-STAGE QUALITY GATE)**:
Before reporting done, the agent must strictly satisfy all 4 gates:
1. **Compilation & Types Gate**: `npx tsc --noEmit` must produce 0 type errors.
2. **Logic & Test Gate**: `npm test` must pass with 0 failures. If any logic, calculation, or helper was modified or created, update existing tests or add new tests to permanently prevent regressions.
3. **UI & Theme Integrity Gate**: Verify that neither existing nor new UI is broken across **Light, Dark, and AMOLED** themes. Ensure readable contrast, proper SafeArea insets (no notch/navigation clipping), and correct layout responsiveness.
4. **Release & Documentation Sync Gate**: Synchronize all affected and interconnected documentation files across the repository (`docs/*.md`, `docs/maps/*`, `docs/adr/*`, `docs/specs/*`, `docs/README.md`), update `CHANGELOG.md` (under `[Unreleased]`), and update `app.json` OTA highlights (`expo.extra.otaUpdate.highlights`) for user-facing changes so docs, maps, specs, ADRs, and the in-app release modal remain 100% accurate with true app code at all times.

**Done Reporting Protocol**:
When presenting the final outcome to the user:
- State clearly what was verified and any items that could not be tested locally (e.g. native biometric, live Supabase network).
- Confirm unrelated features were not touched or modified.
- Explicitly flag if the change requires a new APK build rather than an OTA update.
- Clearly provide manual owner actions: If a task requires steps only the owner can execute (running SQL in Supabase dashboard, `eas build`, keystore / credentials, GitHub Releases, or testing on physical phones), provide the exact SQL or steps for the user.

**Metro server rule:** Only run one Metro server on port 8081 (`--port 8081`).
There is **no ESLint and no Prettier** in this repo. Do not add or run them.

---

# 4. Expo Version & Documentation

Target is **Expo SDK 57** (`expo-dev-client`, no Expo Go). Installed Expo & native modules: `expo-application`, `expo-auth-session`, `expo-background-task`, `expo-constants`, `expo-crypto`, `expo-dev-client`, `expo-file-system`, `expo-font`, `expo-haptics`, `expo-intent-launcher`, `expo-linking`, `expo-local-authentication`, `expo-notifications`, `expo-secure-store`, `expo-sqlite` (SQLCipher), `expo-status-bar`, `expo-task-manager`, `expo-updates`, `expo-web-browser`, `@react-native-community/datetimepicker`, `@react-native-community/netinfo`, `react-native-safe-area-context`, `react-native-screens`, `react-native-svg`, `react-native-reanimated` + `react-native-worklets`, `react-native-gesture-handler`, `@shopify/flash-list`.

### Native Dependency Addition Gate (STRICT USER APPROVAL MANDATORY)
- **Zero Autonomous Native Dependency Additions**: The agent must NEVER unilaterally install or add any native library or native dependency (`package.json`, `app.json` plugins, or native modules).
- **Mandatory User Permission Protocol**: If a requested feature genuinely requires a new native library, the agent MUST stop and explain to the user:
  1. Exact library name and version proposed.
  2. Why it is required and why existing libraries cannot accomplish the task.
  3. That adding native code invalidates JS-only OTA updates and strictly requires building a full new APK binary (`eas build -p android --profile preview`).
  4. Explicitly prompt the user for permission: *"Do you approve adding this native dependency and generating a new APK build?"*
- The agent must WAIT for explicit user confirmation (**"YES" / "HAAN"**) before running any installation.
- Once explicitly approved, always install using `npx expo install <package>` and confirm with `npx expo install --check`.

Consult external Expo 57 docs only when debugging unfamiliar native build/config issues; standard React Native and Expo APIs do not require doc lookups.

---

# 5. Task-Scoped Work

Work with surgical precision and zero-breakage guarantee:
1. **Targeted Inspection with Cascade Awareness (Zero Breakage Invariant)**:
   - By default, focus ONLY on the specific file(s) and lines directly related to the user request. Do NOT scan unrelated files or grep the entire codebase blindly.
   - **Dependent & Cascade Inspection Allowed**: If there is any hint, risk, or dependency that changing a file will affect other files, or if completing the feature properly requires inspecting dependent files, the agent is FULLY authorized to inspect those files. Under NO circumstances should any existing or related feature break. Unless a direct dependency or cascade exists, remain strictly focused and do not jump across files unnecessarily.
2. **Implementation Quality First, Minimal Diff Second** (binding for money logic; elsewhere ponytail's shortest-working-solution wins, see PONYTAIL PRECEDENCE at the top):
   - The primary objective is a complete, robust, and clean implementation. Never compromise quality, stability, or correctness just to force a smaller diff.
   - Once a robust implementation is designed, ensure zero boilerplate: write only the exact lines of code needed without speculative abstractions, dead code, or refactoring untouched working code.
3. **Reuse Existing Code**: Leverage existing stores, UI primitives (`AppButton`, `AmountText`, `SegmentedControl`, etc.), hooks, and math helpers before creating new ones.
4. **Root-Cause Fixes & Scope Discipline**: Fix bugs directly at their root cause rather than adding repetitive patches across callers. Do not rename files, components, or variables without a valid architectural reason. Never commit `.env`, keys, secrets, or binary APKs.

---

# 6. Architecture Rules

## 6.1 Existing Code First & Facade Pattern (MANDATORY ARCHITECTURE INVARIANT)
- Screens render UI and call store actions. Stores manage Supabase, AsyncStorage, and state. `src/lib/` holds pure helpers.
- **Offline queues (OPT-60/61/72, data safety)**: every online expense add / edit / delete is written to its offline queue BEFORE the request and removed only when the server confirms and the entry is unchanged. Any new code that changes a queue key (`@arthik_pending_*`, `@arthik_cached_*`) must do the read→change→write inside `runExclusive(key, …)` from `src/lib/queueLock.ts` (never a network call inside it). For the list queues use `changeStoredList` / `removeFromStoredList` (`src/lib/asyncStorageList.ts`); a flush must NEVER write back the copy it read before the request (it erases what was queued meanwhile): it removes only the confirmed items from a fresh, locked read. A queued profile-settings patch is sent whole and only the sent values are cleared (`clearSentPendingSettings`). The allowance pause history (`@arthik_pending_allowance_pauses_<userId>`, `allowancePauseSync.ts`) is queued whole and sent in its OWN profile request, never inside the main profile query / update, so a missing column can only fail that sync. Remembered transfer notes (`syncPendingTransferRules`) are sent BEFORE the expense queues (foreign key). Wrap a Supabase query in `Promise.resolve(...)` before awaiting it twice (a query re-sends itself on every `.then`). Server rows computed from the expense list may only be written when `areExpensesFreshFromServer()` is true. **Skip-unchanged download (OPT-69)**: `fetchExpenses` keeps the list in memory when the server's expense change counter (`arthik_expenses_version`, read BEFORE the download via `src/store/expense/versionProbe.ts`) is the same as before the last successful download and is ≥ 1; every failure means a full download. Never read the counter after the rows, and never remember a counter whose download did not succeed.
- **Zero Monolithic God Files (Facade Pattern Rule)**: Under NO circumstances should any store or feature grow into an unmaintainable 2,000–2,500 line monolithic file. Any complex store or domain feature exceeding ~350–400 lines MUST strictly follow the **Facade Pattern** (as standardized in `dailyBudgetStore.ts` and `expenseStore.ts`). Store actions that grow live in submodule factories that receive the store's own `set` / `get` (`createGullakActions(set, get)`, `createMutationActions(set, get)` …) and are spread into the store; a `let` used only by moved actions moves with them; a submodule never imports its own store. Big screens keep their styles in `<Screen>.styles.ts` and their row / item components in a `screens/<name>/` folder. Source-reading tests use `tests/helpers/readSplitSource.ts` so a pure move never changes an assertion.
  - **Public Facade**: The root file (e.g., `src/store/dailyBudgetStore.ts`) serves purely as a public facade exposing external contracts, Zustand hooks, and selectors.
  - **Categorized Submodules**: Internal logic must be cleanly decomposed into dedicated, single-responsibility modules under a feature subfolder (e.g., `src/store/dailyBudget/`):
    - `types.ts` — Interfaces, domain contracts, and action signatures.
    - `metrics.ts` — Pure mathematical calculations and balance selectors.
    - `pendingStorage.ts` — AsyncStorage offline queues and key schemas.
    - `planActions.ts` — User mutations, cadence transitions, and plan queues.
    - `hydrate.ts` — Supabase boot hydration and offline fast-paths.
    - `rollover.ts` — Midnight finalization and cadence rollover cycles.
    - `expenseBridge.ts` — Cross-store callbacks preventing circular imports.
- **Zero Circular Dependencies**: Submodules must receive required state or setters via parameters/callbacks; never import the parent store or peer stores directly. Cross-store wiring must strictly use explicit registration callbacks (`registerSyncCallback`, `registerExpenseGetter`, `registerExpensesLoadedGetter`, `registerStoreResetCallback`, `registerCategoryDeleteCallback`).

## 6.2 Dependencies
- No new dependencies if avoidable. Use already installed packages (`date-fns`, `lucide-react-native`, `react-native-svg`, `react-native-reanimated`, AsyncStorage).
- Any new dependency with native code strictly requires following §4 (Native Dependency Addition Gate) and mandates a full APK build.

## 6.3 Supabase & Data Access
- Every query must respect RLS scoped to `auth.uid()`. Client uses the anon key only. Edge functions (`supabase/functions/delete-user-account`) handle sensitive administrative operations.
- `schema.sql` is the source of truth for the DB. If tables/columns change, update `schema.sql` and provide the SQL for the user to run in Supabase.

---

# 7. Offline-First, Data Integrity & Sync Invariants

- **Offline Queue System**: Offline writes queue in AsyncStorage (`@arthik_pending_expenses_<userId>`, `@arthik_pending_updates_<userId>`, `@arthik_pending_deletes_<userId>`, `@arthik_failed_sync_<userId>`).
- **Optimistic UI & Zero Data Loss**: Optimistic rows are marked `pending: true`. Never drop or overwrite user data silently; destructive actions strictly require explicit user confirmation.
- **Robust State Handling**: Always handle loading, error, empty, and offline states across all screens and components. Validate inputs at all boundaries (amounts, auth forms, deep links).
- **Session Reset**: On sign-out, all stores must reset their state (`resetCategories`, `resetExpenses`, budget, notifications). `signOut()` also removes the signed-out user's on-phone copies of server data (`clearUserCachesOnSignOut` in `src/lib/signOutCleanup.ts`, SEC-01): expense cache, category cache, profile cache. It must NEVER remove a `@arthik_pending_*` queue or `@arthik_failed_sync_*`. A new per-user cache of server data must be added to that helper. `signOut()` also clears delivered notifications from the tray, and tray recaps are archived into the bell only while someone is signed in (they carry no user id). `setSession` with a session of a DIFFERENT user (no sign-out in between) runs the same store resets first, so one account's in-memory data is never written into another account's rows. `deleteAccount()` removes local storage EXCEPT other accounts' `@arthik_pending_*` / `@arthik_failed_sync_*` queues (every queue key ends with `_<userId>`), never deletes the shared AutoLog DB key (`arthik_autolog_db_key_v1`), and stops capture via `wipeOnAccountDelete`. `ResetPasswordScreen` changes a password only when `hasRecoveryGrant(user.id)` (a real recovery code in this app run); navigation params can be faked by a link.
- **Auth deep links are PKCE only**: `handleAuthDeepLink` and Google sign-in accept only a `?code=` (exchanged with this phone's verifier). Raw `access_token` / `refresh_token` in an `arthik://` link are never applied: any app can send such a link. Never decode a token from a link to decide who it belongs to.
- **Startup Hydration Order (offline-first, `OFL-001`, OPT-71)**: the splash opens from the data saved ON THE PHONE and never waits for the server. `runLocalFirstStartup` (`src/lib/startupLoad.ts`): `loadLocalData` = `loadPendingExpenses` → `loadCachedCategories` → `loadCachedExpenses` → app-lock init (storage reads only), then the app opens; `refreshFromServer` runs in the background = (connectivity) → `fetchCategories(true)` → (`fetchExpenses` + `hydrateFromSupabase`) in parallel. Only a phone with no saved expenses (first run) waits for the refresh, at most 5 s. Never add a network call to `loadLocalData`, never `await` the server in `SplashScreen`, and never call `fetchCategories`/`fetchExpenses`/`hydrateFromSupabase` before the saved categories are loaded. `hydrateFromSupabase` is single-flight per user. `setSession` with a saved profile returns at once (profile refresh in the background). `checkConnectivity` treats an unknown reachability (`null`) as online.

---

# 8. Dates, Money & Formatting

- **REAL MONEY INVARIANT (FOUNDATIONAL RULE)**: Every rupee tracked in Arthik is **real money**. No balance, budget allowance, or deposit is virtual or play money. Daily budget allowances set by the user represent real cash funded into their account on those days. If Budget Mode is switched OFF (Pure Mode), past active days' allowances remain real deposited funds in all-time, monthly, and weekly Inflow — never delete, vanish, or ignore them.
- Store/compare dates as `yyyy-MM-dd` strings. Parse with `parseISO`, never `new Date('...')`.
- Use `date-fns` (`format`, `isToday`, `isYesterday`, `subDays`) for date math.
- Render money only through `formatCurrency` / `formatAmountWithCommas` from `src/lib/formatters.ts` (`₹`, Indian grouping). Never inline `toLocaleString`. Whole rupees show no decimals; paise always show two digits (₹13,834.50) via `formatRupeeNumber`, which `AmountText` shares.
- Amounts in state are `number`. Keypad manages strings and converts once.
- "Today" is the user's local day. Daily budget/streak calculations depend on it.

## 8.0 Split Expenses & Money Back Invariant (`SPL-001..SPL-006`)
- The store's `Expense.amount` is the COUNTED amount (`amount paid − money back`); `gross_amount` is the amount PAID. Anything that writes an amount back to the database or to a form (edit form, `ledger.ts`, queues) MUST use `grossAmountOf(row)`, never `amount`.
- Money back (`transaction_class = 'recovery'`) is never income and never an expense (`isExcludedFromTotals`). Any new code that sums income by hand must use `classifyTransaction` / `isCountedIncome` / `isCountedExpense` / `isExcludedFromTotals` (they take the row only; categories never decide direction, ADR 0023), never a bare `=== 'self_transfer'`.
- Who owes what is derived (`src/lib/splitLedger.ts`), never stored. The `expenses` list is normalised in ONE place (`src/store/expense/recoveryMiddleware.ts`); do not re-apply money back anywhere else.
- New database columns are sent only by rows that use them (`src/store/expense/payload.ts`).

## 8.1 Two States Only & Budget Hydration Invariant (CRITICAL)
- **Only Budget Mode or Pure Mode** (owner decision 2026-11-28, spec `docs/specs/2026-11-28-simple-money-rules.md`). There is no paused allowance: `isAutoRenew` (still a database column) always equals the mode. Never add a third "off" state.
- **No Hardcoded Defaults Overriding User State**: Never use hardcoded fallback values (`|| 100` or `|| 500`) that coerce 0 or overwrite custom user allowances (e.g. ₹250).
- **A saved budget of 0 is a fact** (Pure Mode or skipped day): hydration and the waterfall never rebuild it from the plan or the current amount.
- **Gullak is one running balance** built only by `computeWaterfallFromState` (pass `budgetPeriods`, and `skipped`). It never goes below zero; the rest is a `deficit` only later income pays. Never rebuild or cap Gullak with a second formula. Invariant (tests/moneyInvariant.test.ts): total = income left + Gullak + running budget left − deficit.

## 8.2 Mode Switching Next-Day Scheduling & Same-Day Reversal Protection (`PUR-003`)
- **Next-Day Scheduling**: Toggling between Pure Mode and Budget Mode takes effect from tomorrow at 12:00 AM (`effectiveFrom = tomorrow`). Today's running-day budget and midnight Gullak savings conclude cleanly without disruption.
- **Same-Day Reversal Protection**: If the user toggles back on the same day, `handleCancelPendingPlanChange` immediately cancels the pending switch, removes scheduled notifications (`removeNotification`), and seamlessly maintains the current active mode.
- **Matured Switch (FIN-16)**: a scheduled switch can mature while the app is closed; hydration (`hydrate.ts`) and the rollover (`rollover.ts`) both use `resolveAutoRenewForPlan` (auto-renew = mode). The first Budget Mode day must have its allowance (`healZeroTodayAllowance`). A cold-start Pure → Budget switch runs the PUR-001 deficit check once, only when expenses are server-fresh and before the new day's allowance (`deficitCheck.ts`, `balancePureDeficit`). Guarded by `tests/dailyBudgetHydrate.test.ts`.
- **Switching & Absence** (canonical `BPR-002`, `CAR-001`, `PUR-002`, `ROL-004`): a budget that ends early sends its leftover to Gullak unless "Carry forward"; the carried amount is settled at midnight (`settleCarryAmounts`); same-period return from Pure Mode restores the moved money minus Pure Gullak draws (the waterfall does it); 7+ days away with no expense waits for the user's choice (`lib/absence.ts`, `absenceActions.ts`, skipped stretches in `allowancePauses`).
- **One affordability check**: adding, editing or deleting money uses `previewMoneyImpact` (`store/dailyBudget/moneyImpact.ts`). Every delete screen (History swipe, detail screens, Savings) goes through `src/lib/removalCheck.ts`; never call `deleteExpense` / `removeGullakDeposit` from a screen without it.
- **One total** (`BAL-001`): the Home "All" card takes its budget from `allTimeBudget` (pass the waterfall pools), the same number the spending guard uses. Never add a second formula.
- A carry is settled only from a server-fresh expense list (`areExpensesFreshFromServer`).
- **Vault Spending Guard & Period Overspend Solvency**: Exceeding a weekly or monthly budget allowance draws from unspent Income and Gullak reserves; Digital Vault Guard blocks new expense creation strictly when total account liquidity is exhausted (`accountRemaining <= 0`).

---

# 9. UI Styling Rules

**MANDATORY DESIGN LANGUAGE INVARIANT**: Any new UI screen, modal, card, or component added or modified in Arthik MUST strictly consume the canonical design tokens from [`src/config/theme.ts`](src/config/theme.ts) and the approved UI primitives from `src/components/ui/` as defined in [`docs/design-system.md`](docs/design-system.md). Never introduce ad-hoc font sizes, arbitrary button/input heights, raw hex codes, or screen-specific padding. Same semantic role = same visual treatment everywhere.

## 9.0 Design Contract & Specification — Read Before Any UI Work

**[`docs/design-system.md`](docs/design-system.md) is the canonical design contract and usage guide for this repository.** Read it in full before implementing or modifying any screen, modal, card, component, chart, or icon. It is not optional documentation.

The two layers of design authority:

| Layer | File | Role |
| --- | --- | --- |
| **Runtime Tokens** | [`src/config/theme.ts`](src/config/theme.ts) | Numeric values: spacing, radius, font sizes, control heights, colors. Never hardcode these. |
| **Design Contract & Usage Guide** | [`docs/design-system.md`](docs/design-system.md) | Single canonical specification: principles, token tables, component anatomy, motion physics, financial tiers, audit checklist. |

### Design Gap Protocol
If a new UI requirement cannot be satisfied by the current design system:
1. Identify the gap precisely (which role, dimension, or pattern is missing).
2. Explain why no existing token or primitive covers it.
3. Propose the new token / pattern and its semantic role.
4. **Stop. Ask for approval before introducing it.**

Do not silently invent spacing values, font sizes, radii, button heights, icon sizes, or color styles.

## 9.1 Theme & Colours
- All colours come from `src/config/theme.ts` (`LightColors` / `DarkColors` / `AmoledColors`) via `useTheme()`. No hardcoded hex in screens.
- Test changes in Light, Dark, and AMOLED themes.

## 9.2 Design Tokens & Canonical Source of Truth
The canonical design tokens and UI architecture are documented in [`docs/design-system.md`](docs/design-system.md).
- **Runtime Source of Truth**: All design tokens (`Spacing`, `BorderRadius`, `FontSize`, `FontFamily`, `ControlHeight`, `LightColors`, `DarkColors`) live strictly in [`src/config/theme.ts`](src/config/theme.ts). Never define alternative values elsewhere or hardcode hex/spacing/sizes in screens.
- **Behavioral Source of Truth**: Shared UI primitives (`<AppButton />`, `<AmountText />`, `<SegmentedControl />`, `<TransactionRow />`, `<StatusBadge />`, `<GradientIconBadge />`) govern interactions, layout encapsulation, and accessibility.
- **Consult `docs/design-system.md`** for the complete semantic role mapping, typography hierarchy, financial amount rules, and usage examples before writing UI code.

### Introducing New Tokens or Component Variants
1. **No numeric duplicates**: Do not add a new token if an existing semantic token satisfies the role.
2. **7-Question Check**: Verify the proposed token represents a single semantic role, is not numeric coincidence, is understandable, future-proof, and not better served as local geometry or an encapsulated component.
3. **Registration Order**: Add the token in `src/config/theme.ts`, document its semantic role in `docs/design-system.md`, and verify with `npx tsc --noEmit` and `npm test`.

## 9.3 Deliberately Non-Tokenised Values
When an element's role does not match an established token, use the literal number:
- Circle geometry: `borderRadius: width / 2` (e.g. 16 for 32x32, 24 for 48x48, 28 for 56x56). Never use radius tokens for circles.
- Icon-button sizes (`32`, `36`, `40`, `44`, `48`) and intermediate fonts (`11`, `13`, `15`) remain literal numbers. Never round numbers to force-fit a token.

## 9.4 Role Matching
Match tokens by semantic role, not numeric coincidence (e.g. an icon spacer container is not a screen gutter; an icon box is not an input container).

## 9.5 Currency Symbol Alignment
Use `alignItems: 'center'` on the wrapping `flexDirection: 'row'` container for amount and `₹`.

## 9.6 Safe Area Insets
Always use `useSafeAreaInsets` from `react-native-safe-area-context` (`paddingTop: insets.top`). Never use `SafeAreaView` from `react-native` or hardcode top margins.

## 9.7 Component Architecture & Animation Physics
- Spring animation physics: Apple-calibrated critically damped spring (`tension: 100, friction: 16`, `extrapolate: 'clamp'`, zero overshoot). Liquid morph secondary snaps use `tension: 140, friction: 14`. Press feedback uses `0.93–0.94` scale with `friction: 4`.
- Layouts must be responsive on small screens.

## 9.8 Navigation
- Every route is typed in `src/types/index.ts` (`RootStackParamList`, `TabParamList`).
- Imperative navigation uses `navigationRef`. Guard back buttons with `navigation.canGoBack()`.
- `BottomNavBar` is a custom floating capsule bar driven by `navBarStore` + `useScrollDirection`.

## 9.9 Icon Badges & Gullak Icons (Design Language Invariant)
- **Always use `GradientIconBadge`**: All category, feature, and transactional icons (including Gullak, PiggyBank, Savings, and category rows) must use `GradientIconBadge` from `src/components/GradientIconBadge` with dynamic `iconColor`.
- **Gullak Theme**: Gullak deposits, milestone cards, and detail headers must use `GradientIconBadge` with `color="#ADEBB3"` and `PiggyBankCoinIcon` (e.g. `({ iconColor }) => <PiggyBankCoinIcon size={...} color={iconColor} />`).
- **Never use plain flat circles**: Do NOT create ad-hoc flat circular containers (`backgroundColor: iconBg`, `borderRadius: width / 2`, etc.) for feature or transaction icons. Always use `GradientIconBadge`.

## 9.10 Segmented Controls & Filter Pills (Design Language Invariant)
- **Canonical Primitives**: `<SegmentedControl />` (`src/components/ui/SegmentedControl.tsx`) for fixed-option segmented controls and `<BouncyCategoryFilter />` (`src/components/BouncyCategoryFilter.tsx`) for horizontal scrollable category pills.
- **Container Heights**:
  - Screen, Tab & Modal Filters (`HistoryScreen`, `SavingsScreen`, `InsightsScreen`, `ProfileScreen`, `BudgetEditModal`, `BouncyFilterToggle`): Must strictly and uniformly use `ControlHeight.standard` (`48px`). Legacy 44px or arbitrary heights are strictly prohibited.
  - Add Transaction (owner-approved 2026-11-21, ADR 0021 amendment): `BouncyTypeToggle` is the page switch: full-width 56dp (`ControlHeight.row`), one step bigger than the choices below it; `BouncyPaymentToggle` and the "What is this money?" control are full-width 48dp (`ControlHeight.standard`) tracks on `cardSubtle`, each a full-size section (never a thin 36dp track for a primary choice). Switches use the one app-wide `AnimatedToggle` size (58x30). Optional details (Date, Split, Between my own accounts, Note) are rows of one inset card (`FormGroup` / `FormRow`, `src/components/ui/FormGroup.tsx`: one-line 56dp rows, plain line icons, no icon tiles; a switch's explanation opens inside its row only when it is on). Stand-alone fields elsewhere keep the label + 56dp pill anatomy.
- **Surface & Border Colors**: Pill containers strictly use `colors.cardSubtle` (`#1A263B` in Dark, `#121212` in AMOLED, `#F1F5F9` in Light) with border `colors.borderSubtle`. Never use `colors.card` or raw pitch-black for pill backgrounds; all pills must maintain a unified, elevated grayish surface across all themes. In form contexts, use `colors.inputBg`.
- **Active & Inactive Text**: Active text must strictly use deep contrast `colors.forestGreen` (`#1A2B4C`) + `FontFamily.bold` on both `mintGreen` and `peachCoral` active pills. **Never use `colors.coral`, `textPrimary`, or foreground matching the active pill background.** Inactive text strictly uses `colors.textSecondary` + `FontFamily.medium`.
- **Apple Dual-Edge Liquid Morph**: Primary slide uses critically damped spring (`tension: 100, friction: 16`), direction-aware leading-edge stretch (`scaleX: 1.08–1.28`), and vertical volume squish (`scaleY: 0.96–0.88`) with strict inner track clipping (`overflow: 'hidden'`).
- **Direct-Manipulation Touch Agency**: In scrollable pill filters (`BouncyCategoryFilter`), tapping a category must NEVER trigger automatic `scrollTo`. The user retains complete direct-manipulation agency to scroll manually, while the highlight pill glides fluidly to the tapped option.
- **Touch Interaction & Tab Selection Invariant (CRITICAL)**:
  - `<SegmentedControl />` MUST strictly trigger tab switching on standard touch release via `onPress={onPress}`. Never hijack touch-down with speculative props like `selectOnPressIn`, `onPressIn` callbacks, or custom press-handling refs (`pressedInHandled`). In React Native on Android, mutating component tree state during `onPressIn` or caching press status in refs desynchronizes gesture responders and permanently locks out tabs (such as the Weekly pill in `InsightsScreen`).
  - HitSlop on adjacent segmented buttons must NEVER have horizontal overlap (zero horizontal hitSlop between neighboring segment buttons), but the outer edges must provide generous outer hitSlop (`left: 16` on the first option, `right: 16` on the last option) and `pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}` so long-distance thumb reaches across from the opposite end of the phone never drop taps or suffer micro-slide cancellations.
  - When hosted inside a `<ScrollView />`, the scroll view must specify `keyboardShouldPersistTaps="handled"` so taps on segment options are never swallowed or delayed.

## 9.11 Category Icon Registry & Direct Icon Imports (OPT-01 / OPT-02 Invariant)
- **Category Picker Icons**: Any new category icon added to the picker grids (`ICONS_GRID` or `INCOME_ICONS_GRID` in `src/screens/AddEditCategoryScreen.tsx`) MUST also be added to `CATEGORY_ICONS` in `src/lib/categoryIconRegistry.ts`, or it will render as a fallback question-mark icon (`HelpCircle`).
- **Zero Lucide Barrel Imports**: Never use `import { ... } from 'lucide-react-native'` or `import * as LucideIcons`. Always import specific icons directly from `lucide-react-native/icons/<stem>`.

---

# 10. Notifications

- **Canonical Specification**: Read [`docs/notifications.md`](docs/notifications.md) before modifying any notification behavior. Single source of truth is the pure helper [`src/lib/notificationPolicy.ts`](src/lib/notificationPolicy.ts) (tested via `tests/notificationPolicy.test.ts`).
- **All Scheduled Notifications Delivered**: Deliver all legitimately scheduled notifications as configured (budget alerts, Gullak rewards, weekly/monthly recaps, evening nudges) without artificial suppression.
- **Never Nag Invariant**: The evening nudge (20:30) exists only on days with zero expenses logged. Logging an expense immediately cancels tonight's nudge via `notificationSync.ts`.
- **In-App Bell Synchronization**: All notifications (whether arriving while the app is in background or active session) must be visible and recorded in the in-app notification bell (`notificationStore`) so the user never misses their complete notification history. Folding routine Gullak savings into one expandable row (`stackRepeatedNotifications`) is display only; never fold alerts, never drop an item.
- **Channels & Services**: Local notifications go through `src/lib/notificationService.ts` across 4 Android channels (`Budget alerts`, `Reminders`, `Gullak updates`, `Weekly & monthly recaps`). Handle permission denial gracefully; avoid rescheduling loops on re-render.

---

# 11. Deployment, Versioning & OTA Updates

## 11.1 Build profiles (`eas.json`)
| Profile | Use | Output |
| --- | --- | --- |
| `development` | dev client for emulator/device debugging | debug APK |
| `preview` | the GitHub-distributed APK, channel `preview`, `autoIncrement` versionCode | APK |
| `production` | store-style release, channel `production`, auto-increments | AAB |

## 11.2 Full APK build vs OTA Update
- **Full APK (`eas build -p android --profile preview`)**: required when native code, permissions, native plugins, or app version changes.
- **OTA update (`eas update --branch preview --environment preview --message "..."`)**: JS/TS, UI, and logic changes only.
- `runtimeVersion` is tied to `expo.version`. Bump version in `app.json` and `package.json` only when building a new APK binary. Update `CHANGELOG.md` in the same commit.

## 11.2a Releasing an APK & forcing the update
Follow `docs/RELEASE_PROCESS.md` (generic `X.Y.Z` playbook). Key points: same keystore every release; GitHub tag `vX.Y.Z` with assets **`Arthik-vX.Y.Z.apk`** + copy **`Arthik.apk`**; force update = Supabase `app_config.version_control` (see §18). The agent never runs builds, uploads releases or runs SQL — it prepares code/docs and writes the exact manual steps.

## 11.3 In-App OTA Update Popup Invariant (`OtaUpdateModal` & `app.json`)
- **"What's New" Highlights Update**: Whenever an OTA release is prepared without bumping the version (the standard OTA workflow), you MUST update `app.json` (`expo.extra.otaUpdate.title` and `expo.extra.otaUpdate.highlights`) and `src/store/otaStore.ts` (fallback highlights).
- This ensures the in-app update popup (`OtaUpdateModal`) that displays on user devices after downloading the update accurately communicates the exact changes, fixes, or improvements in that release. Never release an OTA update with stale highlights from a previous release.
- **"What's new" spotlight tour (owner rule, 2026-11-25)**: every release with a new feature the user can see or use also gets a tour step for it. Set a new `TOUR_ID` and replace `TOUR_STEPS` in `src/lib/whatsNewTour.ts` (one step per feature: the tab it lives on, a title of at most 36 characters, a body of at most 170), and wrap each feature in `<TourTarget id=…>` (pass the screen's `scrollRef` when it can be below the fold). The tour is a dim scrim with a plain cut-out around the feature; it has no ring or pulse. Fixes-only releases keep the old `TOUR_ID`, so no tour shows.

## 11.4 Version Bump Guard & Pre-OTA Confirmation Invariant (CRITICAL)
- **Check Before Every OTA Release**: Prior to executing any `eas update` command, the agent MUST inspect `app.json` and `package.json` to verify whether the app version string has changed.
- **Explicit Confirmation Mandatory on Version Bump**:
  - If a version bump is detected (e.g. from `1.2.4` to `1.2.5`), the agent **MUST STOP and ask for explicit user confirmation** before running the OTA update command.
  - The confirmation prompt must clearly alert the user: *"Version bump detected from X to Y. In Arthik, `runtimeVersion.policy = 'appVersion'`. Publishing an OTA update under a bumped version means it will NEVER reach existing user devices running the previous APK binary. Do you intend to build a full APK binary (`eas build`), or should this OTA update remain on the current version?"*
- **Intentional Version Bumps**: Version bumps are NOT prohibited, but they must be explicitly and specifically requested by the user (typically when cutting a release for a new binary APK). Even when explicitly requested by the user, the agent must still request final confirmation before executing to prevent catastrophic OTA desynchronization.

---

# 12. Development Build & Android Emulator

- Port reverse: `adb reverse tcp:8081 tcp:8081`
- Dev client URL: `arthik://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081`
- App package: `com.kislaya_agarwal.arthik`
- Dev client start: `npx expo start --port 8081`
- Phone **and** emulator together: run `adb -s <device> reverse tcp:8081 tcp:8081` per device (`npm run android` fails with "more than one device"). The owner's local `dev-both.ps1` does this.
- Native change (Kotlin / plugins / permissions / native deps) → new dev build (`eas build -p android --profile development`); JS changes hot-reload.
- Emulators cannot send bank-style SMS (numeric senders are dropped as personal). Use **Developer test tools** (Automatic Logging Center, `__DEV__` only).

---


# 13. Communication & Response Style

- **Conversation with User**: Converse strictly with the user in **Hinglish** (Roman-script Hindi + English mix). Never respond to the user in pure English or pure Devanagari.
- **In-App Copy & Code Language (English Only)**: Any copy or text within the application (UI labels, buttons, screen titles, descriptions, error messages, banners, notifications, modals) must NEVER be written in Hinglish — these must always be in standard English. Source code, comments, commit messages, and documentation must also remain strictly in English. Hinglish is **solely and exclusively** for chat conversations with the user.
- **Simple, Clear & Non-Technical In-App Copy**: All English copy written for the app must be exceptionally simple, natural, and user-friendly so that any user understands it instantly on the first read. Do not use heavy English vocabulary, pretentious words, or technical jargon. Deliver clear meaning with concise wording and minimal lines.
- **Concise & Outcome-Focused Responses**: After executing an instruction or task, do not generate long, exhaustive paragraphs or overwhelming micro-details (walls of text) that cause reading fatigue. Summarize only the critical outcomes and essential updates that the user genuinely needs to know. Keep responses short, crisp, bulleted, and in clear Hinglish so they can be parsed effortlessly at a glance.

---

# 14. Documentation & Skill Synchronization (MANDATORY INVARIANTS)

- **Comprehensive Documentation Freshness (Forever Invariant)**: Whenever ANY change, feature, bugfix, UI update, refactor, or architectural modification occurs anywhere in the repository, **ALL documentation files related to or affected by that change** (including `CHANGELOG.md`, `README.md`, `docs/architecture.md`, `docs/prd.md`, `docs/AUTO_LOGGING.md`, `docs/RELEASE_PROCESS.md`, `docs/design-system.md`, `docs/maps/*`, `docs/specs/*`, `docs/adr/*`, and `AGENTS.md`) MUST be updated immediately in the exact same change. From now on and for all future work, documentation must NEVER lag behind code reality — no document is ever allowed to remain stale or drifted.
- **Zero Scope Blindspots**: The agent must never artificially restrict itself to a handful of named files; every document that describes, specifies, or tracks the modified logic, test counts, metrics, or workflows must perpetually mirror 100% true app reality.
- **Mandatory Proactive Skill Execution**: Before and during specialized work, the agent MUST proactively invoke and adhere to the matching installed skill. Matt Pocock's skills (`mattpocock-skills:<name>`) are the default:
  - Logic, money math or a bug fix written test-first → `tdd`
  - Broken, crashing, failing or slow behaviour → `diagnosing-bugs`
  - Reviewing a branch, PR or work-in-progress → `code-review`
  - Module boundaries, store / facade splits, testability → `codebase-design`
  - Domain terms, glossary (`CONTEXT.md`) or a new ADR → `domain-modeling`
  - Trying out a state model or UI idea before building it → `prototype`
  - Stress-testing a plan with the owner → `grilling`
  - Gathering docs or API facts (Expo, Supabase, React Native) → `research`
  - Owner-only manual steps (Supabase SQL, EAS build, GitHub Release) → `wizard`
  - Schema, migration, RLS policy or SQL (`schema.sql`, `supabase/migrations/*`) and Supabase auth, client, edge function or log debugging → the Supabase MCP connector (`mcp__claude_ai_Supabase__*`: docs search, tables, logs, advisors; read-only use). The owner still runs every SQL (§6.3, §18).
  - Writing a PR body → `pr`; editing `AGENTS.md` or a skill → `writing-for-agents`
  - Expo SDK, EAS Build / Update, the dev client or an Expo upgrade → the matching `expo:<name>` skill (e.g. `expo-upgrade`, `eas-update`, `expo-dev-client`); §4, §11 and `docs/RELEASE_PROCESS.md` still decide what ships.
  - Building or changing an animation, gesture, sheet or press feedback → `kislaya-skills:animate-expo` (+ `kislaya-skills:gestures` for drag / swipe / sheets); reviewing existing motion → `kislaya-skills:review-animations` (Emil Kowalski's skills, synced from claude.ai in the `kislaya-skills` plugin). Codebase questions when `graphify-out/` exists → `kislaya-skills:graphify`; React Native performance / list patterns → `kislaya-skills:vercel-react-native-skills`. §9.7 / §9.10 physics and ADRs 0015 / 0020 win where a skill suggests other values.
  - App UI, animation and Android native work: follow §9, [`docs/design-system.md`](docs/design-system.md) and ADRs 0020 / 0021; the app's design system decides every screen.
  - Other installed plugins (`ui-ux-pro-max`, `humanizer`, `last30days`, `claude-md-management`, `i-have-adhd`) run when the owner asks for them; where one overlaps a skill above, the skill above wins. `ponytail` is the exception: it is always on (session hooks) and steers how code is written, per PONYTAIL PRECEDENCE at the top. Commits, pushes and merges still wait for the owner's direct instruction, whatever a skill's steps say.
- **AGENTS.md Rule Synchronization**: If an approved change or feature alters any behavioral constraint, architectural pattern, or financial invariant, the agent MUST immediately update `AGENTS.md` (following the §20 protocol) so the living rulebook accurately mirrors current app behavior.
- **Canonical Alignment**: every change is checked against `docs/ARTHIK_CANONICAL_RULES.md` (see the Canonical Rules Supremacy block at the top). New or changed money logic gets a test that names the canonical rule ID it protects.
- **Changelog Format**: User-visible changes strictly get a clear, concise bullet point in `CHANGELOG.md` under `[Unreleased]` in the same commit, specifying whether the change is an Addition, Fix, or Refactor, and noting whether it is OTA-safe.
- **Small, Focused Commits**: Use imperative commit messages (e.g. `feat(home): ...`, `fix(savings): ...`, `docs(agents): ...`).

---

# 15. Test Coverage Rules

This repo uses **Vitest** (`npm test`). Tests live in `tests/<subject>.test.ts`.

## 15.1 What requires a test
- New or modified `lib/` helpers: financial math, budget calculations (`budgetCalculations.ts`, `budgetPeriods.ts`, `homeCalculations.ts`, `moneyWaterfall.ts`), formatters, and income classifiers.
- Store actions with offline/online logic, pending queues, and sync engines (`src/store/expense/syncPending.ts`, `src/store/dailyBudget/rollover.ts`, `src/store/dailyBudget/hydrate.ts`).
- User isolation logic (per-user storage keys, sign-out reset).
- Real-money calculations, daily rollover, streak calendar data, and Gullak reconciliation.
- Auth deep link or session handling.
- Automatic Logging: every parser / matching / engine behavior. New bank SMS or email format → write the failing test first (`tests/autoLogParser.test.ts` or `tests/autoLogEmail.test.ts`), then fix `parser.ts`. Flow changes → `tests/autoLogFlows.test.ts` / `tests/autoLogEmail.test.ts` using `tests/helpers/autoLogTestEnv.ts` (real db + engine + service on Node SQLite; fake native, ledger, server).
- Force update / rollout rules → `tests/appUpdate.test.ts`, `tests/autoLogRollout.test.ts`.
- Tests that depend on "today" must freeze the clock (`vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime`) — see `tests/budgetModesStore.test.ts`.

## 15.2 What does NOT need a test
- Pure UI layout, colors, spacing, or animation changes.
- Navigation wiring (screen registration, param types).
- Self-evident one-line guards.

## 15.3 Writing & maintaining tests
- **Mandatory Mock Reuse**: When writing new tests, strictly reuse the existing mock implementations already established in `tests/` (e.g. Supabase client, `@react-native-async-storage/async-storage`, and `useAuthStore` / login state mocks). Never reinvent, duplicate, or write conflicting ad-hoc mocks.
- Never delete passing tests unless the feature is deliberately removed.

---

# 16. Stability & Change Discipline

Arthik has completed its major UI/UX stabilization and polish cycle.

The following areas have already been comprehensively reviewed and validated:
- Design system consistency
- Shared UI primitives
- Animation and interaction behavior
- Responsive layouts
- 320–360px narrow-screen behavior
- Light / Dark / AMOLED themes
- Financial information readability
- Modal and gesture behavior
- Transaction interactions
- Budget/cadence UX
- Financial trust and terminology
- Product-level UX coherence
- Accessibility and real-world usability

Therefore:

## 16.1 Treat the Existing Product as Stable
The current implementation is the approved baseline.
Do not continuously search for minor imperfections, subjective visual differences, cosmetic inconsistencies, or hypothetical edge cases in already-stable areas.

## 16.2 Do Not Create Work Just to "Improve" Something
Do not modify existing UI, animations, spacing, typography, colors, interactions, or architecture merely because:
- another pattern could also work
- a different design is possible
- a micro-polish opportunity exists
- a generic UX guideline suggests a different approach
- an automated audit finds a cosmetic nit
- a personal preference suggests a different implementation

## 16.3 Only Fix Real, Material Problems
An existing area should only be changed when there is a concrete and reproducible problem such as:
- functional bug
- data/financial correctness issue
- crash
- blocking usability problem
- accessibility failure
- actual layout break
- regression
- security issue
- performance problem with measurable impact
- explicit product requirement change

## 16.4 Do Not Run Endless Audit → Fix → Audit Loops
Do not repeatedly run break-ui, animation audits, UX audits, or similar review processes on stable areas unless:
- the user explicitly requests another audit, OR
- a significant architectural/product change makes a new audit genuinely necessary.

## 16.5 Protect Stable Behavior & Performance
When implementing a new feature, preserve existing:
- design language & canonical token hierarchy
- component behavior & shared UI primitives
- animation physics & gesture responsiveness (60fps Reanimated worklets, no JS-thread jank)
- interaction patterns & Android touch targets (no swallowed taps, crisp haptic feedback)
- financial rules & real-money balance calculations
- navigation behavior & hardware back-handler flow
- responsive behavior (especially 320–360px small screens)
- theme behavior & contrast integrity (Light, Dark, and AMOLED)

Do not "clean up" unrelated existing code while implementing a feature.

## 16.6 Scope Discipline
For every task:
- Change only what is required for the requested feature/fix.
- Do not opportunistically refactor unrelated components.
- Do not fix unrelated minor issues discovered while working.
- Do not introduce new abstractions unless they are actually required.
- Prefer the smallest safe change.

## 16.7 When a Possible Issue is Discovered
Classify it before changing anything:
- **P0/P1**: Real, reproducible, materially harmful issue → may require action.
- **P2**: Meaningful issue → mention it only if it affects the current task or the user explicitly asks for polish.
- **P3**: Cosmetic, subjective, hypothetical, or preference-based issue → **DO NOT** change it.

## 16.8 Ask Before Expanding Scope
If a discovered issue is outside the current task and is not a serious blocker, do not silently fix it.
Mention it separately and wait for explicit approval.

## 16.9 Preserve the Approved Design System
[`docs/design-system.md`](docs/design-system.md) and the existing implementation are the source of truth.
Do not introduce new design rules simply because a generic design system, AI audit, or external recommendation suggests them.

## 16.10 Prioritize Product Progress Over Perpetual Polish
Once a feature passes its required validation, consider it done.
The goal is not to make the codebase theoretically perfect.
The goal is to maintain a stable, trustworthy product while continuing meaningful product development.

### Default Decision Rule
> **"Don't touch stable code unless there is a concrete reason."**

Before changing existing behavior, the agent should be able to clearly answer:
1. What is actually broken?
2. Can it be reproduced?
3. Why does it materially matter?
4. Is the issue within the current task?
5. What is the smallest safe fix?

If these questions cannot be answered convincingly, **leave the existing implementation unchanged**.

This policy takes precedence over speculative polish and should be followed for all future feature implementation, refactoring, debugging, UX review, and design work.

# 17. Automatic Logging (v2.0) — Invariants

Read `docs/AUTO_LOGGING.md` before touching `src/features/autoLog/`, `modules/arthik-autolog/` or `src/screens/autolog/`.
- **Discovery never creates transactions.** Only `origin: 'live' | 'recovery'` may call `ledger.createTransaction`.
- **Never fuzzy-merge same-source events.** Only an exact reference, or the identical message delivered twice within 2 seconds (`SAME_MESSAGE_WINDOW_MS`; an email notification shown again within 60 s, `EMAIL_REPOST_WINDOW_MS`).
- **New accounts start untracked.** Never flip `tracked` without a user action.
- **Only the account's own bank creates an account (`AUT-005`).** Sender identity lives in `senders.ts` (bank / third_party / unknown; every header of one bank maps to one code). Non-bank messages (funds, insurers, brokers) are evidence only: never an account, a transaction or a review. New bank headers go in `BANKS` (aliases), new non-bank companies in `NON_BANK_SUFFIX` / `THIRD_PARTIES`, each with a test in `tests/autoLogAccountIdentity.test.ts`. Hidden accounts ("Not my account", `accounts.hidden`) are never listed, logged or re-added. Changing the cleanup rules (`accounts.tidyAccounts`) needs `ACCOUNT_TIDY_VERSION` bumped in `service.ts`.
- **Bank alert without an account number (`AUT-006`)** goes to the user's only visible account of that kind at that bank, and only if tracked (`accounts.soleBankAccount`); otherwise review. Never guess between accounts.
- **Email sender trust (`AUT-001` point 3)**: an email is identified only by its display name, which anyone can set. Only a known bank name may log a transaction by itself; payment providers and unknown senders go to review (`unknown_sender`).
- **Category & Undo (`AUT-007`)**: remembered preference → user's own history (`ledger.historyCategoryFor`, 2+ entries, ≥ 60%) → ask. Merchant keys go through `merchants.merchantKey` (old key still read). "Logged" notifications always carry Undo (max 2 category buttons + Undo); `notificationActions.handleNotificationAction` handles both and must stay safe to run twice. Callers pass `{ locked }` (app listener: `useAppLockStore.isLocked`; background task: `isAppLockedNow()`); while locked a button changes nothing and the user is told to open Arthik. App Lock: `AppLockOverlay` draws in its own `Modal` (above every sheet), keeps all hooks above its early return, and re-renders on every navigation state change (`isLockScreenShown` in `src/lib/appLockGate.ts`).
- **Discovery writes in batches inside `db.inTransaction`**; never wrap Recovery or Live (they call the ledger / network) in a transaction.
- **Never change the native module without asking first (owner rule, 2026-11-21).** Anything under `modules/arthik-autolog/android/` (Kotlin, module `build.gradle`, manifest), `app.json` plugins / permissions or native deps needs a new APK: stop, explain, and wait for a yes. Native tests live only in `modules/arthik-autolog/jvm-test/` and may only cover files that need no change (today `FinancialFilter.kt`).
- **Ignore rules are narrow** (exact message fingerprint or exact template). Never amount-based.
- **No message content leaves the device.** `autolog_profiles` stores only flags, timestamps, bank + last 4.
- Native changes in `modules/arthik-autolog` require a new APK (bump the version); JS changes can ship by OTA.
- Parser/matching changes must keep `tests/autoLogParser.test.ts` green; add a test for every new bank format.

# 18. Releases, Force Update & Beta Rollout (v2.0)

Read `docs/RELEASE_PROCESS.md`. (The owner may also keep a local, gitignored `AGENT_BRIEF.md` in the project root — read it if present; repo docs win if they disagree.)
- **Force update** is server-driven: `app_config` row `version_control` (`min_supported_version`, `force_update_enabled`, `release_url`, and v2+ `apk_url`, `update_title`, `update_highlights`). Old clients (v1.2.x) read only `release_url` — keep it a direct `.apk` link when forcing. **Trusted links only (SEC-03)**: the app downloads / opens `apk_url` and `release_url` only when they are release links of `https://github.com/Kislaya-06/Arthik-App/` (`releases`, `releases/latest`, `releases/tag/vX.Y.Z`, `releases/download/vX.Y.Z/<file>.apk`, `releases/latest/download/<file>.apk`; `isTrustedReleaseUrl` in `src/lib/versionCheck.ts`). Other repository paths (raw files, pull-request refs, branches) can hold files other users wrote and are refused; any refused link falls back to the official release page. Hosting the APK elsewhere needs `TRUSTED_RELEASE_PREFIX` changed first.
- `UpdateRequiredScreen` has **no skip/later/back**. On Android it downloads inside the app (`src/lib/apkInstaller.ts`) and opens the system installer; anything failing falls back to the browser.
- Release assets per GitHub release (tag `vX.Y.Z`): **`Arthik-vX.Y.Z.apk`** (required — force-update `release_url` / `apk_url` always point to `releases/download/vX.Y.Z/Arthik-vX.Y.Z.apk`) **+ `Arthik.apk`** (same file; makes `releases/latest/download/Arthik.apk` a permanent always-latest link). Never use `releases/latest/download/Arthik-vX.Y.Z.apk` (404 after the next release). `eas.json` preview has `autoIncrement` (versionCode).
- **Automatic Logging is Beta**, gated by `app_config.feature_flags.autolog.audience` (`existing` | `all` | `none`). Logic in `src/features/autoLog/rollout.ts`; never hide it from someone already using it; the one-time intro is for existing users only. Every place that names the feature shows the `BetaPill`.
- Manual-only (owner): SQL in Supabase, EAS builds/credentials, GitHub Releases, device testing.

---

# 19. REFACTOR MODE (active during the refactor branches refactor/*)
When the user's prompt says "Refactor Mode", these rules OVERRIDE section 5 "Minimal diff" and "File inspection rule":
1. Behaviour must stay byte-for-byte identical: same outputs, same side effects, same order of side effects, same error handling, same AsyncStorage keys, same Supabase queries, same notifications.
2. Allowed: move code to new files, split a long function into named helpers, rename LOCAL variables only, add types where tsc proves it is safe, add NEW test files.
3. Forbidden: changing logic, fixing bugs, "improving" conditions, reordering awaits, changing dependency arrays of useEffect/useMemo/useCallback, changing default values, changing exported names or import paths, adding dependencies, touching modules/arthik-autolog, schema.sql, supabase/, versionCheck.ts, UpdateRequiredScreen.tsx.
4. Public API stays: every export that existed before must still be importable from the SAME path (re-export from the old file).
5. Existing tests must NOT be edited. Only new test files may be added. If an existing test fails, STOP and report; do not "fix" the test.
6. If you notice a bug, do NOT fix it. Report it in the DONE REPORT.
7. For moves, copy code VERBATIM, including comments (P0.x tags, ponytail notes etc.).
8. Never create circular imports. Helpers extracted from a store must receive `get`/`set`/data as parameters instead of importing the store.

---

# 20. Rule Conflict, Notification & Synchronization Protocol

Whenever the user requests a modification, feature, or refactor that directly conflicts with any rule, constraint, or invariant documented in `AGENTS.md`:
1. **Explicit Conflict Notification**: The agent must immediately notify the user before modifying code: *"This requested change conflicts with AGENTS.md rule [Section Name/Rule description]."*
2. **Impact & Rationale**: Briefly explain why the conflict occurs and any architectural or financial implications.
3. **User Approval Gate**: Ask the user for explicit confirmation: *"Do you confirm and approve overriding this rule?"*
4. **Synchronize AGENTS.md**: If the user confirms with **"YES" / "HAAN"**, the agent must execute the requested code change AND simultaneously update `AGENTS.md` to reflect the newly approved behavior so the rulebook stays accurate and permanently synchronized.

