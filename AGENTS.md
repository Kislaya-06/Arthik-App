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
- **Max 1 Per Day Rule (CRITICAL)**: At most **ONE** scheduled push notification per calendar day (priority order: monthly recap > weekly recap > Gullak reward > evening nudge). Never spam the user.
- **Never Nag Invariant**: The evening nudge (20:30) exists only on days with zero expenses logged, and goes quiet after 3 consecutive unopened evenings. Logging an expense immediately cancels tonight's nudge via `notificationSync.ts`.
- **In-App Bell vs. OS Push Separation**: Actions triggered by the user's active session (80% budget limit reached, daily/cadence rollover applied, budget settings updated) go strictly to the in-app bell (`notificationStore`), never OS push notifications. The only exception while open is crossing the budget limit (silent banner).
- **Channels & Services**: Local notifications go through `src/lib/notificationService.ts` across 4 Android channels (`Budget alerts`, `Reminders`, `Gullak updates`, `Weekly & monthly recaps`). Handle permission denial gracefully; avoid rescheduling loops on re-render.

---

# 11. Deployment, Versioning & OTA Updates

## 11.1 Build profiles (`eas.json`)
| Profile | Use | Output |
| --- | --- | --- |
| `development` | dev client for emulator/device debugging | debug APK |
| `preview` | internal test / distributed APK, channel `preview` | APK |
| `production` | store-style release, channel `production`, auto-increments | AAB |

## 11.2 Full APK build vs OTA Update
- **Full APK (`eas build -p android --profile preview`)**: required when native code, permissions, native plugins, or app version changes.
- **OTA update (`eas update --branch preview --message "..."`)**: JS/TS, UI, and logic changes only.
- `runtimeVersion` is tied to `expo.version`. Bump version in `app.json` and `package.json` only when building a new APK binary. Update `CHANGELOG.md` in the same commit.

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

# 18. Communication & Response Style

- **Conversation with User**: Converse strictly with the user in **Hinglish** (Roman-script Hindi + English mix). Never respond to the user in pure English or pure Devanagari.
- **In-App Copy & Code Language (English Only)**: Any copy or text within the application (UI labels, buttons, screen titles, descriptions, error messages, banners, notifications, modals) must NEVER be written in Hinglish — these must always be in standard English. Source code, comments, commit messages, and documentation must also remain strictly in English. Hinglish is **solely and exclusively** for chat conversations with the user.
- **Simple, Clear & Non-Technical In-App Copy**: All English copy written for the app must be exceptionally simple, natural, and user-friendly so that any user understands it instantly on the first read. Do not use heavy English vocabulary, pretentious words, or technical jargon. Deliver clear meaning with concise wording and minimal lines.
- **Concise & Outcome-Focused Responses**: After executing an instruction or task, do not generate long, exhaustive paragraphs or overwhelming micro-details (walls of text) that cause reading fatigue. Summarize only the critical outcomes and essential updates that the user genuinely needs to know. Keep responses short, crisp, bulleted, and in clear Hinglish so they can be parsed effortlessly at a glance.

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

---

# 22. Stability & Change Discipline

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

## 22.1 Treat the Existing Product as Stable
The current implementation is the approved baseline.
Do not continuously search for minor imperfections, subjective visual differences, cosmetic inconsistencies, or hypothetical edge cases in already-stable areas.

## 22.2 Do Not Create Work Just to "Improve" Something
Do not modify existing UI, animations, spacing, typography, colors, interactions, or architecture merely because:
- another pattern could also work
- a different design is possible
- a micro-polish opportunity exists
- a generic UX guideline suggests a different approach
- an automated audit finds a cosmetic nit
- a personal preference suggests a different implementation

## 22.3 Only Fix Real, Material Problems
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

## 22.4 Do Not Run Endless Audit → Fix → Audit Loops
Do not repeatedly run break-ui, animation audits, UX audits, or similar review processes on stable areas unless:
- the user explicitly requests another audit, OR
- a significant architectural/product change makes a new audit genuinely necessary.

## 22.5 Protect Stable Behavior
When implementing a new feature, preserve existing:
- design language
- component behavior
- animation language
- interaction patterns
- financial rules
- navigation behavior
- responsive behavior
- theme behavior

Do not "clean up" unrelated existing code while implementing a feature.

## 22.6 Scope Discipline
For every task:
- Change only what is required for the requested feature/fix.
- Do not opportunistically refactor unrelated components.
- Do not fix unrelated minor issues discovered while working.
- Do not introduce new abstractions unless they are actually required.
- Prefer the smallest safe change.

## 22.7 When a Possible Issue is Discovered
Classify it before changing anything:
- **P0/P1**: Real, reproducible, materially harmful issue → may require action.
- **P2**: Meaningful issue → mention it only if it affects the current task or the user explicitly asks for polish.
- **P3**: Cosmetic, subjective, hypothetical, or preference-based issue → **DO NOT** change it.

## 22.8 Ask Before Expanding Scope
If a discovered issue is outside the current task and is not a serious blocker, do not silently fix it.
Mention it separately and wait for explicit approval.

## 22.9 Preserve the Approved Design System
[`docs/ARTHIK_DESIGN_SYSTEM.md`](docs/ARTHIK_DESIGN_SYSTEM.md) and the existing implementation are the source of truth.
Do not introduce new design rules simply because a generic design system, AI audit, or external recommendation suggests them.

## 22.10 Prioritize Product Progress Over Perpetual Polish
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
