# AGENTS.md

Guide for AI coding agents working on **Arthik** (personal expense + savings tracker).
Read this fully before touching code. If a rule here conflicts with a user instruction, the user wins — but the agent MUST strictly adhere to the following protocol:
1. **Explain Rule Breach**: State out loud which rule is being broken and why.
2. **Thorough Impact Explanation**: If breaking the rule affects critical logic, touches financial metrics, or creates cascading changes across the app, provide a comprehensive explanation of the implications before writing code. Because every rupee in Arthik is REAL MONEY, any calculation flaw or balance mismatch directly harms the user.
3. **MANDATORY LOGIC APPROVAL GATE**: The agent must NEVER unilaterally alter or modify any calculation, financial metric, or core app logic. Any change in logic must be explicitly presented to the user and approved by them first before execution.
4. **Synchronize AGENTS.md**: Once an exception or rule change is approved and executed, the agent must update `AGENTS.md` (and relevant docs) so the rules remain accurate and up-to-date.

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
App.tsx                 # fonts, theme boot, version check (force update), OTA listener, network listener, deep links, startup hydration
index.ts                # entry; imports src/features/autoLog/background (headless + periodic tasks) — must stay
schema.sql              # Supabase DDL + RLS policies (source of truth for DB)
CHANGELOG.md            # user-facing change log — keep updated
tests/                  # Vitest unit tests (run with npm test); helpers/autoLogTestEnv.ts = Auto Logging test doubles
docs/                   # architecture, AUTO_LOGGING, RELEASE_PROCESS, PLAY_STORE_AUTOLOG, design system, adr/, specs/
supabase/               # migrations/ (budget modes, autolog_profiles, release flags), functions/delete-user-account
modules/arthik-autolog/ # Kotlin native module (FinancialFilter, SmsReceiver, PaymentNotificationListener,
                        # EventQueue, AutoLogHeadlessService, ArthikAutoLogModule) — change = new APK
src/
├── components/   ui/ (AppButton, AppInput, AmountText, SegmentedControl, BottomSheetModal, …),
│                 profile/ (PauseBudgetModal, EditProfileModal, DeleteAccountModal, styles),
│                 savings/ (SavingsHeader, SavingsHeroCard, BudgetHubSection, SavingsHistorySection, styles),
│                 shares/ (SplitExpenseModal, SharesDetailCard, TransactionExtras),
│                 BottomNavBar, BrandedHeroCard, CadenceSwitchModal, VaultSpendingGuardModal,
│                 PeriodRenewalModal, CustomDatePickerModal, BudgetEditModal, MoneyExplainerModal,
│                 StreakCalendarModal, DepositGullakModal, GradientIconBadge, PiggyBankCoinIcon,
│                 AppLockOverlay, OtaUpdateModal, PullToHistoryList, ErrorBoundary, OfflineBanner, SyncFailedBanner,
│                 autolog/ (AutoLogUi + BetaPill, ReviewSheet, WhyLoggedCard, AutoLogHomeBanner, AutoLogGate, EmailSourceInfo)
├── features/     autoLog/ (parser, matching, engine, db, service, reviews, ledger, rollout, background,
│                 notify, permissions, remote, store, copy, types)
├── config/       supabase.ts (client + env), theme.ts (LightColors / DarkColors, design tokens)
├── hooks/        useExpenseForm.ts, useFormKeyboard.ts, useSavingsDashboard.ts, useScrollDirection.ts, useFocusEntry.ts, useMoneyWaterfall.ts
├── lib/          formatters.ts, paymentUtils.ts, iconUtils.ts, budgetUtils.ts, budgetPeriods.ts,
│                 budgetCalculations.ts, homeCalculations.ts, moneyWaterfall.ts, shares.ts,
│                 cadenceSwitch.ts, vaultSpendingGuard.ts, notificationPolicy.ts, notificationService.ts,
│                 notificationSync.ts, authLinkHandler.ts, amountKeypad.ts, budgetModeUtils.ts,
│                 streakCalendarData.ts, asyncStorageList.ts, chartUtils.ts,
│                 versionCheck.ts + apkInstaller.ts (force update / in-app APK install)
├── navigation/   index.tsx (Root stack + tabs), navigationRef.ts
├── screens/      Splash, Onboarding, Auth, ProfileSetup, Home, History,
│                 Insights (with insights/ periodUtils, PeriodNavigator, useInsightsData, styles),
│                 Savings, ExpenseForm, ExpenseDetail, CategoryDetail, ManageCategories,
│                 AddEditCategory, Notifications, Profile, ResetPassword, GullakDepositDetail, Faq,
│                 UpdateRequired, autolog/ (Center, Setup, WelcomeBack, Review, Accounts, Info, Intro, Email)
├── store/        authStore, categoryStore,
│                 expenseStore (with expense/ pendingQueues, syncPending, types),
│                 dailyBudgetStore (with dailyBudget/ classifiers, expenseBridge, hydrate, metrics, pendingStorage, rollover, types),
│                 sharesStore, notificationStore, networkStore, navBarStore, themeStore, appLockStore, ambientStore, otaStore
└── types/        index.ts (RootStackParamList, TabParamList)
```

**High blast-radius files**: `dailyBudgetStore.ts (+ src/store/dailyBudget/*)`, `expenseStore.ts (+ src/store/expense/*)`, `budgetPeriods.ts`, `cadenceSwitch.ts`, `vaultSpendingGuard.ts`, `budgetCalculations.ts`, `moneyWaterfall.ts`, `ExpenseFormScreen.tsx`, `SavingsScreen.tsx`, `HomeScreen.tsx`, `features/autoLog/engine.ts`, `features/autoLog/matching.ts`, `features/autoLog/service.ts`, `modules/arthik-autolog/**` (native → APK), `UpdateRequiredScreen.tsx` + `lib/versionCheck.ts` (force update for every user).
> **File inspection rule**: Inspect ONLY the relevant sections/functions needed for the current task. Do NOT scan entire files or read whole files end-to-end unless the task strictly requires it.

---

# 3. Commands

```bash
npm install                      # install dependencies
npm test                         # vitest run — all unit tests
npx tsc --noEmit                 # type check (covers src/ and tests/) — same as npm run typecheck
npx vitest run tests/autoLogParser.test.ts tests/autoLogFlows.test.ts tests/autoLogEmail.test.ts   # Auto Logging only
```

**Definition of Done (MANDATORY 4-STAGE QUALITY GATE)**:
Before reporting done, the agent must strictly satisfy all 4 gates:
1. **Compilation & Types Gate**: `npx tsc --noEmit` must produce 0 type errors.
2. **Logic & Test Gate**: `npm test` must pass with 0 failures. If any logic, calculation, or helper was modified or created, update existing tests or add new tests to permanently prevent regressions.
3. **UI & Theme Integrity Gate**: Verify that neither existing nor new UI is broken across **Light, Dark, and AMOLED** themes. Ensure readable contrast, proper SafeArea insets (no notch/navigation clipping), and correct layout responsiveness.
4. **Release & Sync Gate**: Synchronize `CHANGELOG.md` (under `[Unreleased]`) and update `app.json` OTA highlights (`expo.extra.otaUpdate.highlights`) for user-facing changes so the in-app release modal remains accurate.

**Done Reporting Protocol**:
When presenting the final outcome to the user:
- State clearly what was verified and any items that could not be tested locally (e.g. native biometric, live Supabase network).
- Confirm unrelated features were not touched or modified.
- Explicitly flag if the change requires a new APK build rather than an OTA update.

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
2. **Implementation Quality First, Minimal Diff Second**:
   - The primary objective is a complete, robust, and clean implementation. Never compromise quality, stability, or correctness just to force a smaller diff.
   - Once a robust implementation is designed, ensure zero boilerplate: write only the exact lines of code needed without speculative abstractions, dead code, or refactoring untouched working code.
3. **Reuse Existing Code**: Leverage existing stores, UI primitives (`AppButton`, `AmountText`, `SegmentedControl`, etc.), hooks, and math helpers before creating new ones.
4. **Root-Cause Fixes & Scope Discipline**: Fix bugs directly at their root cause rather than adding repetitive patches across callers. Do not rename files, components, or variables without a valid architectural reason. Never commit `.env`, keys, secrets, or binary APKs.

---

# 6. Architecture Rules

## 6.1 Existing Code First
- Screens render UI and call store actions. Stores manage Supabase, AsyncStorage, and state. `src/lib/` holds pure helpers.
- Cross-store wiring uses explicit registration callbacks (`registerSyncCallback`, `registerExpenseGetter`, `registerExpensesLoadedGetter`, `registerStoreResetCallback`, `registerCategoryDeleteCallback`). Do not import stores circular-wise.
- Store submodule architecture: Submodules under `src/store/dailyBudget/*` and `src/store/expense/*` must receive required state or setters via parameters/callbacks; never import the parent store directly to prevent circular dependency deadlocks.

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
- **Session Reset**: On sign-out, all stores must reset their state (`resetCategories`, `resetExpenses`, budget, notifications).
- **Startup Hydration Order**: `loadPendingExpenses` → `fetchCategories` → (`fetchExpenses` + `hydrateFromSupabase`) in parallel.

---

# 8. Dates, Money & Formatting

- **REAL MONEY INVARIANT (FOUNDATIONAL RULE)**: Every rupee tracked in Arthik is **real money**. No balance, budget allowance, or deposit is virtual or play money. Daily budget allowances set by the user represent real cash funded into their account on those days. If Budget Mode is switched OFF (Pure Mode), past active days' allowances remain real deposited funds in all-time, monthly, and weekly Inflow — never delete, vanish, or ignore them.
- Store/compare dates as `yyyy-MM-dd` strings. Parse with `parseISO`, never `new Date('...')`.
- Use `date-fns` (`format`, `isToday`, `isYesterday`, `subDays`) for date math.
- Render money only through `formatCurrency` / `formatAmountWithCommas` from `src/lib/formatters.ts` (`₹`, Indian grouping). Never inline `toLocaleString`.
- Amounts in state are `number`. Keypad manages strings and converts once.
- "Today" is the user's local day. Daily budget/streak calculations depend on it.

## 8.1 Auto-Save to Gullak (`isAutoRenew`) & Budget Hydration Invariant (CRITICAL)
- **User Preference Sovereignty**: When a user pauses or turns OFF "Auto-save unspent to Gullak" (`isAutoRenew: false`), that setting MUST be permanently respected across all app states.
- **Never Auto-Force `isAutoRenew = true`**: Store hydration (`hydrateFromSupabase`), offline fast-paths, pull-to-refresh, and background sync must **NEVER** infer or flip `isAutoRenew` to `true` simply because `isBudgetModeEnabled` is `true` or `dailyBudgetAmount > 0`.
- **No Hardcoded Defaults Overriding User State**: Never use hardcoded fallback values (`|| 100` or `|| 500`) that coerce 0 or overwrite custom user allowances (e.g. ₹250).
- **Paused Allowance State**: When `isBudgetModeEnabled` is `true` but `isAutoRenew` is `false`, the user is explicitly in Paused Allowance state. Today's unfinalized daily record is `{ budget: 0, saved: 0, status: 'unknown' }`, while their configured allowance remains preserved in store state and Supabase profiles until they choose to resume.

---

# 9. UI Styling Rules

**MANDATORY DESIGN LANGUAGE INVARIANT**: Any new UI screen, modal, card, or component added or modified in Arthik MUST strictly consume the canonical design tokens from [`src/config/theme.ts`](src/config/theme.ts) and the approved UI primitives from `src/components/ui/` as defined in [`docs/design-system.md`](docs/design-system.md). Never introduce ad-hoc font sizes, arbitrary button/input heights, raw hex codes, or screen-specific padding. Same semantic role = same visual treatment everywhere.

## 9.0 Design Contract — Read Before Any UI Work

**[`docs/ARTHIK_DESIGN_SYSTEM.md`](docs/ARTHIK_DESIGN_SYSTEM.md) is the design contract for this repository.** Read it in full before implementing or modifying any screen, modal, card, component, chart, or icon. It is not optional documentation.

The three layers of design authority, in order:

| Layer | File | Role |
| --- | --- | --- |
| **Design Contract** | [`docs/ARTHIK_DESIGN_SYSTEM.md`](docs/ARTHIK_DESIGN_SYSTEM.md) | Human-readable rules: principles, semantic roles, hierarchy, governance. Read first. |
| **Runtime Tokens** | [`src/config/theme.ts`](src/config/theme.ts) | Numeric values: spacing, radius, font sizes, control heights, colors. Never hardcode these. |
| **Usage Guide** | [`docs/design-system.md`](docs/design-system.md) | Token tables, component specs, allowed exceptions, correct/incorrect usage examples. |

When the three layers appear to conflict, fix the conflict — do not pick the one that lets you skip reading the others.

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
  - Form-Level Controls (`BouncyTypeToggle`, `BouncyPaymentToggle`): Must strictly use `ControlHeight.row` (`56px`), matching standard input container heights and the Date Picker trigger button.
- **Surface & Border Colors**: Pill containers strictly use `colors.cardSubtle` (`#1A263B` in Dark, `#121212` in AMOLED, `#F1F5F9` in Light) with border `colors.borderSubtle`. Never use `colors.card` or raw pitch-black for pill backgrounds; all pills must maintain a unified, elevated grayish surface across all themes. In form contexts, use `colors.inputBg`.
- **Active & Inactive Text**: Active text must strictly use deep contrast `colors.forestGreen` (`#1A2B4C`) + `FontFamily.bold` on both `mintGreen` and `peachCoral` active pills. **Never use `colors.coral`, `textPrimary`, or foreground matching the active pill background.** Inactive text strictly uses `colors.textSecondary` + `FontFamily.medium`.
- **Apple Dual-Edge Liquid Morph**: Primary slide uses critically damped spring (`tension: 100, friction: 16`), direction-aware leading-edge stretch (`scaleX: 1.08–1.28`), and vertical volume squish (`scaleY: 0.96–0.88`) with strict inner track clipping (`overflow: 'hidden'`).
- **Direct-Manipulation Touch Agency**: In scrollable pill filters (`BouncyCategoryFilter`), tapping a category must NEVER trigger automatic `scrollTo`. The user retains complete direct-manipulation agency to scroll manually, while the highlight pill glides fluidly to the tapped option.
- **Touch Interaction & Tab Selection Invariant (CRITICAL)**:
  - `<SegmentedControl />` MUST strictly trigger tab switching on standard touch release via `onPress={onPress}`. Never hijack touch-down with speculative props like `selectOnPressIn`, `onPressIn` callbacks, or custom press-handling refs (`pressedInHandled`). In React Native on Android, mutating component tree state during `onPressIn` or caching press status in refs desynchronizes gesture responders and permanently locks out tabs (such as the Weekly pill in `InsightsScreen`).
  - HitSlop on adjacent segmented buttons must NEVER have horizontal overlap (zero horizontal hitSlop between neighboring segment buttons), but the outer edges must provide generous outer hitSlop (`left: 16` on the first option, `right: 16` on the last option) and `pressRetentionOffset={{ top: 20, bottom: 20, left: 20, right: 20 }}` so long-distance thumb reaches across from the opposite end of the phone never drop taps or suffer micro-slide cancellations.
  - When hosted inside a `<ScrollView />`, the scroll view must specify `keyboardShouldPersistTaps="handled"` so taps on segment options are never swallowed or delayed.

---

# 10. Notifications

- **Canonical Specification**: Read [`docs/notifications.md`](docs/notifications.md) before modifying any notification behavior. Single source of truth is the pure helper [`src/lib/notificationPolicy.ts`](src/lib/notificationPolicy.ts) (tested via `tests/notificationPolicy.test.ts`).
- **All Scheduled Notifications Delivered**: Deliver all legitimately scheduled notifications as configured (budget alerts, Gullak rewards, weekly/monthly recaps, evening nudges) without artificial suppression.
- **Never Nag Invariant**: The evening nudge (20:30) exists only on days with zero expenses logged. Logging an expense immediately cancels tonight's nudge via `notificationSync.ts`.
- **In-App Bell Synchronization**: All notifications (whether arriving while the app is in background or active session) must be visible and recorded in the in-app notification bell (`notificationStore`) so the user never misses their complete notification history.
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
- **OTA update (`eas update --branch preview --message "..."`)**: JS/TS, UI, and logic changes only.
- `runtimeVersion` is tied to `expo.version`. Bump version in `app.json` and `package.json` only when building a new APK binary. Update `CHANGELOG.md` in the same commit.

## 11.2a Releasing an APK & forcing the update
Follow `docs/RELEASE_PROCESS.md` (generic `X.Y.Z` playbook). Key points: same keystore every release; GitHub tag `vX.Y.Z` with assets **`Arthik-vX.Y.Z.apk`** + copy **`Arthik.apk`**; force update = Supabase `app_config.version_control` (see §18). The agent never runs builds, uploads releases or runs SQL — it prepares code/docs and writes the exact manual steps.

## 11.3 In-App OTA Update Popup Invariant (`OtaUpdateModal` & `app.json`)
- **"What's New" Highlights Update**: Whenever an OTA release is prepared without bumping the version (the standard OTA workflow), you MUST update `app.json` (`expo.extra.otaUpdate.title` and `expo.extra.otaUpdate.highlights`) and `src/store/otaStore.ts` (fallback highlights).
- This ensures the in-app update popup (`OtaUpdateModal`) that displays on user devices after downloading the update accurately communicates the exact changes, fixes, or improvements in that release. Never release an OTA update with stale highlights from a previous release.

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

# 14. Documentation & Changelog Synchronization (MANDATORY INVARIANT)

- **Comprehensive Documentation Freshness**: Whenever changes are made anywhere in the repository (new features, bugfixes, test updates, architectural shifts, or configuration updates), **ALL documentation files related to or affected by that change** (including `CHANGELOG.md`, `README.md`, `docs/architecture.md`, `docs/prd.md`, `docs/AUTO_LOGGING.md`, `docs/RELEASE_PROCESS.md`, `docs/design-system.md`, `AGENTS.md`, and any relevant specs/ADRs) MUST be updated in the same change/commit.
- **No Scope Blindspots**: The agent must never artificially restrict itself to a handful of named files; every document that describes, specifies, or tracks the modified logic, test counts, metrics, or workflows must remain 100% fresh, accurate, and synchronized.
- **AGENTS.md Rule Synchronization**: If an approved change or feature alters any behavioral constraint, architectural pattern, or financial invariant, the agent MUST immediately update `AGENTS.md` (following the §20 protocol) so the living rulebook accurately mirrors current app behavior.
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
[`docs/ARTHIK_DESIGN_SYSTEM.md`](docs/ARTHIK_DESIGN_SYSTEM.md) and the existing implementation are the source of truth.
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
- **Never fuzzy-merge same-source events.** Only exact reference or identical message text within 5 minutes.
- **New accounts start untracked.** Never flip `tracked` without a user action.
- **Ignore rules are narrow** (exact message fingerprint or exact template). Never amount-based.
- **No message content leaves the device.** `autolog_profiles` stores only flags, timestamps, bank + last 4.
- Native changes in `modules/arthik-autolog` require a new APK (bump the version); JS changes can ship by OTA.
- Parser/matching changes must keep `tests/autoLogParser.test.ts` green; add a test for every new bank format.

# 18. Releases, Force Update & Beta Rollout (v2.0)

Read `docs/RELEASE_PROCESS.md`. (The owner may also keep a local, gitignored `AGENT_BRIEF.md` in the project root — read it if present; repo docs win if they disagree.)
- **Force update** is server-driven: `app_config` row `version_control` (`min_supported_version`, `force_update_enabled`, `release_url`, and v2+ `apk_url`, `update_title`, `update_highlights`). Old clients (v1.2.x) read only `release_url` — keep it a direct `.apk` link when forcing.
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

