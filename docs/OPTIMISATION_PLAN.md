# Arthik — Full Optimisation & Clean-up Plan

> **Golden rule for every item in this file: no logic change and no behaviour change.**
> Same numbers, same rounding, same order of money operations, same stored values, same screens, same copy.
> Everything here is a *how*-change (faster, smaller, cleaner), never a *what*-change. Any item that could move a
> rupee is marked ⚠️ and sits behind the `docs/ARTHIK_CANONICAL_RULES.md` gate: characterization test first,
> owner approval if a rule could be touched.

Date: 21 Oct 2026 · Codebase: 233 source files, ~64,750 lines (`src/`, `App.tsx`, `index.ts`) · 122 test files.

---

## 0. How this analysis was done (so you can trust and repeat it)

Every source file was scanned line by line with automated checks, then the hot paths (startup, Home, tabs,
charts, sheets, forms) were read by hand.

| Check | Tool | Result |
|---|---|---|
| Type errors / unused locals & params | `tsc --noEmit` (`noUnusedLocals`, `noUnusedParameters` already ON) | **0 errors** — the codebase is already strict-clean |
| Tests | `vitest run` | **122 files, 1,803 tests pass** |
| Release bundle | `expo export --platform android` | builds OK |
| Dead files | import graph over `src`, `App.tsx`, `index.ts`, `tests` | **2 files imported by nothing** |
| Dead exports | every `export` searched across app + tests | **14 exports used nowhere**, **294 exported but only used inside their own file**, 104 exported only for tests |
| Copy-paste | `jscpd` (≥12 lines / 80 tokens) | **29 clones, 627 lines (0.97%)** — low; listed per file |
| JS-thread animations | grep `useNativeDriver: false` | **14** (8 files) — main source of remaining jank |
| JS-thread gestures | grep `PanResponder.create` | 3 files |
| Render-cost patterns | inline `style={{}}`, `StyleSheet.flatten` in render, whole-store Zustand subscriptions | 177 inline styles, 2 whole-store subscriptions |
| Unused dependencies | every `package.json` dependency searched in code/config | `@shopify/flash-list` unused |

How to re-run: the scripts are trivial (`tsc`, `npx jscpd src --min-lines 12`, a grep for each pattern). Re-run after
each phase; every number above must only go down.

---

## 1. Executive summary (what actually matters, in order)

1. **App-open time.** After the splash work in this drop, the fixed animation cost is **~1.5s on a warm cache**
   (0.9s entrance + 0.58s exit; the cover fade overlaps Home). The remaining, *variable* wait is **network**: the
   splash waits for `fetchCategories` → `fetchExpenses` / `hydrateFromSupabase` / `appLock.init` (capped at 5s). On
   good internet that is a few hundred ms; on bad internet it is up to 5s. Removing that wait is the single
   biggest speed win left — **but it changes startup behaviour** (see §2.3), so it needs your yes.
2. **JS-thread animations (14 places).** Width/height/left animated with `useNativeDriver: false` stutter whenever
   the JS thread is busy (data load, sync, tab mount). Porting them to Reanimated with the same curves is pure
   smoothness, zero behaviour change. Biggest felt ones: bottom-nav pill (`BottomNavBar`), keypad
   (`useFormKeyboard`), Insights period dots (`PeriodNavigator`), Savings progress bar, cash-flow charts,
   pull-to-history.
3. **Dead code.** 2 dead files, 14 dead exports, 1 unused native dependency. Safe deletes.
4. **Redundancy.** 29 copy-paste blocks; the UI ones (modal headers, banners, chart axes, nav tab items, auth
   form headers) are easy, safe extractions. The money ones (`planActions`, `dailyBudgetStore`, `hydrate`,
   `syncPending`, weekly/monthly insights) are ⚠️ and must be done with characterization tests.
5. **Consistency.** Three animation systems (core `Animated`, Reanimated, LayoutAnimation-free), two gesture
   systems (`PanResponder`, RNGH), two press styles (`TouchableOpacity`, `Pressable`). Converging makes every
   interaction feel like the same premium app.

---

## 2. Startup (cold open) — deep dive

### 2.1 Timeline today (after this drop)

| Step | Time | Thread | Notes |
|---|---|---|---|
| Native splash (`app.json` `splash`, `#F8FAF9`) | OS | native | until JS bundle runs |
| Fonts (`useFonts`, bundled) | ~10–50ms | JS | now shows plain background, no spinner |
| Splash entrance | 900ms | UI (Reanimated) | runs in parallel with the startup work below |
| Connectivity probe | ≤1.5s cap | JS | parallel |
| `getSession` | ≤2s cap | JS | parallel |
| Hydration chain | ≤5s cap | JS + network | **the variable part** |
| Splash exit (bloom) | 580ms | UI | starts when entrance done AND target known |
| Cover settle + fade | 2 frames + 120ms, then 240ms | UI | Home already interactive under the fade's end |

Warm cache + good network: **~1.5–1.7s to Home**. Old code: ~2.2s entrance + ~0.9s exit + spinner ≈ **3.1s+**.

### 2.2 Safe further wins (no behaviour change)
- **Native splash handoff** — add `expo-splash-screen`, `preventAutoHideAsync()` at the top of `App.tsx`,
  `hideAsync()` on the Splash screen's first layout; native splash = background colour only, with a dark variant.
  Removes the last colour flash (`#F8FAF9` → `#F8F9FB`, and the dark-mode white flash). **Needs a new APK.**
- **Align `app.json` splash `backgroundColor` to `#F8F9FB`** (theme `background`) — 1-line change, works with the
  next native build.
- **Hermes / bundle**: keep `lucide-react-native` imports per-icon (already done); verify with
  `npx expo export --dump-sourcemap` + `source-map-explorer` that no icon barrel slipped in.

### 2.3 ⚠️ Biggest possible win — needs your approval (behaviour change)
Navigate as soon as the **cached** data is in the stores (categories + expenses cache + daily-budget local state),
and let the network refresh finish on Home. Typical open on any network → ~1.5s fixed.
Why it is gated: Home would first show cached numbers and could update a moment later; and day-rollover /
Gullak writes must never run on stale daily records (`ROL-*`, `BUD-*` rules). Safe version: navigate early but
**block rollover/auto-renew until `hydratedForUserId === user.id`** (that flag already exists). Needs a written rule
in the canonical file before building. Until you say yes, nothing changes.

---

## 3. Prioritised roadmap

Each phase = one PR, each must end with: `tsc` 0 errors · all tests green · `expo export` OK · manual smoke on device.

### Phase P1 — zero-risk clean-up (1 day)
| # | Item | Files | Why safe |
|---|---|---|---|
| 1 | Delete dead file | `src/components/ui/AppInput.tsx` | imported by nothing (app or tests) |
| 2 | Delete dead file | `src/hooks/useMoneyWaterfall.ts` | imported by nothing; the logic lives in `src/lib/moneyWaterfall.ts` (still used) |
| 3 | Remove dead exports | `localDbExists` (autoLog/db), `processNotification` (autoLog/engine), `ProrationPreview`, `InsightTakeawayStatus`, `pureDeficitBalancedCopy`, `GLYPH_STRIP`, `knownPeopleNames`, `PRESS_IN_SPRING`, `dailyBudgetAllowanceOnDate`, `incomeTotalsByDateKey`, `DailyBudgetGet`, `DailyBudgetSet` | referenced nowhere; confirm each with `grep -rn` first (the money ones ⚠️: delete only if truly unreferenced, do not "merge") |
| 4 | Guard 2 release logs | `store/dailyBudget/expenseBridge.ts`, `lib/notificationService.ts` | `if (__DEV__)` only |
| 5 | Selector fix | `AutoLogInfoScreen`, `AutoLogCenterScreen` (whole-store `useXStore()`) | field selectors / `useShallow`, same values |
| 6 | Docs | `CODEBASE_GUIDE.md`, `AGENTS.md` repo map | drop the 2 deleted files |

### Phase P2 — smoothness (2–4 days)
JS-thread animation → UI thread. Rule: **same duration, same easing, same start/end values**; only the engine changes.
| File | Today | Target |
|---|---|---|
| `components/BottomNavBar.tsx` (CapsuleTabItem, `useNativeDriver:false`, 180ms) | animates layout props on JS | Reanimated `withTiming(…, {duration:180, easing: Easing.out(Easing.cubic)})`; animate `transform`/`opacity`, not width, where the look allows |
| `hooks/useFormKeyboard.ts` (4×, keypad 220/200ms) | height animated on JS → the form re-lays out every frame | Reanimated shared value + `translateY` of the keypad (layout stays fixed), or `useAnimatedStyle` height (runs layout on UI thread) |
| `screens/insights/PeriodNavigator.tsx` (stretch-and-spring dots) | `left`/`width` springs on JS | Reanimated `withSequence(withTiming, withSpring)` with converted spring (`tension 100/friction 16` ≈ `stiffness 100, damping 16, mass 1`) |
| `screens/SavingsScreen.tsx` (progress bar 500ms) | width % on JS | `scaleX` with `transformOrigin: 'left'` on UI thread |
| `components/CashFlowChart.tsx`, `YearlyCashFlowChart.tsx`, `AnimatedCategoryDonut.tsx` | SVG props on JS | `useAnimatedProps` (same pattern now used by `DualRingChart`/`DonutChart`) |
| `components/PullToHistoryList.tsx` (2×) + `PanResponder` | JS gesture + JS animation | RNGH `Gesture.Native()`/`Pan` + Reanimated; thresholds in `lib/pullToHistoryPhysics.ts` stay identical |
| `screens/ExpenseFormScreen.tsx` (1×) + `PanResponder` | same | same |
| `screens/InsightsScreen.tsx` `PanResponder` (period swipe) | JS gesture | RNGH `Gesture.Pan().activeOffsetX(…)`, same distance/velocity thresholds |

Also in P2:
- **Lists:** `@shopify/flash-list` is installed but used nowhere. Either adopt it for long lists
  (`CategoryDetailScreen`, `ManageCategoriesScreen`, History if it grows) or remove it in the next native build
  (smaller APK). Do not keep both states.
- **Inline styles (177):** top offenders `AutoLogSetupScreen` (23), `ProfileScreen` (11), `AutoLogWelcomeBack` (8),
  `AutoLogCenter` (8), `CadenceSwitchModal` (8). Hoist static ones; memoise theme-dependent ones.
- **Gesture/press consistency:** 59 `TouchableOpacity` → `Pressable` with the shared press-scale (`toggleMotion.ts`).

### Phase P3 — redundancy (UI first, then ⚠️ money with tests)
UI (safe): `CadenceSwitchModal`/`PeriodRenewalModal`/`VaultSpendingGuardModal` share a 19–34 line header/body
block → `ModalHeroHeader`; `OfflineBanner`/`SyncFailedBanner` share 32 lines → `TopBannerShell`;
`CashFlowChart`/`YearlyCashFlowChart` share 34 lines of axis/grid → `ChartAxes`; `ProfileSetup`/`ResetPassword`/`Auth` share a form header →
`AuthHeader`; `ReviewSheet`/`ExpenseFormScreen` share category-chip code → `CategoryChipRow`;
`MoneyBackExtras`/`MoneyBackSheet` share 30 lines → shared row; `navigation/index.tsx` Savings guards (tab + stack)
share 23 lines → one `useSavingsGuard()`; `BrandedHeroCard` Income/Expense columns repeated for Budget vs Pure
mode → one `MetricColumn` (labels passed in).

⚠️ Money (only with characterization tests that snapshot outputs for many inputs before and after):
`store/dailyBudget/planActions.ts` (5 internal clones), `dailyBudgetStore.ts` (lines 249–277 ≈ 916–944),
`dailyBudget/hydrate.ts` (112–134 ≈ 546–571), `planActions` ↔ `rollover.ts`, `expense/syncPending.ts`,
`weeklyInsightsUtils` ↔ `monthlyInsightsUtils`, `incomeClassifier.ts`, `useExpenseForm.ts`,
`insights/useInsightsData.ts`.

### Phase P4 — structure (as files are touched)
Split files > 700 lines by pure *moves*: `ExpenseFormScreen` (1,258), `budgetPeriods` (1,119), `chartUtils`
(1,113), `useExpenseForm` (1,091), `ReviewSheet` (1,081), `HomeScreen` (1,017), `dailyBudgetStore` (1,006),
`useInsightsData` (976), `planActions` (939), `InsightsScreen` (917), `yearlyInsightsUtils` (860),
`BrandedHeroCard` (857), `splitLedger` (837), `CadenceSwitchModal` (811), `monthlyInsightsUtils` (797).
Pattern already used in the repo: `*.styles.ts` + sub-components + pure helpers in `src/lib`.

Also: drop `export` from 294 symbols only used in their own file (list per file below) — smaller surface, no
runtime change. Replace 37 `as any` with real types.

---

## 4. Things I noticed that are NOT bugs but you should decide

- **Hinglish in the app:** splash tagline "Apna kharcha, apna hisaab" conflicts with your "plain English in-app"
  rule. Unchanged until you decide.
- **Docs drift:** `docs/CODEBASE_GUIDE.md` is written in Hinglish while the rest of docs are English — fine if
  intentional.
- **`react-native-screens`, `expo-dev-client`** do not appear in imports but are required (navigation runtime /
  dev builds). Keep them.

---

## 5. Verification protocol for every phase

1. `npx tsc --noEmit` → 0. 2. `npm test` → all green, count never drops. 3. `npx expo export --platform android` → OK.
4. Device smoke (release build): cold start ×5 (online, offline, logged out, app lock on, dark mode); every tab
   back-and-forth; add / edit / delete expense; split + money back; Gullak deposit; cadence switch; Insights
   swipe; pull to history. 5. Compare Home/Savings/Insights numbers before vs after on the same data (screenshots):
   must be identical to the paisa. 6. Update CHANGELOG + docs in the same PR (AGENTS.md rule).

---

## 6. File-by-file findings (all 233 files)

Legend: **P1** do first (dead code / clear win) · **P2** smoothness or redundancy · **P3** polish/consistency ·
⚠️ money-logic file (canonical-rules gate). "✅" = nothing worth changing.

## Area: `root`

### `App.tsx` — 286 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `index.ts` — 11 lines · imported by 0 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.


## Area: `src/navigation`

### `src/navigation/index.tsx` — 262 lines · imported by 1 file(s)
- **[P2 · redundancy]** Copy-paste block: lines 63–85 duplicate src/navigation/index.tsx lines 102–124 (23 lines). Extract a shared helper/component.

### `src/navigation/navigationRef.ts` — 31 lines · imported by 6 file(s)
- ✅ The `setInterval` is bounded (30 × 100ms, cleared on success or give-up). Fine. Optional: replace polling with a one-shot `onReady` queue in the container (same behaviour, no timer).


## Area: `src/config`

### `src/config/supabase.ts` — 38 lines · imported by 20 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/config/theme.ts` — 368 lines · imported by 102 file(s)
- **[P3 · surface]** Exported but only used inside this file: `hslToHex`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.


## Area: `src/types`

### `src/types/index.ts` — 102 lines · imported by 63 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.


## Area: `src/screens`

### `src/screens/AddEditCategoryScreen.tsx` — 408 lines · imported by 1 file(s)
- **[P3 · type safety]** 2× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P3 · design tokens]** 16 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/screens/AuthScreen.tsx` — 649 lines · imported by 1 file(s)
- **[P3 · consistency]** 12 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · design tokens]** 22 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · redundancy]** Copy-paste block: lines 46–62 duplicate src/screens/ProfileSetupScreen.tsx lines 46–61 (17 lines). Extract a shared helper/component.

### `src/screens/CategoryDetailScreen.tsx` — 343 lines · imported by 1 file(s)
- **[P3 · design tokens]** 7 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · lists]** `FlatList`. `@shopify/flash-list` is already a dependency but unused anywhere; either use it for long lists here (recycling, no blank cells on fast scroll) or remove the dependency (needs a new APK).

### `src/screens/ExpenseDetailScreen.tsx` — 655 lines · imported by 1 file(s)
- **[P2 · render cost]** 4 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 12 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/screens/ExpenseFormScreen.tsx` — 1258 lines · imported by 1 file(s)
- **[P1 · smoothness]** 1× `useNativeDriver: false` — runs every frame on the JS thread; stutters while data loads. Port to Reanimated (`useSharedValue` + `useAnimatedStyle`, or `useAnimatedProps` for SVG) keeping the SAME durations/easings/targets, or animate a transform instead of width/height/left.
- **[P2 · gestures]** `PanResponder` (JS-thread gesture). Move to `react-native-gesture-handler` `Gesture.Pan` + Reanimated so the drag tracks the finger at 120 Hz with no JS involvement. Same thresholds.
- **[P3 · type safety]** 2× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P2 · render cost]** 5 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 13 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · maintainability]** 1258 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 68–94 duplicate src/components/autolog/ReviewSheet.tsx lines 75–101 (27 lines). Extract a shared helper/component.
- **[P2 · redundancy]** Copy-paste block: lines 119–137 duplicate src/components/autolog/ReviewSheet.tsx lines 110–123 (14 lines). Extract a shared helper/component.

### `src/screens/FaqScreen.tsx` — 290 lines · imported by 1 file(s)
- **[P2 · render cost]** 3 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/screens/GullakDepositDetailScreen.tsx` — 300 lines · imported by 1 file(s)
- **[P2 · render cost]** 3 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/screens/HistoryScreen.tsx` — 738 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `HistoryItem`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · maintainability]** 738 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 169–185 duplicate src/screens/InsightsScreen.tsx lines 122–138 (17 lines). Extract a shared helper/component.

### `src/screens/HomeScreen.tsx` — 1017 lines · imported by 1 file(s)
- **[P3 · consistency]** 1 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · type safety]** 4× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P2 · maintainability]** 1017 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.

### `src/screens/InsightsScreen.tsx` — 917 lines · imported by 1 file(s)
- **[P2 · gestures]** `PanResponder` (JS-thread gesture). Move to `react-native-gesture-handler` `Gesture.Pan` + Reanimated so the drag tracks the finger at 120 Hz with no JS involvement. Same thresholds.
- **[P2 · render cost]** 7 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 25 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · maintainability]** 917 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 122–138 duplicate src/screens/HistoryScreen.tsx lines 169–185 (17 lines). Extract a shared helper/component.

### `src/screens/LedgerScreen.tsx` — 367 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/screens/ManageCategoriesScreen.tsx` — 214 lines · imported by 1 file(s)
- **[P2 · lists]** `FlatList`. `@shopify/flash-list` is already a dependency but unused anywhere; either use it for long lists here (recycling, no blank cells on fast scroll) or remove the dependency (needs a new APK).

### `src/screens/NotificationsScreen.tsx` — 372 lines · imported by 1 file(s)
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P3 · design tokens]** 7 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3 · consistency]** 3× `TouchableOpacity`. The design system uses `Pressable`/`ItemRowShell` with spring press; migrate for one consistent press feel (opacity values identical).

### `src/screens/OnboardingScreen.tsx` — 571 lines · imported by 1 file(s)
- **[P3 · design tokens]** 34 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3]** 2× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.
- **[P2 · lists]** `FlatList`. `@shopify/flash-list` is already a dependency but unused anywhere; either use it for long lists here (recycling, no blank cells on fast scroll) or remove the dependency (needs a new APK).

### `src/screens/ProfileScreen.styles.ts` — 389 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/screens/ProfileScreen.tsx` — 767 lines · imported by 1 file(s)
- **[P3 · type safety]** 2× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P2 · render cost]** 11 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 7 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · maintainability]** 767 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.

### `src/screens/ProfileSetupScreen.tsx` — 452 lines · imported by 1 file(s)
- **[P3 · consistency]** 2 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P2 · render cost]** 3 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 28 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · redundancy]** Copy-paste block: lines 46–61 duplicate src/screens/AuthScreen.tsx lines 46–62 (17 lines). Extract a shared helper/component.
- **[P2 · redundancy]** Copy-paste block: lines 36–61 duplicate src/screens/ResetPasswordScreen.tsx lines 32–57 (26 lines). Extract a shared helper/component.

### `src/screens/ResetPasswordScreen.tsx` — 490 lines · imported by 1 file(s)
- **[P3 · consistency]** 5 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · design tokens]** 18 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · redundancy]** Copy-paste block: lines 32–57 duplicate src/screens/ProfileSetupScreen.tsx lines 36–61 (26 lines). Extract a shared helper/component.

### `src/screens/SavingsScreen.styles.ts` — 441 lines · imported by 5 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/screens/SavingsScreen.tsx` — 513 lines · imported by 1 file(s)
- **[P1 · smoothness]** 1× `useNativeDriver: false` — runs every frame on the JS thread; stutters while data loads. Port to Reanimated (`useSharedValue` + `useAnimatedStyle`, or `useAnimatedProps` for SVG) keeping the SAME durations/easings/targets, or animate a transform instead of width/height/left.
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/screens/SplashScreen.tsx` — 610 lines · imported by 1 file(s)
- **[P3 · type safety]** 2× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P3]** 2× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.

### `src/screens/UpdateRequiredScreen.tsx` — 415 lines · imported by 1 file(s)
- **[P3]** 1× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.

### `src/screens/autolog/AutoLogAccountsScreen.tsx` — 98 lines · imported by 1 file(s)
- **[P2 · render cost]** 5 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/screens/autolog/AutoLogCenterScreen.tsx` — 352 lines · imported by 1 file(s)
- **[P2 · render cost]** 8 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P1 · re-renders]** Subscribes to a whole Zustand store (`useXStore()` with no selector): every store change re-renders this screen. Use field selectors / `useShallow`.
- **[P2]** 1× `setInterval`. Make sure it is cleared on blur (not only unmount) because tabs are frozen, not unmounted.

### `src/screens/autolog/AutoLogEmailScreen.tsx` — 129 lines · imported by 1 file(s)
- **[P2 · render cost]** 6 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/screens/autolog/AutoLogInfoScreen.tsx` — 153 lines · imported by 1 file(s)
- **[P2 · render cost]** 6 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P1 · re-renders]** Subscribes to a whole Zustand store (`useXStore()` with no selector): every store change re-renders this screen. Use field selectors / `useShallow`.

### `src/screens/autolog/AutoLogIntroScreen.tsx` — 110 lines · imported by 1 file(s)
- **[P2 · render cost]** 4 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/screens/autolog/AutoLogReviewScreen.tsx` — 404 lines · imported by 1 file(s)
- **[P2 · render cost]** 7 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/screens/autolog/AutoLogSetupScreen.tsx` — 686 lines · imported by 1 file(s)
- **[P2 · render cost]** 23 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/screens/autolog/AutoLogWelcomeBackScreen.tsx` — 187 lines · imported by 1 file(s)
- **[P2 · render cost]** 8 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/screens/insights/InsightsScreen.styles.ts` — 200 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/screens/insights/PeriodNavigator.tsx` — 184 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `navStyles`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P1 · smoothness]** 2× `useNativeDriver: false` — runs every frame on the JS thread; stutters while data loads. Port to Reanimated (`useSharedValue` + `useAnimatedStyle`, or `useAnimatedProps` for SVG) keeping the SAME durations/easings/targets, or animate a transform instead of width/height/left.
- **[P3]** 1× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.

### `src/screens/insights/periodUtils.ts` — 73 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/screens/insights/useInsightsData.ts` — 976 lines · imported by 2 file(s)
- **[info]** Exported only for tests: `UseInsightsDataParams`, `buildCategoryMap`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P2 · maintainability]** 976 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 678–691 duplicate src/screens/insights/useInsightsData.ts lines 886–899 (14 lines). Extract a shared helper/component.


## Area: `src/components`

### `src/components/AmbientBackground.tsx` — 282 lines · imported by 5 file(s)
- **[P3 · surface]** Exported but only used inside this file: `AmbientBackgroundProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 3 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P2 · render cost]** 3 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/components/AnimatedCategoryDonut.tsx` — 301 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `AnimatedCategoryDonutProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P1 · smoothness]** 1× `useNativeDriver: false` — runs every frame on the JS thread; stutters while data loads. Port to Reanimated (`useSharedValue` + `useAnimatedStyle`, or `useAnimatedProps` for SVG) keeping the SAME durations/easings/targets, or animate a transform instead of width/height/left.

### `src/components/AnimatedToggle.tsx` — 246 lines · imported by 5 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/AppLockOverlay.tsx` — 159 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/AppRefreshControl.tsx` — 59 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `AppRefreshControlProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/BehavioralInsightRow.tsx` — 174 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BehavioralInsightRowProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/BottomNavBar.tsx` — 631 lines · imported by 1 file(s)
- Spacing is now responsive (`lib/navBarLayout.ts`). The original animation was deliberately kept (per-tab capsule fade + label expand + icon press bounce), so the remaining items below still apply: the capsule fade is `useNativeDriver:false` (JS thread) and could move to Reanimated with the SAME curves; the two tab blocks (lines ~186–215 / ~235–264) could share one renderer.

### `src/components/BouncyCategoryFilter.tsx` — 361 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `FilterOption`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/BouncyFilterToggle.tsx` — 46 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BouncyFilterToggleProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/BouncyPaymentToggle.tsx` — 71 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BouncyPaymentToggleProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/BouncyTypeToggle.tsx` — 46 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BouncyTypeToggleProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/BrandedHeroCard.tsx` — 857 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BrandedHeroCardProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `buildNotchedCardPath`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3]** 3× `StyleSheet.flatten` in render — memoise with `useMemo` keyed on the colour/flag it depends on.
- **[P3 · design tokens]** 6 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · maintainability]** 857 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 540–557 duplicate src/components/BrandedHeroCard.tsx lines 579–596 (18 lines). Extract a shared helper/component.
- **[P2 · redundancy]** Copy-paste block: lines 559–574 duplicate src/components/BrandedHeroCard.tsx lines 596–611 (16 lines). Extract a shared helper/component.

### `src/components/BreathingStripShell.tsx` — 291 lines · imported by 3 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BreathingStripTileConfig`, `BreathingStripShellProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/components/BudgetEditModal.tsx` — 796 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BudgetEditModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 1 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P2 · render cost]** 6 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 11 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3 · consistency]** 4× `TouchableOpacity`. The design system uses `Pressable`/`ItemRowShell` with spring press; migrate for one consistent press feel (opacity values identical).
- **[P2 · maintainability]** 796 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 408–421 duplicate src/components/DepositGullakModal.tsx lines 199–212 (14 lines). Extract a shared helper/component.

### `src/components/CadenceSwitchModal.tsx` — 811 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `CadenceSwitchModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 6 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P2 · render cost]** 8 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 13 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3 · consistency]** 7× `TouchableOpacity`. The design system uses `Pressable`/`ItemRowShell` with spring press; migrate for one consistent press feel (opacity values identical).
- **[P2 · maintainability]** 811 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 70–103 duplicate src/components/PeriodRenewalModal.tsx lines 71–104 (34 lines). Extract a shared helper/component.
- **[P2 · redundancy]** Copy-paste block: lines 85–103 duplicate src/components/VaultSpendingGuardModal.tsx lines 77–95 (19 lines). Extract a shared helper/component.

### `src/components/CashFlowChart.tsx` — 637 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `CashFlowChartProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P1 · smoothness]** 1× `useNativeDriver: false` — runs every frame on the JS thread; stutters while data loads. Port to Reanimated (`useSharedValue` + `useAnimatedStyle`, or `useAnimatedProps` for SVG) keeping the SAME durations/easings/targets, or animate a transform instead of width/height/left.
- **[P2 · redundancy]** Copy-paste block: lines 100–133 duplicate src/components/YearlyCashFlowChart.tsx lines 77–110 (34 lines). Extract a shared helper/component.

### `src/components/CategoryRowItem.tsx` — 146 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `CategoryRowItemProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/CustomDatePickerModal.tsx` — 526 lines · imported by 1 file(s)
- **[P3]** 1× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.

### `src/components/DepositGullakModal.styles.ts` — 247 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/DepositGullakModal.tsx` — 721 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `DepositGullakModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 5 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P2 · render cost]** 7 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 28 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3 · consistency]** 11× `TouchableOpacity`. The design system uses `Pressable`/`ItemRowShell` with spring press; migrate for one consistent press feel (opacity values identical).
- **[P2 · maintainability]** 721 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 199–212 duplicate src/components/BudgetEditModal.tsx lines 408–421 (14 lines). Extract a shared helper/component.

### `src/components/DonutChart.tsx` — 166 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `DonutProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/DualRingChart.tsx` — 227 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `DualRingChartProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/ErrorBoundary.tsx` — 166 lines · imported by 1 file(s)
- **[P3 · design tokens]** 9 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/components/ExpenseFundingCard.tsx` — 73 lines · imported by 1 file(s)
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/components/GoogleIcon.tsx` — 30 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/GradientIconBadge.tsx` — 77 lines · imported by 19 file(s)
- **[P3 · surface]** Exported but only used inside this file: `GradientIconBadgeProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/GullakDepositRow.tsx` — 55 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `GullakDepositRowProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/HeroDetailsSheet.tsx` — 128 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `HeroDetailsSheetProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/KeyButton.tsx` — 125 lines · imported by 2 file(s)
- **[P3 · consistency]** 2 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).

### `src/components/MoneyExplainerModal.tsx` — 567 lines · imported by 6 file(s)
- **[P3 · surface]** Exported but only used inside this file: `MoneyHelpBadgeProps`, `MoneyExplainerModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 8 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3]** 1× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.

### `src/components/MonthlyBreathingStrip.tsx` — 95 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `MonthlyBreathingStripProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/OfflineBanner.tsx` — 185 lines · imported by 1 file(s)
- **[P3 · consistency]** 6 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · design tokens]** 12 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · redundancy]** Copy-paste block: lines 31–62 duplicate src/components/SyncFailedBanner.tsx lines 31–62 (32 lines). Extract a shared helper/component.

### `src/components/OtaUpdateModal.tsx` — 239 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `OtaUpdateModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · render cost]** 3 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3]** 1× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.

### `src/components/PeriodRenewalModal.tsx` — 567 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `PeriodRenewalModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 6 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · consistency]** 6× `TouchableOpacity`. The design system uses `Pressable`/`ItemRowShell` with spring press; migrate for one consistent press feel (opacity values identical).
- **[P2 · redundancy]** Copy-paste block: lines 71–104 duplicate src/components/CadenceSwitchModal.tsx lines 70–103 (34 lines). Extract a shared helper/component.

### `src/components/PiggyBankCoinIcon.tsx` — 249 lines · imported by 15 file(s)
- **[P3 · surface]** Exported but only used inside this file: `PiggyBankCoinIconProps`, `AnimatedPiggyBankProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `PIGGY_TAIL_PATH`, `PIGGY_BODY_PATH`, `COIN_PATH`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3 · consistency]** 11 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).

### `src/components/PullToHistoryIndicator.tsx` — 151 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `PullToHistoryIndicatorProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 1 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).

### `src/components/PullToHistoryList.tsx` — 458 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `PullToHistoryListProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P1 · smoothness]** 2× `useNativeDriver: false` — runs every frame on the JS thread; stutters while data loads. Port to Reanimated (`useSharedValue` + `useAnimatedStyle`, or `useAnimatedProps` for SVG) keeping the SAME durations/easings/targets, or animate a transform instead of width/height/left.
- **[P2 · gestures]** `PanResponder` (JS-thread gesture). Move to `react-native-gesture-handler` `Gesture.Pan` + Reanimated so the drag tracks the finger at 120 Hz with no JS involvement. Same thresholds.

### `src/components/RefreshScrollShell.tsx` — 55 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `RefreshScrollShellProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/RollingText.tsx` — 457 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `RollingTextProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 1 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P2 · render cost]** 3 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/components/SavingsRecordRow.tsx` — 318 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SavingsRecordRowProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/SpendingFlowChart.tsx` — 353 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SpendingDayData`, `SpendingFlowChartProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 1 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · design tokens]** 6 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/components/SplashCover.tsx` — 55 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/StreakCalendarModal.styles.ts` — 200 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/StreakCalendarModal.tsx` — 685 lines · imported by 1 file(s)
- **[P3 · consistency]** 2 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P3 · design tokens]** 14 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3]** 1× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.

### `src/components/StreakFlame.tsx` — 160 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `StreakFlameProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 1 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).

### `src/components/SyncFailedBanner.tsx` — 234 lines · imported by 1 file(s)
- **[P3 · consistency]** 6 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · design tokens]** 6 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · redundancy]** Copy-paste block: lines 31–62 duplicate src/components/OfflineBanner.tsx lines 31–62 (32 lines). Extract a shared helper/component.

### `src/components/TransactionRow.tsx` — 96 lines · imported by 3 file(s)
- **[P3 · surface]** Exported but only used inside this file: `TxRowProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 2 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).

### `src/components/VaultSpendingGuardModal.tsx` — 686 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `VaultSpendingGuardModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 6 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · design tokens]** 13 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3 · consistency]** 6× `TouchableOpacity`. The design system uses `Pressable`/`ItemRowShell` with spring press; migrate for one consistent press feel (opacity values identical).
- **[P2 · redundancy]** Copy-paste block: lines 77–95 duplicate src/components/CadenceSwitchModal.tsx lines 85–103 (19 lines). Extract a shared helper/component.

### `src/components/WeeklyBreathingStrip.tsx` — 121 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `WeeklyBreathingStripProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/WelcomeBackGapModal.tsx` — 213 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `WelcomeBackGapModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/YearlyBreathingStrip.tsx` — 115 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `YearlyBreathingStripProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/YearlyCashFlowChart.tsx` — 336 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `YearlyCashFlowChartProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P1 · smoothness]** 1× `useNativeDriver: false` — runs every frame on the JS thread; stutters while data loads. Port to Reanimated (`useSharedValue` + `useAnimatedStyle`, or `useAnimatedProps` for SVG) keeping the SAME durations/easings/targets, or animate a transform instead of width/height/left.
- **[P2 · redundancy]** Copy-paste block: lines 77–110 duplicate src/components/CashFlowChart.tsx lines 100–133 (34 lines). Extract a shared helper/component.

### `src/components/YearlySavingsMilestoneCard.tsx` — 291 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `YearlySavingsMilestoneCardProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/autolog/AutoLogGate.tsx` — 79 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/autolog/AutoLogHomeBanner.tsx` — 46 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/autolog/AutoLogUi.tsx` — 201 lines · imported by 11 file(s)
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P2 · render cost]** 3 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3]** 1× `key={index}`. Fine for static, never-reordered arrays (logo pieces, dots); use stable ids anywhere the list can change.

### `src/components/autolog/EmailSourceInfo.tsx` — 59 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SUPPORTED_EMAIL_APPS`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · render cost]** 3 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.

### `src/components/autolog/ReviewSheet.tsx` — 1081 lines · imported by 2 file(s)
- **[P3 · consistency]** 8 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.
- **[P2 · maintainability]** 1081 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 75–101 duplicate src/screens/ExpenseFormScreen.tsx lines 68–94 (27 lines). Extract a shared helper/component.
- **[P2 · redundancy]** Copy-paste block: lines 110–123 duplicate src/screens/ExpenseFormScreen.tsx lines 119–137 (14 lines). Extract a shared helper/component.

### `src/components/autolog/WhyLoggedCard.tsx` — 180 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/profile/DeleteAccountModal.tsx` — 141 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `DeleteAccountModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/profile/EditProfileModal.tsx` — 210 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `EditProfileModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/profile/PauseBudgetModal.tsx` — 156 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `PauseBudgetModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 3× `TouchableOpacity`. The design system uses `Pressable`/`ItemRowShell` with spring press; migrate for one consistent press feel (opacity values identical).

### `src/components/savings/BudgetHubSection.tsx` — 354 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BudgetHubSectionProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · render cost]** 4 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 17 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3 · consistency]** 3× `TouchableOpacity`. The design system uses `Pressable`/`ItemRowShell` with spring press; migrate for one consistent press feel (opacity values identical).

### `src/components/savings/SavingsHeader.tsx` — 57 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SavingsHeaderProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/savings/SavingsHeroCard.tsx` — 185 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SavingsHeroCardProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 1 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P2 · render cost]** 6 inline `style={…}` objects: a new object on every render defeats `React.memo` of children. Hoist static ones into `StyleSheet.create`; memoise the theme-dependent ones.
- **[P3 · design tokens]** 7 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/components/savings/SavingsHistorySection.tsx` — 117 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SavingsHistorySectionProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/components/split/MoneyBackExtras.tsx` — 312 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `MoneyBackExtrasProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · redundancy]** Copy-paste block: lines 282–311 duplicate src/components/split/MoneyBackSheet.tsx lines 358–387 (30 lines). Extract a shared helper/component.

### `src/components/split/MoneyBackSheet.tsx` — 388 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `MoneyBackSheetProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · redundancy]** Copy-paste block: lines 358–387 duplicate src/components/split/MoneyBackExtras.tsx lines 282–311 (30 lines). Extract a shared helper/component.

### `src/components/split/SettleExpenseSheet.tsx` — 289 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SettleExpenseSheetProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/split/SplitDetailCard.tsx` — 203 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SplitDetailCardProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/split/SplitExtras.tsx` — 348 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SplitExtrasProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/transfer/TransferDetailCard.tsx` — 26 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/components/transfer/TransferExtras.tsx` — 121 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `TransferExtrasProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/ui/AmountText.tsx` — 232 lines · imported by 9 file(s)
- **[P3 · surface]** Exported but only used inside this file: `AmountRole`, `AmountDirection`, `AmountTextProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/ui/AppButton.tsx` — 197 lines · imported by 17 file(s)
- **[P3 · surface]** Exported but only used inside this file: `ButtonVariant`, `ButtonSize`, `AppButtonProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 2 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).

### `src/components/ui/AppInput.tsx` — 211 lines · imported by 0 file(s)
- **[P1 · dead file]** Nothing imports this file (app or tests). Delete it after a final `grep` + `tsc` + `npm test`. Zero behaviour change.
- **[P3 · surface]** Exported but only used inside this file: `InputVariant`, `AppInputProps`, `AppInput`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/ui/AuthFormField.tsx` — 194 lines · imported by 3 file(s)
- **[P3 · surface]** Exported but only used inside this file: `AuthFormFieldProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/ui/AuthMessageBanner.tsx` — 96 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `AuthMessageBannerProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 2 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · design tokens]** 8 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/components/ui/BottomSheetModal.tsx` — 440 lines · imported by 6 file(s)
- **[P3 · surface]** Exported but only used inside this file: `BottomSheetModalProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 6 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/components/ui/ItemRowShell.tsx` — 182 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `ItemRowShellProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · consistency]** 4 core `Animated` calls (native driver). Fine today; migrate to Reanimated only when the file is touched, so the app ends on one animation system (no visual change: same curves).

### `src/components/ui/KeypadGrid.tsx` — 68 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `KeypadGridProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/ui/SegmentedControl.tsx` — 555 lines · imported by 11 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SegmentedControlProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/components/ui/StatusBadge.tsx` — 118 lines · imported by 3 file(s)
- **[P3 · surface]** Exported but only used inside this file: `StatusBadgeVariant`, `StatusBadgeProps`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.


## Area: `src/hooks`

### `src/hooks/useExpenseForm.ts` — 1091 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `UseExpenseFormParams`, `UseExpenseFormReturn`, `SplitMemberState`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · maintainability]** 1091 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 813–826 duplicate src/hooks/useExpenseForm.ts lines 984–997 (14 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.

### `src/hooks/useFocusEntry.ts` — 72 lines · imported by 3 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/hooks/useFormKeyboard.ts` — 227 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `UseFormKeyboardReturn`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P1 · smoothness]** 4× `useNativeDriver: false` — runs every frame on the JS thread; stutters while data loads. Port to Reanimated (`useSharedValue` + `useAnimatedStyle`, or `useAnimatedProps` for SVG) keeping the SAME durations/easings/targets, or animate a transform instead of width/height/left.

### `src/hooks/useMoneyWaterfall.ts` — 40 lines · imported by 0 file(s)
- **[P1 · dead file]** Nothing imports this file (app or tests). Delete it after a final `grep` + `tsc` + `npm test`. Zero behaviour change.
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `useMoneyWaterfall`. Remove (or remove the `export` if it is used inside).

### `src/hooks/useRingSweep.ts` — 101 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/hooks/useSavingsDashboard.ts` — 202 lines · imported by 3 file(s)
- **[P3 · surface]** Exported but only used inside this file: `UseSavingsDashboardReturn`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/hooks/useScrollDirection.ts` — 55 lines · imported by 5 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.


## Area: `src/store`

### `src/store/ambientStore.ts` — 35 lines · imported by 3 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/appLockStore.ts` — 218 lines · imported by 5 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/authStore.ts` — 293 lines · imported by 35 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3]** 4× `JSON.parse` — keep every one inside try/catch (corrupt cache must not crash startup) and off the first-frame path where possible.

### `src/store/categoryStore.ts` — 466 lines · imported by 40 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `DEFAULT_CATEGORY_COLORS`, `LEGACY_CATEGORY_COLOR_MAP`, `normalizeCategoryColors`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · design tokens]** 28 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P3]** 5× `JSON.parse` — keep every one inside try/catch (corrupt cache must not crash startup) and off the first-frame path where possible.

### `src/store/dailyBudget/classifiers.ts` — 15 lines · imported by 5 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/dailyBudget/expenseBridge.ts` — 57 lines · imported by 5 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `AddExpenseBridgeFn`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · perf/privacy]** 1 `console.log/warn` not guarded by `__DEV__`. In release Hermes still formats the args; wrap in `if (__DEV__)`. Check it never logs amounts/notes.

### `src/store/dailyBudget/hydrate.ts` — 620 lines · imported by 1 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `PersistStoreLike`, `RemoteProfileData`, `RemotePlanChangeEntry`, `RemoteBudgetPeriodEntry`, `RemoteBudgetData`, `HydrateContext`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · redundancy]** Copy-paste block: lines 112–134 duplicate src/store/dailyBudget/hydrate.ts lines 546–571 (23 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.

### `src/store/dailyBudget/legacyStatus.ts` — 17 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/dailyBudget/metrics.ts` — 396 lines · imported by 8 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/dailyBudget/pendingStorage.ts` — 95 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3]** 2× `JSON.parse` — keep every one inside try/catch (corrupt cache must not crash startup) and off the first-frame path where possible.

### `src/store/dailyBudget/planActions.ts` — 939 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P2 · maintainability]** 939 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 179–192 duplicate src/store/dailyBudget/planActions.ts lines 452–465 (14 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.
- **[P2 · redundancy]** Copy-paste block: lines 417–437 duplicate src/store/dailyBudget/planActions.ts lines 504–525 (21 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.
- **[P2 · redundancy]** Copy-paste block: lines 418–437 duplicate src/store/dailyBudget/planActions.ts lines 689–708 (20 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.
- **[P2 · redundancy]** Copy-paste block: lines 510–526 duplicate src/store/dailyBudget/planActions.ts lines 693–709 (17 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.
- **[P2 · redundancy]** Copy-paste block: lines 684–712 duplicate src/store/dailyBudget/planActions.ts lines 768–796 (29 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.
- **[P2 · redundancy]** Copy-paste block: lines 863–882 duplicate src/store/dailyBudget/rollover.ts lines 405–426 (20 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.

### `src/store/dailyBudget/rollover.ts` — 459 lines · imported by 2 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `FinalizeDailyRecordsContext`, `FinalizePeriodsContext`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · redundancy]** Copy-paste block: lines 405–426 duplicate src/store/dailyBudget/planActions.ts lines 863–882 (20 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.

### `src/store/dailyBudget/selfHealing.ts` — 183 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/dailyBudget/types.ts` — 117 lines · imported by 10 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `DailyBudgetGet`, `DailyBudgetSet`. Remove (or remove the `export` if it is used inside).

### `src/store/dailyBudgetStore.ts` — 1006 lines · imported by 55 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P2 · maintainability]** 1006 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 249–277 duplicate src/store/dailyBudgetStore.ts lines 916–944 (29 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.

### `src/store/expense/moneyBack.ts` — 148 lines · imported by 7 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `RecordMoneyBackParams`, `MoneyBackResult`, `ConvertToMoneyBackParams`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `previewMoneyBack`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/store/expense/payload.ts` — 35 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/expense/pendingQueues.ts` — 123 lines · imported by 2 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3]** 6× `JSON.parse` — keep every one inside try/catch (corrupt cache must not crash startup) and off the first-frame path where possible.

### `src/store/expense/recoveryMiddleware.ts` — 31 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/expense/syncPending.ts` — 436 lines · imported by 1 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3]** 8× `JSON.parse` — keep every one inside try/catch (corrupt cache must not crash startup) and off the first-frame path where possible.
- **[P2 · redundancy]** Copy-paste block: lines 201–216 duplicate src/store/expense/syncPending.ts lines 238–253 (16 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.

### `src/store/expense/types.ts` — 146 lines · imported by 16 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `RecoveryAllocation`, `UpdateExpenseExtras`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/store/expenseStore.ts` — 755 lines · imported by 58 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3]** 11× `JSON.parse` — keep every one inside try/catch (corrupt cache must not crash startup) and off the first-frame path where possible.
- **[P2 · maintainability]** 755 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.

### `src/store/navBarStore.ts` — 14 lines · imported by 5 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/networkStore.ts` — 135 lines · imported by 11 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/notificationStore.ts` — 120 lines · imported by 8 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/otaStore.ts` — 88 lines · imported by 3 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/store/splashCoverStore.ts` — 73 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `SplashCoverPhase`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/store/themeStore.ts` — 97 lines · imported by 81 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `ThemeMode`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `useThemeStore`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/store/transferRulesStore.ts` — 68 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.


## Area: `src/money`

### `src/money/budgetAllowance.ts` — 95 lines · imported by 7 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `dailyBudgetAllowanceOnDate`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `BudgetCadenceName`, `BudgetAllowancePlan`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/money/budgetStatus.ts` — 29 lines · imported by 7 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `BudgetStatus`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/money/dateKeys.ts` — 87 lines · imported by 12 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/money/index.ts` — 13 lines · imported by 1 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/money/ledger.ts` — 158 lines · imported by 8 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `incomeTotalsByDateKey`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `LedgerSourceRow`, `LedgerCategory`, `LedgerEntry`, `TotalsByDateKey`, `buildCategoryLookup`, `toLedgerEntry`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/money/overspendFunding.ts` — 27 lines · imported by 2 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `OverspendFunding`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.


## Area: `src/lib`

### `src/lib/ambientBackground.ts` — 240 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `FADE_STOP_COUNT`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `AMBIENT_INTENSITY`, `AMBIENT_HEADER_BLOCK`, `TONES`, `GUST_MAX_TRAVEL`, `gustEnvelope`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3 · design tokens]** 12 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/lib/ambientGrain.ts` — 10 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/ambientWind.ts` — 10 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/amountKeypad.ts` — 288 lines · imported by 8 file(s)
- **[P3 · surface]** Exported but only used inside this file: `KeypadRules`, `DEFAULT_KEYPAD_RULES`, `OPERATOR_CHARS`, `OperatorChar`, `normalizeOperator`, `EvaluationResult`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `parseKeypadAmount`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/animationUtils.ts` — 33 lines · imported by 2 file(s)
- **[info]** Exported only for tests: `enableLayoutAnimationOnAndroid`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/lib/apkInstaller.ts` — 83 lines · imported by 1 file(s)
- **[P3 · surface]** Exported but only used inside this file: `InstallerEvent`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/asyncStorageList.ts` — 17 lines · imported by 3 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/authLinkHandler.ts` — 257 lines · imported by 2 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/budgetAlerts.ts` — 90 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `LimitEventInput`, `RolloverEventInput`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/budgetCalculations.ts` — 543 lines · imported by 27 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `ExpenseItem`, `NonIncomeExpenseEntry`, `extractNonIncomeExpense`, `extractEligibleIncome`, `RolloverNotificationParams`, `CycleFinancialInput`, `CycleFinancialResult`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/budgetModeUtils.ts` — 508 lines · imported by 9 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `ProrationPreview`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `TabName`, `WeeklyStreakCard`, `MonthlyStreakCell`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `getVisibleTabs`, `getUnproratedPacingPreview`, `getProrationPreview`, `buildWeeklyStreakCards`, `buildMonthlyStreakMatrix`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/budgetPeriods.ts` — 1119 lines · imported by 24 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `PeriodBounds`, `DateOwner`, `EffectiveFromKind`, `CalendarCadenceConnectionInfo`, `DailyCarryDay`, `PeriodCarry`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · maintainability]** 1119 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.

### `src/lib/budgetUtils.ts` — 194 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `ShouldDeletePhantom500DayParams`, `ResolveHydratedDayBudgetParams`, `BackdatedSpendingNoticeParams`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `shouldDeletePhantom500Day`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/cadenceSwitch.ts` — 289 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `CadenceSwitchValidation`, `CadenceCarryCalculation`, `CadenceAllocationSummary`, `computeAllocationSummary`, `CadenceSwitchPlan`, `getRemainingDaysInCurrentPeriod`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `checkCadenceCapacity`, `calculateCadenceCarryForward`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/chartUtils.ts` — 1113 lines · imported by 9 file(s)
- **[P3 · surface]** Exported but only used inside this file: `SegmentInterpolation`, `PreparedSegment`, `PreparedBlockSegment`, `PreparedBlockSweepSegment`, `MonthlyWeekSpending`, `MonthlyCashFlowData`, `MonthlyCashFlowBudgetConfig`, `GullakMilestoneProgress`, `DualRingState`, `CashFlowChartPalette`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `buildSegmentInterpolation`, `prepareCategorySegments`, `generateRoundedBlockPath`, `generateFullAnnulusPath`, `prepareBlockSweepSegments`, `getSpendingFlowFillColor`, `computeMonthlyWeeksData`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3 · design tokens]** 19 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.
- **[P2 · maintainability]** 1113 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.

### `src/lib/colorUtils.ts` — 117 lines · imported by 4 file(s)
- **[info]** Exported only for tests: `shadeColor`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3 · design tokens]** 10 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/lib/dateFilters.ts` — 60 lines · imported by 6 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/deepLinkGuard.ts` — 133 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `DecodedJwtPayload`, `DeepLinkAction`, `EvaluateDeepLinkParams`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `parseJwtPayload`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/expenseFilters.ts` — 36 lines · imported by 3 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/flameUtils.ts` — 146 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `EmberConfig`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · design tokens]** 24 hard-coded hex colours. Move repeated ones to `theme.ts` tokens (same values → zero visual change), fixes dark-mode drift later.

### `src/lib/formatters.ts` — 127 lines · imported by 72 file(s)
- **[P3 · surface]** Exported but only used inside this file: `CompactCurrencyOptions`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/gapFiller.ts` — 117 lines · imported by 3 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `FindInactiveGapDaysParams`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/gullakReconciliation.ts` — 47 lines · imported by 3 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `GullakDeficitParams`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/heroDetails.ts` — 178 lines · imported by 5 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `HeroDetailsInput`, `DetailRow`, `DetailSection`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/homeCalculations.ts` — 667 lines · imported by 20 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `HomeFilter`, `ExpenseDateItem`, `DepositDateItem`, `PeriodSummary`, `ParsedChipNumber`, `PureHeroMetrics`, `ExpenseTotals`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `FILTER_DECOUPLE_DELAY_MS`, `PeriodCalculationParams`, `parseChipNumber`, `getPureHeroTitle`, `drawnFromGullakText`, `UnifiedTxItem`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/iconUtils.ts` — 15 lines · imported by 8 file(s)
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/lib/incomeClassifier.ts` — 97 lines · imported by 5 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `MinimalCategory`, `MinimalExpense`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · redundancy]** Copy-paste block: lines 33–48 duplicate src/lib/incomeClassifier.ts lines 71–86 (16 lines). Extract a shared helper/component — money code: extract ONLY with a characterization test first, byte-identical output.

### `src/lib/insightsCommon.ts` — 46 lines · imported by 4 file(s)
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `InsightTakeawayStatus`. Remove (or remove the `export` if it is used inside).

### `src/lib/moneyExplainerContent.ts` — 220 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `MoneyExplainerItem`, `MoneyExplainerContent`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `MONEY_EXPLAINER_DATA`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/moneyWaterfall.ts` — 445 lines · imported by 9 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `WaterfallKind`, `WaterfallPool`, `PoolResolver`, `IncomeDepositLike`, `ExpenseFundingSplit`, `DayFunding`, `ComputeWaterfallParams`, `PoolResolverParams`, `RawExpenseLike`, `WaterfallFromStateParams`, `ScopeFunding`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `WaterfallTx`, `computeMoneyWaterfall`, `buildPoolResolver`, `classifyForWaterfall`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/monthlyInsightsUtils.ts` — 797 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `MonthlyTakeawayParams`, `MonthlyComparisonResult`, `MonthlyLargestOutflowResult`, `MonthlyCategoryShiftResult`, `WeeklyCashFlowItem`, `MonthlyPeakWeekResult`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `MonthInterval`, `computeMonthlySpend`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P2 · maintainability]** 797 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.
- **[P2 · redundancy]** Copy-paste block: lines 279–300 duplicate src/lib/weeklyInsightsUtils.ts lines 180–201 (22 lines). Extract a shared helper/component.
- **[P2 · redundancy]** Copy-paste block: lines 327–347 duplicate src/lib/weeklyInsightsUtils.ts lines 213–233 (21 lines). Extract a shared helper/component.

### `src/lib/networkUtils.ts` — 57 lines · imported by 8 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/noteSuggestions.ts` — 67 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `NoteSuggestionOptions`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/notificationPolicy.ts` — 588 lines · imported by 9 file(s)
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `pureDeficitBalancedCopy`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `PlanType`, `ChannelSpec`, `CategoryTotal`, `CarryCoverEnd`, `CarryCoverPeriod`, `CarryCoverDay`, `NUDGE_TIME`, `REWARD_TIME`, `CARRY_TIME`, `WEEKLY_RECAP_TIME`, `MONTHLY_RECAP_TIME`, `WEEKLY_MIN_TXNS`, `MONTHLY_MIN_TXNS`, `REWARD_MIN_SAVED_RATIO`, `REWARD_MIN_SAVED_ABSOLUTE`, `STREAK_MILESTONES`, `Copy`, `carryEndCopy`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `NUDGE_HORIZON_DAYS`, `nudgeCopy`, `rewardCopy`, `weeklyRecapCopy`, `monthlyRecapCopy`, `periodCarryCoverCopy`, `capOnePerDay`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/notificationService.ts` — 308 lines · imported by 5 file(s)
- **[P3 · surface]** Exported but only used inside this file: `isDeviceNotificationSupported`, `areNotificationsEnabled`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P2 · perf/privacy]** 1 `console.log/warn` not guarded by `__DEV__`. In release Hermes still formats the args; wrap in `if (__DEV__)`. Check it never logs amounts/notes.

### `src/lib/notificationSync.ts` — 349 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `syncNotificationPlan`, `archiveDeliveredNotifications`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `buildPlanContext`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/paymentUtils.ts` — 27 lines · imported by 2 file(s)
- **[P3 · surface]** Exported but only used inside this file: `PaymentMode`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/profileUtils.ts` — 104 lines · imported by 5 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/pullToHistoryPhysics.ts` — 240 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `PULL_VIEWPORT_RATIO`, `MIN_MOMENTUM_VELOCITY`, `VisualState`, `RingArc`, `ReleaseDecision`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `PULL_CURVE_EXPONENT`, `PULL_MAX_TRAVEL_CAP`, `PULL_MAX_TRAVEL_MIN`, `ARM_PROGRESS`, `DISARM_PROGRESS`, `getFingerTravel`, `pullDepthFromTravel`, `travelFromPullDepth`, `ReleaseInput`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/quicksandMetrics.ts` — 77 lines · imported by 2 file(s)
- **[info]** Exported only for tests: `METRIC_CHARS`, `QUICKSAND_ADVANCES`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/rollingText.ts` — 270 lines · imported by 2 file(s)
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `GLYPH_STRIP`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `SPIN_UNCHANGED_DIGITS`, `RollDirection`, `CONTAINER_LAYOUT_KEYS`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `ROLL_EXTRA_CYCLES`, `GLYPHS`, `parseText`, `stepsBetween`, `WHEEL_BASE`, `wheelStart`, `wheelEnd`, `digitAt`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/segmentedMotion.ts` — 166 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `PillSpring`, `TRAILING_STIFFNESS_PER_EXTRA_SLOT`, `TRAILING_DAMPING_RATIO`, `PillEdges`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `LEADING_EDGE_SPRING`, `TRAILING_EDGE_SPRING`, `trailingSpringFor`, `simulateSpring`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/splitLedger.ts` — 837 lines · imported by 19 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `knownPeopleNames`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `LedgerAllocation`, `RecoveredTotals`, `recoveredByExpense`, `OpenSplit`, `remainingGross`, `outstandingOnExpense`, `PersonMatch`, `RefundPreviewBreakdown`, `SplitAllocationView`, `SplitView`, `RecoverySlice`, `SettledPersonInfo`, `LedgerPayment`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `LedgerRow`, `nameMatches`, `validateSplit`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P2 · maintainability]** 837 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.

### `src/lib/streakCalendarData.ts` — 48 lines · imported by 2 file(s)
- **[info]** Exported only for tests: `RemoteSavingsRow`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/toggleMotion.ts` — 101 lines · imported by 2 file(s)
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `PRESS_IN_SPRING`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `ToggleGeometry`, `DEFAULT_STRETCH_RATIO`, `TRAVEL_STRETCH_FACTOR`, `PRESS_STRETCH_FACTOR`, `ThumbLayout`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `MIN_THUMB_RATIO`, `PRESS_OUT_SPRING`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/transactionFunding.ts` — 167 lines · imported by 5 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `CalculateExpenseFundingParams`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/transactionUtils.ts` — 107 lines · imported by 33 file(s)
- **[P3 · surface]** Exported but only used inside this file: `TransactionClass`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `getTransactionClass`, `DEFAULT_INCOME_KEYWORDS`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/lib/transferRules.ts` — 30 lines · imported by 3 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/lib/vaultSpendingGuard.ts` — 98 lines · imported by 8 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `VaultLiquidityParams`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/lib/versionCheck.ts` — 176 lines · imported by 4 file(s)
- **[info]** Exported only for tests: `parseSemverParts`, `compareSemver`, `isVersionOutdated`, `shouldBlockForUpdate`, `evaluateVersionRequirement`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/lib/weeklyInsightsUtils.ts` — 646 lines · imported by 4 file(s)
- **[P3 · surface]** Exported but only used inside this file: `DaySpendingData`, `TakeawayEngineParams`, `LargestOutflowResult`, `WeekdayVsWeekendResult`, `DayMatchedComparisonResult`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `WeekInterval`, `computeWeeklySpend`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P2 · redundancy]** Copy-paste block: lines 180–201 duplicate src/lib/monthlyInsightsUtils.ts lines 279–300 (22 lines). Extract a shared helper/component.
- **[P2 · redundancy]** Copy-paste block: lines 213–233 duplicate src/lib/monthlyInsightsUtils.ts lines 327–347 (21 lines). Extract a shared helper/component.

### `src/lib/yearlyInsightsUtils.ts` — 860 lines · imported by 5 file(s)
- **[P3 · surface]** Exported but only used inside this file: `YearInterval`, `YearlyBudgetConfig`, `YearlyComparisonResult`, `YearlyCashFlowData`, `AnnualBudgetDisciplineResult`, `AnnualCapitalOutlierResult`, `AnnualCategoryTrajectoryResult`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `computeYearlySpend`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P2 · maintainability]** 860 lines. Split by responsibility (pure helpers → `src/lib`, sub-views → own memoised components, styles → `.styles.ts` as `ProfileScreen`/`SavingsScreen` already do). Pure move, no logic edits; existing tests must pass unchanged.


## Area: `src/features`

### `src/features/autoLog/background.ts` — 54 lines · imported by 2 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `AUTOLOG_BG_TASK`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/features/autoLog/copy.ts` — 74 lines · imported by 9 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `REVIEW_LABEL`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/features/autoLog/db.ts` — 399 lines · imported by 12 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `localDbExists`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `IgnoreRule`, `merchantKey`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `isWrongKeyError`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/features/autoLog/engine.ts` — 591 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P1 · dead code]** Exported but referenced nowhere (app or tests): `processNotification`. Remove (or remove the `export` if it is used inside).
- **[P3 · surface]** Exported but only used inside this file: `RawNotification`, `RawEmail`, `ProcessOptions`, `ProcessResult`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · type safety]** 7× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/features/autoLog/ledger.ts` — 192 lines · imported by 3 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `NewTransaction`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/features/autoLog/matching.ts` — 207 lines · imported by 9 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `SAME_MESSAGE_WINDOW_MS`, `Matchable`, `REFERENCE_WINDOW_MS`, `IdentityEvidence`, `merchantsAgree`, `IdentityDecision`, `TransferSide`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `isCrossSourceMatch`, `isOwnTransferPair`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/features/autoLog/notify.ts` — 86 lines · imported by 1 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[info]** Exported only for tests: `notifyPreview`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/features/autoLog/parser.ts` — 457 lines · imported by 4 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `senderCore`, `cleanMerchant`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `resolveBank`, `templateOf`, `parseNotification`, `resolveEmailSender`, `extractTxnTime`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.

### `src/features/autoLog/permissions.ts` — 71 lines · imported by 5 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `PermissionOutcome`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/features/autoLog/remote.ts` — 42 lines · imported by 3 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `RemoteProfile`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/features/autoLog/reviews.ts` — 248 lines · imported by 11 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `IgnoreScope`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[P3 · type safety]** 4× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/features/autoLog/rollout.ts` — 113 lines · imported by 3 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `RolloutAudience`, `AutoLogRollout`, `InstallCohort`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
- **[info]** Exported only for tests: `DEFAULT_ROLLOUT`, `parseRollout`, `cohortFromInstallTimes`. Keep (they are the unit-test seam); optionally mark `/** @internal test seam */`.
- **[P3 · type safety]** 1× `as any`. Replace with precise types (navigation params: `navigation.replace<'X'>`; transforms: `TransformsStyle['transform']`). No runtime change.

### `src/features/autoLog/service.ts` — 497 lines · imported by 16 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `LocalState`, `EntryDecision`, `EntryInfo`, `ScanProgress`, `syncRemoteAccounts`, `DevSimulation`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.

### `src/features/autoLog/store.ts` — 115 lines · imported by 13 file(s)
- ✅ No issue found by the checks (unused code, duplication, JS-thread animation, render-cost patterns, typing escapes, logging). Leave as is.

### `src/features/autoLog/types.ts` — 118 lines · imported by 14 file(s)
- ⚠️ **Money-logic file** — any refactor here is behind the canonical-rules gate: no change to a number, rounding, ordering or stored value; add/keep characterization tests before touching.
- **[P3 · surface]** Exported but only used inside this file: `EventSource`. Drop the `export` keyword (smaller public surface, lets the bundler/minifier inline). Zero behaviour change.
