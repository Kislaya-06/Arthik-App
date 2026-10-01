# AGENTS.md

Guide for AI coding agents working on **Arthik** (personal expense + savings tracker).
Read this fully before touching code. If a rule here conflicts with a user instruction, the user wins — but say out loud which rule you are breaking and why.

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
| Updates | `expo-updates` (EAS Update, OTA) |
| Offline | `@react-native-community/netinfo` + AsyncStorage pending queues |
| Tests | Vitest (`npm test` → `vitest run`, config: `vitest.config.mjs`) |

Android is the only shipped platform today (package `com.kislaya_agarwal.arthik`). iOS config exists but is untested — do not claim iOS support. Follow the existing architecture, patterns, and conventions.

---

# 2. Repository Map

```
App.tsx                 # fonts, theme boot, OTA update listener, network listener, deep links, startup hydration
schema.sql              # Supabase DDL + RLS policies (source of truth for DB)
CHANGELOG.md            # user-facing change log — keep updated
tests/                  # Vitest unit tests (run with npm test)
src/
├── components/   BottomNavBar, BrandedHeroCard, CadenceSwitchModal, VaultSpendingGuardModal,
│                 PeriodRenewalModal, CustomDatePickerModal, ErrorBoundary, OfflineBanner, SyncFailedBanner,
│                 StreakCalendarModal, GradientIconBadge, PiggyBankCoinIcon
├── config/       supabase.ts (client + env), theme.ts (LightColors / DarkColors, design tokens)
├── hooks/        useExpenseForm.ts, useSavingsDashboard.ts, useScrollDirection.ts
├── lib/          formatters.ts, paymentUtils.ts, iconUtils.ts, budgetUtils.ts, budgetPeriods.ts,
│                 cadenceSwitch.ts, vaultSpendingGuard.ts, notificationService.ts, authLinkHandler.ts,
│                 budgetCalculations.ts, amountKeypad.ts, budgetModeUtils.ts
├── navigation/   index.tsx (Root stack + tabs), navigationRef.ts
├── screens/      Splash, Onboarding, Auth, ProfileSetup, Home, History, Insights,
│                 Savings, ExpenseForm, ExpenseDetail, CategoryDetail, ManageCategories,
│                 AddEditCategory, Notifications, Profile, ResetPassword, GullakDepositDetail, Faq
├── store/        authStore, expenseStore, categoryStore, dailyBudgetStore,
│                 notificationStore, networkStore, navBarStore, themeStore, appLockStore
└── types/        index.ts (RootStackParamList, TabParamList)
```

**High blast-radius files**: `dailyBudgetStore.ts`, `expenseStore.ts`, `budgetPeriods.ts`, `cadenceSwitch.ts`, `vaultSpendingGuard.ts`, `ExpenseFormScreen.tsx`, `SavingsScreen.tsx`, `HomeScreen.tsx`, `budgetCalculations.ts`.
> **File inspection rule**: Inspect ONLY the relevant sections/functions needed for the current task. Do NOT scan entire files or read whole files end-to-end unless the task strictly requires it.

---

# 3. Commands

```bash
npm install                      # install dependencies
npm test                         # vitest run — all unit tests
npx tsc --noEmit                 # type check (covers src/ and tests/) — run after every change
```

**Always run both checks before reporting done:**
```bash
npm test          # must pass with 0 failures
npx tsc --noEmit  # must produce no errors
```

**Metro server rule:** Only run one Metro server on port 8081 (`--port 8081`).
There is **no ESLint and no Prettier** in this repo. Do not add or run them.

---

# 4. Expo Version & Documentation

Target is **Expo SDK 57** (`expo-dev-client`, no Expo Go). Installed modules: `expo-auth-session`, `expo-constants`, `expo-crypto`, `expo-dev-client`, `expo-font`, `expo-linking`, `expo-local-authentication`, `expo-notifications`, `expo-status-bar`, `expo-updates`, `expo-web-browser`.

Consult external Expo 57 docs only when debugging unfamiliar native build/config issues; standard React Native and Expo APIs do not require doc lookups.

---

# 5. Task-Scoped Work

Work with surgical precision:
1. **Targeted inspection**: Check ONLY the specific file(s) and lines directly related to the user request. Do NOT scan unrelated files, grep the entire codebase blindly, or read files that have no bearing on the task.
2. **Reuse existing code**: Use existing stores, hooks, utilities, and components before writing new ones.
3. **Minimal diff**: Make the smallest focused change that solves the problem. Avoid speculative abstractions, unnecessary boilerplate, or refactoring untouched code.

---

# 6. Architecture Rules

## 6.1 Existing Code First
- Screens render UI and call store actions. Stores manage Supabase, AsyncStorage, and state. `src/lib/` holds pure helpers.
- Cross-store wiring uses explicit registration callbacks (`registerSyncCallback`, `registerExpenseGetter`, `registerStoreResetCallback`, `registerCategoryDeleteCallback`). Do not import stores circular-wise.

## 6.2 Dependencies
- No new dependencies if avoidable. Use already installed packages (`date-fns`, `lucide-react-native`, `react-native-svg`, AsyncStorage).
- Any new dependency with native code requires a full APK build.

## 6.3 Supabase & Data Access
- Every query must respect RLS scoped to `auth.uid()`. Client uses the anon key only.
- `schema.sql` is the source of truth for the DB. If tables/columns change, update `schema.sql` and provide the SQL for the user to run in Supabase.

---

# 7. Offline-First & Sync Invariants

- Offline writes queue in AsyncStorage (`@arthik_pending_expenses_<userId>`, `@arthik_pending_updates_<userId>`, `@arthik_pending_deletes_<userId>`, `@arthik_failed_sync_<userId>`).
- Optimistic rows are marked `pending: true`. Never drop a queued item silently.
- On sign-out, all stores must reset their state (`resetCategories`, `resetExpenses`, budget, notifications).
- Startup hydration order: `loadPendingExpenses` → `fetchCategories` → (`fetchExpenses` + `hydrateFromSupabase`) in parallel.

---

# 8. Dates, Money & Formatting

- **REAL MONEY INVARIANT (FOUNDATIONAL RULE)**: Every rupee tracked in Arthik is **real money**. No balance, budget allowance, or deposit is virtual or play money. Daily budget allowances set by the user represent real cash funded into their account on those days. If Budget Mode is switched OFF (Pure Mode), past active days' allowances remain real deposited funds in all-time, monthly, and weekly Inflow — never delete, vanish, or ignore them.
- Store/compare dates as `yyyy-MM-dd` strings. Parse with `parseISO`, never `new Date('...')`.
- Use `date-fns` (`format`, `isToday`, `isYesterday`, `subDays`) for date math.
- Render money only through `formatCurrency` / `formatAmountWithCommas` from `src/lib/formatters.ts` (`₹`, Indian grouping). Never inline `toLocaleString`.
- Amounts in state are `number`. Keypad manages strings and converts once.
- "Today" is the user's local day. Daily budget/streak calculations depend on it.

---

# 9. UI Styling Rules

## 9.1 Theme & Colours
- All colours come from `src/config/theme.ts` (`LightColors` / `DarkColors`) via `themeStore`. No hardcoded hex in screens.
- Test changes in both light and dark themes.

## 9.2 Design Tokens (Source of Truth)
Use tokens exported from `src/config/theme.ts` by their semantic role:
- **Spacing**: `Spacing.nano` (2), `Spacing.micro` (4), `Spacing.element` (8), `Spacing.group` (12), `Spacing.row` (14), `Spacing.block` (16), `Spacing.surface` (20), `Spacing.gutter` (24), `Spacing.section` (32).
- **BorderRadius**: `BorderRadius.input` (16), `BorderRadius.card` (20), `BorderRadius.cardLarge` (28), `BorderRadius.pill` (9999).
- **FontSize**: `FontSize.caption` (12), `FontSize.bodySmall` (14), `FontSize.body` (16), `FontSize.cta` (18), `FontSize.sectionTitle` (22), `FontSize.screenTitle` (28).
- **FontFamily**: Quicksand only (`FontFamily.regular`, `FontFamily.medium`, `FontFamily.semibold`, `FontFamily.bold`).
- **ControlHeight**: `ControlHeight.row` (56), `ControlHeight.cta` (60).

## 9.3 Deliberately Non-Tokenised Values
When an element's role does not match an established token, use the literal number:
- Circle geometry: `borderRadius: width / 2` (e.g. 16 for 32x32, 24 for 48x48, 28 for 56x56).
- Icon-button sizes (`32`, `36`, `40`, `44`, `48`) and intermediate fonts (`11`, `13`, `15`) remain literal numbers. Never round numbers to force-fit a token.

## 9.4 Role Matching
Match tokens by semantic role, not numeric coincidence (e.g. an icon spacer container is not a screen gutter; an icon box is not an input container).

## 9.5 Currency Symbol Alignment
Use `alignItems: 'center'` on the wrapping `flexDirection: 'row'` container for amount and `₹`.

## 9.6 Safe Area Insets
Always use `useSafeAreaInsets` from `react-native-safe-area-context` (`paddingTop: insets.top`). Never use `SafeAreaView` from `react-native` or hardcode top margins.

## 9.7 Component Architecture & Animation Physics
- Spring animation physics: `tension: 70, friction: 8`, `extrapolate: 'clamp'`.
- Layouts must be responsive on small screens.

## 9.8 Navigation
- Every route is typed in `src/types/index.ts` (`RootStackParamList`, `TabParamList`).
- Imperative navigation uses `navigationRef`. Guard back buttons with `navigation.canGoBack()`.
- `BottomNavBar` is a custom floating capsule bar driven by `navBarStore` + `useScrollDirection`.

## 9.9 Icon Badges & Gullak Icons (Design Language Invariant)
- **Always use `GradientIconBadge`**: All category, feature, and transactional icons (including Gullak, PiggyBank, Savings, and category rows) must use `GradientIconBadge` from `src/components/GradientIconBadge` with dynamic `iconColor`.
- **Gullak Theme**: Gullak deposits, milestone cards, and detail headers must use `GradientIconBadge` with `color="#ADEBB3"` and `PiggyBankCoinIcon` (e.g. `({ iconColor }) => <PiggyBankCoinIcon size={...} color={iconColor} />`).
- **Never use plain flat circles**: Do NOT create ad-hoc flat circular containers (`backgroundColor: iconBg`, `borderRadius: width / 2`, etc.) for feature or transaction icons. Always use `GradientIconBadge`.

---

# 10. Notifications

- Local notifications go through `src/lib/notificationService.ts` and `notificationStore`.
- Handle permission denial gracefully; avoid loops that reschedule on re-render.

---

# 11. Deployment, Versioning & OTA Updates

## 11.1 Build profiles (`eas.json`)
| Profile | Use | Output |
| --- | --- | --- |
| `development` | dev client for emulator/device debugging | debug APK |
| `preview` | internal test / distributed APK, channel `preview` | APK |
| `production` | store-style release, channel `production`, auto-increments | AAB |

## 11.2 Full APK build vs OTA Update
- **Full APK (`eas build -p android --profile preview`)**: required when native code, permissions, `app.json`, or app version changes.
- **OTA update (`eas update --branch preview --message "..."`)**: JS/TS, UI, and logic changes only.
- `runtimeVersion` is tied to `expo.version`. Bump version in `app.json` and `package.json` only when building a new APK binary. Update `CHANGELOG.md` in the same commit.

---

# 12. Development Build & Android Emulator

- Port reverse: `adb reverse tcp:8081 tcp:8081`
- Dev client URL: `arthik://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081`
- App package: `com.kislaya_agarwal.arthik`
- Dev client start: `npx expo start --port 8081`

---

# 13. Engineering Principles

- **Smallest working diff**: Modify only files directly necessary for the task. Do not refactor unrelated code.
- **Root-cause fixes**: Fix bugs at the source rather than adding repetitive patches across callers. Do not run sweeping repo-wide greps unless directly required.
- **No unnecessary abstractions**: Deletion over addition; boring over clever; no speculative boilerplate.

---

# 14. Change Scope

- Modify only files necessary for the task.
- Do not rename files, components, or variables without a reason.
- Never commit `.env`, keys, APKs, or `node_modules`.

---

# 15. Data Integrity

- **Real-Money Invariant**: All funds (budget allowances, incomes, deposits, expenses) represent real user capital. Never drop, ignore, or zero out historical budget pools or deposited allowances when modes toggle or settings change.
- Never silently delete or overwrite user data. Destructive actions require user confirmation.
- Preserve offline queueing and sync behavior.
- Validate inputs at boundaries (amounts, auth forms, deep links).
- Always handle loading, error, empty, and offline states.

---

# 16. Accessibility & Security

- Touch targets ≥ 44dp.
- Readable contrast in both light and dark themes.
- No secrets in client bundle, respect Supabase RLS.

---

# 17. Validation & Definition of Done

Before reporting done:
1. `npm test` passes — all unit tests pass with zero regressions.
2. `npx tsc --noEmit` passes — zero type errors.
3. Verify modified logic/screen in both light and dark themes where applicable.
4. Confirm unrelated features were not changed.
5. State clearly what was verified and any items that could not be tested locally (e.g. native biometric, live Supabase network).
6. Flag if the change requires a new APK build rather than an OTA update.

---

# 18. Communication

- Converse with the user in **Hinglish** (Roman-script Hindi + English mix).
- Code, comments, commit messages, and docs stay in English.

---

# 19. Commits & Changelog

- Small, focused commits with imperative commit messages (e.g. `feat(home): ...`, `fix(savings): ...`).
- User-visible changes get a `CHANGELOG.md` entry in the same commit.

---

# 20. Scope of This File

Applies to all pair programming and agent work in this repository.

---

# 21. Test Coverage Rules

This repo uses **Vitest** (`npm test`). Tests live in `tests/<subject>.test.ts`.

## 21.1 What requires a test
- New or modified `lib/` helpers (formatters, classifiers, calculation logic).
- Store actions with offline/online logic or queue modifications.
- User isolation logic (per-user keys, sign-out reset).
- Income/expense classification and financial math (rollover, streak, budget calculations).
- Auth deep link or session handling.

## 21.2 What does NOT need a test
- Pure UI layout, colors, spacing, or animation changes.
- Navigation wiring (screen registration, param types).
- Self-evident one-line guards.

## 21.3 Writing & maintaining tests
- Look at existing tests in `tests/` for standard mock patterns (`@react-native-async-storage/async-storage`, `supabase`, `useAuthStore`).
- Never delete passing tests unless the feature is deliberately removed.
