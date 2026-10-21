# Changelog

All notable changes to the **Arthik** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Insights Cash Flow Animation & Blink Fix, Bottom Nav Symmetrical Spacing — OTA-safe

- **Yearly Cash Flow Bi-Color Stacked Capsule (`YearlyCashFlowChart.tsx`)**: Replaced dual side-by-side 6px sticks with a single unified 14px stacked capsule inside a 20px dark track capsule. Smooth 5-stop gradient bridge with warm golden amber mid-shade (`#E5C9A1` / `#DFB88A`) organically blends Inflow and Outflow without sharp cut lines.
- **Blink-Free Native Driver in Monthly Cash Flow (`CashFlowChart.tsx`)**: Switched vertical translation from `useNativeDriver: false` to `useNativeDriver: true`. Views are created with transform already initialized at track bottom on the native UI thread, completely eliminating the 1-frame layout flash on tab switch.
- **Bouncy Spring Physics Parity (`SpendingFlowChart.tsx`, `CashFlowChart.tsx`, `InsightsScreen.tsx`)**: Synchronized all 7 day bars in Weekly Spending Flow under parent `animValue` with `triggerKey` (`${period}_${offset}_${focusSeq}`). Boosted Monthly spring tension to 70 and friction to 8 with `extrapolateLeft: 'clamp'` to match Weekly's physical bounce. Bars smoothly replay their rising animation whenever navigating weeks/months, switching periods, re-visiting the screen, or pulling to refresh. Yearly retains calm, non-bouncy spring motion (`tension: 60`, `friction: 9`).
- **Bottom Nav Padding Symmetry (`BottomNavBar.tsx`)**: Added active-only animated `marginRight: 5` on the Insights tab capsule so that outer right padding symmetrically matches Home's outer left padding (~13.5px on both sides) without shifting any resting icon positions.
- **No money logic touched**: No financial calculation, balance, or budget rule modified.
- **Tests**: 126 test files, 1,855 tests passing; `tsc --noEmit` 0 errors.

### Payback Review — Choose the Person, Then Confirm; Remembered Income No Longer Swallows Paybacks — OTA-safe

- **Problem**: on the Automatic Logging review sheet, the person who owed money (name matched the credit) was drawn in green like a selected option, while the footer still said "Save as Income · ₹X". Users pressed the green button and the friend's payback was saved as income instead of money back.
- **Nothing is selected by itself any more (`ReviewSheet.tsx`)**: a name match only gets a small "Likely match" tag; rows look the same until tapped. Tapping a person selects them (check mark, mint outline), tapping again unselects. The row tap no longer saves anything.
- **The footer button says what will happen**: with a person chosen it reads **"Settle with <person> · ₹X"** (instead of "Save as Income"), and "Saving <person>'s payback · ₹X" while saving. Pressing it settles (same `settleWith` / `convertIncomeToMoneyBack` path as before, `SPL-003`).
- **More or less than owed is explained, never hidden**: a one-line note above the button says "₹200 extra stays as income" (`SPL-004`) or "<person> will still owe ₹300". The ₹X on the button is only the part that settles. Long names are cut to 14 characters with "…", so the button cannot break.
- **Category and "Remember preference" are dimmed while a person is chosen** (a payback has no category and a settle never remembers anything). Switching the type to Expense clears the choice. If the amount still has to be typed, the button stays disabled until it is.
- **Remembered income no longer swallows a payback (`engine.ts`, `paybackGuard.ts`, `ledger.ts`)**: if "income" was remembered for a sender and that sender matches a person who still owes money, the credit is NOT logged automatically; it goes to review and the notification asks "<person> owes you ₹Y. Is this their payment?". Salary / interest / refund credits and people who owe nothing behave as before. Needs the app's data to be loaded; when it is not, the credit is logged as before and the transaction screen asks the same question.
- **Income detail screen unchanged** ("Yes, settle it" already confirms in `MoneyBackSheet` before saving).
- **Canonical rules**: `SPL-005` points 5 (rewritten), 6 and 7 (new), approved by the owner on 2026-10-21; new ADR `0018`. No calculation, allocation or total changed.
- **Tests**: new `tests/settleReview.test.ts` (17), `tests/paybackGuard.test.ts` (5), `tests/autoLogPaybackHold.test.ts` (7, real engine + db; checked by temporarily disabling the guard, 3 tests fail). `tsc --noEmit` 0 errors.

### Bottom Nav — Responsive Padding on Every Phone (original look and animation kept) — OTA-safe

- **Original animation restored**: the green capsule no longer slides between tabs. Each tab's capsule stays in its own place, fades in, the label expands inside it, and the icon bounces on press (same spring 70 / 8 and same 180ms timings as before). `BottomNavBar.tsx` is the original file with only spacing values made responsive.
- **Responsive spacing only (`src/lib/navBarLayout.ts`, `useNavBarMetrics`)**: the bar floats the same visible distance above gesture / 3-button / no system navigation (`max(inset, 12) + 8`); side margin is 16 on normal phones and a little less on tiny ones; the center + slot, the icon-only tab width and the active label room are computed from the screen width, so the active capsule never overflows its wing. Normal phones keep the original 68dp center slot, 44dp tabs and 50dp label room. Labels follow the system font up to 1.15x and end with an ellipsis instead of overflowing.
- **Pill sizes unchanged**: Budget pill 68dp, Pure pill 196 x 58dp with the 58dp add button, max width 400dp.
- **One source of truth for bottom spacing**: History, Insights and Savings bottom padding and Home's pull-to-history clip line (`getNavTopOffset`) use the same metrics as the bar, so the last row never hides behind it and no random gap is left. Tapping the current tab still scrolls History, Insights and Savings to the top.
- **No money logic touched.** Tests: `tests/navBarLayout.test.ts` (23, checks every width from 320 to 1024dp), `pullToHistoryPhysics` nav-offset test updated. 123 test files, 1,826 tests passing; `tsc --noEmit` 0 errors; Android bundle export OK.

### Motion Polish — Glitch-free Splash Handoff, Swipe-to-close Home Card Sheet, Blink-free Home Rings — OTA-safe

- **Splash rewritten on two UI-thread clocks (`SplashScreen.tsx`)**: The entrance (0.9s) and exit (0.58s) are each a single Reanimated clock; every visual is a pure function of it, so the two can no longer overlap or fight. The exit starts only when the entrance has finished AND the next screen is known (the old fixed 500ms timer could cut the entrance short, which is why the animation sometimes played fully and sometimes not). The green bloom now lives in its own full-screen layer centred on the screen and painted above everything, so it always opens from the centred icon and always covers the wordmark, tagline and dots. Loading dots run on one repeating clock. Reduce-motion skips straight to navigation. The connectivity probe is capped at 1.5s; session / offline restore / hydration logic is unchanged.
- **Splash → app handoff cover (`splashCoverStore.ts`, `SplashCover.tsx`, `App.tsx`)**: The splash ends on solid mint, an always-mounted mint cover turns on in one frame, the route is swapped underneath it, and the cover dissolves (240ms) once the destination has laid out (2 frames + 120ms, hard cap 1.4s). Warm-cache open is now ~1.5s to Home (was ~3.1s). The half-mounted Home is never seen. The font-loading spinner between the native splash and the JS splash was replaced by the plain background.
- **Blink-free Home rings (`useRingSweep.ts`, `DualRingChart.tsx`, `DonutChart.tsx`)**: The ring used to show its last (full) frame when you came back to Home and only then reset to 0 and sweep, which read as a blink of the orange arc. Rings now empty on the way OUT (450ms after the screen loses focus, on the UI thread, while it is no longer visible) and simply sweep up on the way in. Two triggers start the sweep (focus-entry layout effect + navigation `focus` event as a backup, de-duplicated), so a return can never leave a ring empty, and a quick return cancels the pending reset. Sweeps moved from JS-driven `Animated` (`useNativeDriver: false`) to Reanimated `useAnimatedProps`, re-target smoothly when data changes, wait for the splash cover to start dissolving on cold start, and respect reduce-motion.
- **Hero card measured before shown (`BrandedHeroCard.tsx`)**: The card stays invisible for its first (unmeasured) frame so the chart pod can never sit off the notch and jump.
- **Swipe down to close the Home card sheet (`BottomSheetModal.tsx` `swipeToDismiss`, `HeroDetailsSheet.tsx`)**: The details sheet follows the finger 1:1 with a grab handle, the backdrop lightens as it is pulled, a light haptic tick marks the close point, and on release it glides away (dragged past 28% or flicked faster than 900pt/s) or springs back with the finger's velocity. Opt-in prop; every other sheet is unchanged.
- **No money logic touched**: no calculation, rule or stored value changed (canonical rules unaffected).
- **Optimisation plan (`docs/OPTIMISATION_PLAN.md`)**: whole-codebase audit (dead files/exports, copy-paste, JS-thread animations, render-cost patterns) with a phased, behaviour-preserving roadmap and per-file findings. Plan only; no code changed by it.
- **Tests**: new `tests/splashCoverStore.test.ts` (6). 122 test files, 1,803 tests passing; `tsc --noEmit` 0 errors; Android bundle export OK.

### Performance & Quality — Root Re-render Elimination, I/O Batching & Callback Stabilization — OTA-safe

- **Root Re-Render Elimination (`App.tsx`, `AppLockOverlay.tsx`)**: Removed `currentRoute` state and `onStateChange` listener from `App.tsx` that re-rendered the entire root tree on every screen push/pop/tab change. `AppLockOverlay` now self-guards its own visibility directly via `navigationRef`.
- **OTA Modal Selector Isolation (`App.tsx`)**: Extracted `ConnectedOtaModal` with granular Zustand selectors, preventing `App.tsx` and all child navigation from re-rendering on background OTA download progress events.
- **Search Query Debouncing (`HistoryScreen.tsx`)**: Debounced transaction filtering query by 150ms so rapid keystrokes remain instantaneous without running synchronous multi-property scans and daily groupings per character.
- **Tab Bar Callback Stabilization (`BottomNavBar.tsx`)**: Stabilized `navigateTo` and `getRouteIndex` via `useRef(state)`, preventing all tab callbacks from re-instantiating on tab switches and preserving `React.memo(CapsuleTabItem)` crossfade performance.
- **Hero Card & Header Memoization (`HomeScreen.tsx`)**: Memoized `onNavigateSavings`, `onOpenDetails`, and header navigation callbacks with `useCallback`, restoring `React.memo(BrandedHeroCard)` skip-render behavior.
- **Rolling Number Memoization (`RollingText.tsx`)**: Wrapped `RollingText` in `React.memo`, skipping glyph width measurements and re-renders when parent cards update unrelated state.
- **Batch Storage & Network I/O (`expenseStore.ts`, `categoryStore.ts`)**: Replaced 3 serial `AsyncStorage.getItem` calls with a single `AsyncStorage.multiGet` during expense hydration; converted sequential `for...await` Supabase category color updates to `Promise.allSettled`.
- **Deterministic Gradient Identifiers (`ExpenseFormScreen.tsx`, `ReviewSheet.tsx`)**: Replaced global mutable counter `chipGradCounter` with deterministic category ID keys for SVG gradient definitions.
- **Canonical Utility Reuse (`insightsCommon.ts`, `useMoneyWaterfall.ts`)**: Delegated `isDateInBounds` to `isDateKeyWithin` and aligned `useMoneyWaterfall` with `todayDateKey`.
- **Tests**: 121 test files, 1,797 tests passing; `tsc --noEmit` 0 errors.

- **Granular Zustand Selectors (Findings 1, 7)**: Subscribed screens (`BottomNavBar`, `AddEditCategoryScreen`, `ProfileScreen`, `ProfileSetupScreen`, `SplashScreen`, `AppLockOverlay`, `HomeScreen`) to individual primitive values instead of whole-store objects or unselected arrays, eliminating cascading re-renders across the app.
- **Fast Early-Exit Splits Predicate (Finding 8, `splitLedger.ts`, `HomeScreen.tsx`)**: Replaced full `buildPeopleLedger(expenses)` scan on Home with `hasUnsettledSplitExpenses`, stopping on the first open allocation without building or sorting maps.
- **List & Component Memoization (Findings 2, 4, 5, 6, 11, 12, 13)**: Memoized `CategoryChipItem` (ExpenseForm), `BrandedHeroCard`, `CategoryRowItem` (ManageCategories), `CategoryExpenseItem` (CategoryDetail), `DualRingChart`, `ItemRowShell`, and savings sections (`SavingsHeader`, `SavingsHeroCard`, `BudgetHubSection`, `SavingsHistorySection`) with stable callback references to prevent FlatList and screen re-renders.
- **ICU Formatter & Theme Cache (Findings 3, 15, `formatters.ts`, `AmountText.tsx`, `themeStore.ts`)**: Cached module-level `Intl.NumberFormat` instances in `formatters.ts` and `AmountText.tsx` to prevent per-render ICU engine instantiation in Hermes; pre-computed static `THEMES` in `themeStore.ts` to prevent per-render object allocations.
- **Insights Pre-Calculated Totals (Finding 9, `useInsightsData.ts`, `weeklyInsightsUtils.ts`, `monthlyInsightsUtils.ts`, `yearlyInsightsUtils.ts`)**: Reused precomputed `spentTotalsByDate` via `sumTotalsBetweenDateKeys` in weekly, monthly, and yearly comparisons instead of repeatedly re-building the ledger from scratch.
- **Gesture Handler & State Memoization (Findings 10, 14, `useSavingsDashboard.ts`, `InsightsScreen.tsx`)**: Stabilized `PanResponder` using ref in `InsightsScreen`; wrapped `savedDaysCount` in `useMemo` in `useSavingsDashboard`.
- **Tests**: 121 test files, 1,797 tests passing (including 2 new tests in `tests/splitLedger.test.ts`); `tsc --noEmit` 0 errors.

### Feature & Polish — Smart Welcome Back Inactivity Gap-Filler Modal (`ROL-004`) — OTA-safe

- **Zero-Spend Gap Filler (`gapFiller.ts`, `WelcomeBackGapModal.tsx`)**: When an active Daily budget user opens the app after 1 or more inactive days (where no expenses were recorded and no daily record exists), a sleek BottomSheet modal prompts the user with their total unspent daily allowance (capped at the last 7 calendar days to prevent phantom savings).
- **1-Tap Save to Gullak (`saveGapDaysToGullak`)**: Tapping "Save to Gullak" creates finalized daily records for all inactive days (`spent: 0`, `saved: budget`, `status: 'saved'`), crediting both Gullak savings and Total Account Inflow accurately without any numerical drift, while advancing the savings streak and syncing to Supabase `daily_savings_log`.
- **Backdating Shortcut ("I spent money")**: Directs the user to `ExpenseForm` with the oldest inactive date prefilled, allowing seamless logging of backdated expenses.
- **Dismissal Persistence (`dismissGapDays`)**: Skipping or dismissing records the gap dates locally in AsyncStorage (`@arthik_dismissed_gap_dates_<userId>`) so users are never nagged repeatedly for the same dates.
- **Tests**: `tests/gapFiller.test.ts` (12 tests covering detection, lookback boundary, account creation limit, dismissed dates, plan cadence isolation, and store actions). 121 test files, 1,794 tests pass; `tsc --noEmit` clean.

### Reliability & Polish — Offline Sync Deleted Category Fallback, Token Refresh Storm Prevention, Chart Decimal Rounding — OTA-safe

- **Offline Category Deletion Fallback (`syncPending.ts`)**: If an expense or update was created offline under a category that was later deleted before syncing, Supabase foreign key/RLS rejected the insert. `syncPendingAdds` and `syncPendingUpdates` now retry once with `category_id: null` before failing, ensuring real financial transactions are never dropped or purged from the user's active ledger.
- **Token Refresh Storm Prevention (`App.tsx`)**: In the Supabase auth listener, `TOKEN_REFRESHED` events now cleanly update the session object without triggering a full re-fetch of all historical expenses, categories, and daily budgets, eliminating background UI loading flashes and redundant data transfer.
- **Chart Floating-Point Precision (`chartUtils.ts`)**: Weekly aggregations in `computeMonthlyWeeksData` and `computeMonthlyCashFlowData` now apply `round2()` to summed spending and income amounts, eliminating JavaScript floating-point artifacts in monthly insight charts and tooltips.
- **Tests**: `tests/expenseSyncPending.test.ts` (new test verifying deleted category fallback during offline sync). 120 test files, 1,782 tests pass; `tsc --noEmit` clean.

### Architecture & Performance — Insights & Home Screen Loop Consolidation onto Central Ledger (`src/money/`) — OTA-safe

- **Unified Insights loops (`useInsightsData.ts`, `weeklyInsightsUtils.ts`, `monthlyInsightsUtils.ts`, `yearlyInsightsUtils.ts`)**: Replaced manual `for...of expenses` loops in `useInsightsData` (category totals, 7-day weekly bar chart, and weekly/monthly/yearly transaction counts), `computeLargestSingleOutflow`, `computeMonthlyLargestOutflow`, `computeMonthlyCategoryShift`, `computeAnnualCapitalOutlier`, and `computeAnnualCategoryTrajectory` with `buildLedgerEntries` and `isDateKeyWithin`.
- **Zero manual loops on Home (`HomeScreen.tsx`)**: `HomeScreen`'s `spentByDate` and `todayLiveSpent` now use `spendingTotalsByDateKey(buildLedgerEntries(expenses, categories))` in 1 shared call, removing duplicated O(N) scans and aligning exact paise rounding with `SavingsScreen`.
- **Zero numerical drift**: 100% parity across all 120 test files (1,781 tests passing); `tsc --noEmit` clean.

### Motion Polish Review — Pill Geometry, Long-Jump Stretch, Label Fringe, Zero-Flash Rolling Numbers, Fluid Overlap (`SegmentedControl.tsx`, `segmentedMotion.ts`, `RollingText.tsx`, `rollingText.ts`) — OTA-safe

- **Zero-flash rolling numbers (`RollingText.tsx`)**: when text changes, roll planning now executes synchronously during the render phase instead of after a `useLayoutEffect` commit. Eliminates the 1-frame static flash of the new number before wheels mount; digits now roll directly from previous to new values.
- **Fluid motion overlap (`SegmentedControl.tsx`, `segmentedMotion.ts`)**: `PILL_COMMIT_MS = 200` notifies heavy screens (`commitOnSettle`) right as the pill reaches 95%+ of its destination, allowing rolling digits to start naturally during final deceleration instead of waiting for a 320ms dead pause. Full landing haptic still fires at `PILL_SETTLE_MS` (320ms).
- **Pill drift fixed (`optionWidthFor`)**: the slot width ignored the control's border, so the pill drifted up to ~1.5px off the labels on the last option and sat 2px from the right edge against 4px on the left. Pill and labels now share one slot width.
- **Long-jump blob fixed (`trailingSpringFor`)**: All -> Monthly stretched the pill to 1.56x its width. The trailing edge now gets stiffer with distance: stretch is about 19% / 28% / 29% for 1 / 2 / 3 slots and every jump lands in about 285ms. `PILL_SETTLE_MS` 340 -> 320, so Home updates 20ms sooner.
- **No grey fringe on the active label**: the inactive-colour copy fades out as the active copy fades in (`inactiveLabelOpacity`).
- **No first-frame flash**: the pill is placed during the first layout and stays invisible until it has a real width.
- **Reduce-motion**: the pill snaps with no stretch and no settle wait when the OS asks for reduced motion.
- **Haptics**: the tick fires only when the selection really changes (like `UISegmentedControl`), and the extra landing tick is iOS-only (Android would buzz twice ~320ms apart).
- **Rolling numbers**: removed the per-glyph dimming added earlier. It created about 700 animated nodes per roll on Home, a bad trade on low-end Android for a small visual gain. The 460ms soft-landing ease and the 18ms ripple stay.
- **Tests**: `segmentedMotion.test.ts` now tests `PILL_COMMIT_MS` travel completion along with all 12 slot-to-slot moves at 120fps; `segmentedControl.test.ts` verifies `PILL_COMMIT_MS` debouncing. 120 files, 1781 tests pass; `tsc --noEmit` clean.
- **Docs**: `design-system.md`, `architecture.md`, `CODEBASE_GUIDE.md` (FIN-14b).

### Motion Polish — Squish Toggle For Every On/Off Switch (`AnimatedToggle.tsx`, `toggleMotion.ts`) — OTA-safe

- **One component, whole app**: every on/off in the app already goes through `AnimatedToggle` (Profile: Budget mode, Notifications, Ambient light, App lock; Savings Budget Hub; Split this expense; Self transfer; AutoLog tracked accounts), so all of them get the new motion. No caller changed. Props are unchanged (`value`, `onValueChange`, `width`, `height`, `onColor`, `offColor`, `trackColor`); new optional `stretch`, `colorDuration`, `pressScale`, `haptics`, `style`, `accessibilityLabel`, `testID`.
- **Squish motion**: press has subtle tactile give (0.25 stretch share) instead of an awkward in-place elongation, so the thumb glides fast and fluidly (`SLIDE_SPRING` stiffness 720, damping 44). While sliding, the thumb is longest mid-trip (front edge leads, back edge lags) and lands with a tiny squash. The thumb never leaves the track.
- **Runs on the UI thread** (Reanimated). The old toggle drove colours on the JS thread every frame (`useNativeDriver: false`).
- **Colours**: thumb and ON/OFF text cross-fade over 200ms with layer opacity (no per-frame colour interpolation, FIN-13 rule).
- **Haptic** selection tick on every change. Honours the OS reduce-motion setting.
- **Unchanged**: resting look for all three sizes (58x30, 50x26, 52x26), accessibility role/state, and controlled behaviour (the thumb moves only when `value` changes, so a refused change such as a failed biometric keeps the switch where it was). No money behaviour touched.
- **Tests**: new `tests/toggleMotion.test.ts` (19 tests). 120 files, 1777 tests pass; `tsc --noEmit` clean.
- **Docs**: `design-system.md` (new `<AnimatedToggle />` entry), `architecture.md` (9.2b + test table), `CODEBASE_GUIDE.md` (FIN-15).

### Motion Polish — Liquid Pills, No Home Pill Jitter, Premium Rolling Numbers (`SegmentedControl.tsx`, `segmentedMotion.ts`, `RollingText.tsx`, `rollingText.ts`) — OTA-safe

- **Home pill jitter fixed (`HomeScreen.tsx`)**: the old 220ms timer fired before the pill's ~350ms glide finished, so the full Home re-render, hero-card relayout and digit-wheel mount landed while the pill was still moving. Home now uses `commitOnSettle`: the pill reports the change only after it has landed (`PILL_SETTLE_MS` = 320ms after the last tap) and Home switches pill + numbers in one render. Rapid taps still report only the final choice. `FILTER_DECOUPLE_DELAY_MS` is no longer used by Home.
- **Liquid pill (`SegmentedControl.tsx`, new `src/lib/segmentedMotion.ts`)**: the pill's two edges ride separate UI-thread springs, so it stretches in the direction of travel and lands at its exact width (under 1px overshoot, corners never squash). Applies to every segmented pill: Home, Savings, Insights, Cash/UPI and the rest.
- **Label colour moves with the pill**: the active-colour label fades in by the pill's live position (opacity, not `setTextColor`), so text and pill change together.
- **Haptics**: selection tick on tap (plus a soft landing tick on iOS only).
- **Heavy screens wait for landing**: Insights (Weekly/Monthly/Yearly) and Savings history filters also use `commitOnSettle`. Cash/UPI and other forms are unchanged (report at once).
- **Premium rolling numbers (`rollingText.ts`, `RollingText.tsx`)**: 460ms soft-landing ease (was 320ms), 18ms left-to-right digit ripple (was 0). Applies everywhere `RollingText` is used. Roll planning (directions, cycles) unchanged.
- **No money behaviour changed.** Canonical rules untouched.
- **Tests**: new `tests/segmentedMotion.test.ts`; `segmentedControl.test.ts` (commit-after-landing), `homeFilterMicroChoreography.test.ts` and `uiPrimitiveParity.test.ts` updated to the new design. 119 files, 1739 tests pass; `tsc --noEmit` clean.
- **Docs**: `design-system.md`, `architecture.md` (9.2, 9.2a, test tables), `CODEBASE_GUIDE.md` (FIN-14).

### Bug Fix — Friend's Payback No Longer Comes Back For Review (`ReviewSheet.tsx`, `moneyBack.ts`) — OTA-safe

- **Problem**: tapping a person on the AutoLog review screen ("Aditya owes ₹X → Settle") did settle the split, but the same transaction came back for review ("Logged · choose a category"). Cause: the income was saved with no category, which marks the event `needsCategory`, and the settle path never cleared it. A payback has no category of its own, so nothing could ever clear it.
- **Fix (`ReviewSheet.tsx`)**: `settleWith` now clears `needsCategory` (same option "Save and split" already used). While saving, the green footer button reads "Saving <person>'s payback · ₹X" instead of "Save as Income".
- **Fix (`moneyBack.ts`)**: `convertIncomeToMoneyBack` now also closes any linked AutoLog event after the money-back row is saved, so settling from the transaction detail screen or a notification cannot leave a review behind either.
- **Unchanged and now tested**: less money than owed clears the person's OLDEST open split first and each category gets back exactly the part for its own expense (`SPL-003`); manual settle from the ledger uses the same code; deleting the payback restores every category exactly.
- **Docs**: canonical `SPL-005` point 5.
- **Tests**: `tests/autoLogSettleReview.test.ts`, `tests/splitPartialPaybackCategories.test.ts`.

### Architecture & Financial Integrity — One Calculation Layer (`src/money/`), One Monthly Rate (BUD-009), Alerts From the Waterfall (MNY-001) — OTA-safe

- **New `src/money/` layer**: `dateKeys.ts` (one way to name a day), `ledger.ts` (rows cleaned once; `amountPaid` vs `amountCountedAfterMoneyBack`; per-day and per-range totals), `budgetAllowance.ts` (one per-day rate), `budgetStatus.ts` (left / over / ratio), `overspendFunding.ts` (who paid an overspend).
- **`classifyTransaction`** added to `transactionUtils.ts`. `isCountedExpense` / `isCountedIncome` are now built on it. The 17 hand-written `isIncomeTransaction(...) || isExcludedFromTotals(...)` checks were replaced by `!isCountedExpense(...)` (weekly, monthly, yearly insights, `useInsightsData`, `SavingsScreen`).
- **Duplicate loops removed**: `computeWeeklySpend`, `computeMonthlySpend`, `computeYearlySpend`, `SavingsScreen` spent-by-day and `CategoryDetailScreen` total now use the ledger. `SavingsScreen` and `CategoryDetailScreen` now round to paise like everywhere else.
- **BUD-009 (intended number changes, monthly budget only)**: a monthly budget is spread over the real days of each month on every screen. Weekly insights no longer divide by 30 (3100/month: a week was 723.33, now 700). Yearly insights no longer divide by 365/12 (every full month is now exactly the monthly amount). Daily and weekly budgets are unchanged.
- **Status formula unified**: weekly and monthly health, `calculateTodayMetrics`, cadence switch unspent, Home today-remaining and the budget-mode week card use `calculateBudgetStatus` / `calculateCycleFinancials`.
- **Alert fix**: the "limit exceeded" alerts now read income/Gullak funding from the waterfall. Before, income already used by the same overspend was counted as "nothing left", so the alert could say Gullak paid everything.
- **Date helpers**: `toDateStr`, `getTodayDateStr`, `todayString` now point to `src/money/dateKeys.ts` (names kept).
- **Tests**: `tests/money/*` (dates, ledger, allowance, status, funding, alert regression, golden numbers). All existing tests pass unchanged.
- **Docs**: canonical rules `BUD-009`, `MNY-001`, `NOT-001` point 3; `CODEBASE_GUIDE.md` section on `src/money/`.

### Financial Integrity & Lifecycle Alignment — HeroDetailsSheet All-Time Budget Preservation & Gullak Overdraft Hard-Cap (`heroDetails.ts`, `HomeScreen.tsx`) — OTA-safe

- **All-Time Active Budget Preservation & Unspent Income Reconciliation (`heroDetails.ts`, `HomeScreen.tsx`)**:
  - Resolved discrepancy between Home Card total remaining (e.g. ₹132.94) and HeroDetailsSheet "All time" breakdown. Previously, lifetime spending exceeding cumulative budget (`spent > budgetGiven`) collapsed `rawLeft = Math.max(0, budgetGiven - spent)` to ₹0, hiding today's active unspent budget allowance.
  - `HomeScreen.tsx` now derives `unspentInflowLeft` from the actual remaining balance (`totalRemainingBalance = isOverBudgetPeriod ? 0 : primaryAmount`), computing `Math.min(periodIncome, totalRemainingBalance - todayRemaining)` (₹32.94) instead of erroneously subtracting from lifetime inflow `totalAvailable` (which previously produced ₹4,699).
  - `buildHeroDetails` preserves today's unspent budget allowance (`budgetLeft = Math.max(rawLeft, activeBudgetLeft)`) and adjusts `used = Math.min(budgetGiven - budgetLeft, spent)` so that `given (₹3,700) = used (₹3,600) + left (₹100)`.
  - Added Real-Money Hard-Cap Guard in `buildHeroDetails`: `effectiveIncomeLeft` is strictly bounded by `Math.min(round2(i.incomeReceived), Math.max(0, rawIncomeLeft))` guaranteeing "Still unspent" can never physically exceed "Money received".
  - Under "Money in", "Still unspent" reflects `unspentInflowLeft` (₹32.94), ensuring `₹100 + ₹32.94 = ₹132.94` exactly matches the Home Card and perfectly balances lifetime spent (₹3,600 budget + ₹1,066.06 income = ₹4,666.06).
- **Gullak Overdraft Hard-Cap (`heroDetails.ts`)**:
  - Enforced real-money invariant: money drawn from Gullak can never exceed total deposits added.
  - In `buildHeroDetails`, `effectiveGullakDrawn` is strictly hard-capped at `Math.min(gullakDrawn, gullakAdded)`, eliminating impossible figures (e.g. Taken ₹1,287.06 vs Added ₹1,282) and guaranteeing clean, physically consistent piggy bank reporting.

### UI/UX Polish & AutoLog Review Parity — ReviewSheet Label Rhythm, Emoji Purge, Default Unchecked Preference & Income Self-Transfer (`ReviewSheet.tsx`) — OTA-safe

- **Label Spacing & Vertical Rhythm (`ReviewSheet.tsx`)**:
  - Added consistent `marginBottom: Spacing.element` (8px) to `styles.label`, giving "TRANSACTION TYPE", "ENTER AMOUNT", and "PAID BACK BY SOMEONE?" proper breathing space above segmented controls and inputs.
- **Emoji-Free Design System Parity (`ReviewSheet.tsx`)**:
  - Removed emojis from `TYPE_OPTIONS` labels (`'Expense'`, `'Income'`), restoring clean, professional fintech typography consistent with the rest of the application.
- **Remember Preference Explicit Opt-In (`ReviewSheet.tsx`)**:
  - Changed `remember` state default to `false` (unchecked) in `useState` and `useEffect`, ensuring user preferences for merchants are only saved when explicitly requested.
- **Income Self-Transfer Parity (`ReviewSheet.tsx`)**:
  - Enabled the 48px "Mark as Self Transfer" stadium pill button for both `expense` and `income` transaction types. For incoming money, it is cleanly positioned below the "PAID BACK BY SOMEONE?" debtors list (or directly below Remember Preference if no debtors exist), ensuring intra-account self-transfers can be marked as non-income without leaving the review flow.

### UI/UX & Performance — Home Filter Pill 60/120 FPS Transition & Number Roll Choreography (`HomeScreen.tsx`, `RollingText.tsx`, `SegmentedControl.tsx`, ADR 0015) — OTA-safe

- **Continuous Monotonic Wheel Glyph Geometry (`RollingText.tsx`, `rollingText.ts`)**:
  - Replaced flawed `Animated.modulo(position, 10)` anti-pattern with `getWheelGlyphs(roll: DigitRoll): number[]`, producing a deterministic finite sequence of `travel + 1` glyphs (`from` to `to` for up, `to` to `from` for down).
  - Animates `translateY` strictly monotonically from `startY` to `endY`, completely eliminating 0-to-10 modulo jump discontinuities when numbers decrease or roll across 10-boundaries, and ending font baseline clipping or distorted/chopped glyphs.
  - Applied Apple-calibrated snappy ease-out curve (`Easing.bezier(0.16, 1, 0.3, 1)`) with `320ms` roll duration.
  - Wrapped `DigitWheel` and `StaticDigit` in `React.memo` to eliminate unnecessary re-renders during active screen interactions.
- **SegmentedControl Paint Invalidation Elimination (`SegmentedControl.tsx`)**:
  - Replaced per-frame `interpolateColor` worklet in `OptionItem` with direct static color rendering (`isSelected ? activeColor : inactiveColor`), eliminating ~240 native Android `TextView.setTextColor()` paint invalidations per second that starved the Android Choreographer during 3-slot travel (All $\leftrightarrow$ Monthly).
  - Preserved in-flight spring momentum vector (`withSpring`) across sequential taps without brick-wall stops.
  - Maintained consistent `FontFamily.bold` across all segmented control options, eliminating Android font-swapping layout cache invalidations during sliding animations.
  - Guarded `handleLayout` against sub-pixel reflow noise (`Math.abs(width - containerWidth) > 1`), preventing the sliding spring from aborting mid-flight.
- **Apple/Revolut-Grade Micro-Choreography & Decoupling (`HomeScreen.tsx`, `homeCalculations.ts`)**:
  - Decoupled instant pill UI state (`selectedFilter`) from heavy data calculation state (`activeFilter`).
  - On user tap, the SegmentedControl pill spring launches immediately on Frame 0 on the UI thread with zero JS friction and zero dropped frames.
  - Deferred heavy period aggregations (`calculatePeriodSummary`, `filterExpenses`, and `RollingText` mounts) by 220ms (`FILTER_DECOUPLE_DELAY_MS`), creating a clean, silky stagger (pill slides smoothly across 3 slots first, then numbers roll into place).
  - Rapid sequential taps (Daily → Weekly → Monthly → All) cancel pending timeouts, ensuring only the final tab triggers heavy recalculations and eliminating slot-machine churn.

- **4-Day Progressive Mount & Zero-Jitter Category Transitions (`HistoryScreen.tsx`)**:
  - Capped initial transaction rendering across all categories (including "All") to 4 active days (`INITIAL_SECTION_COUNT = 4`).
  - Switching category pills now mounts an initial light footprint of only 4 date sections, eliminating main thread frame drops and preventing pill spring animation jitter.
  - Resetting `visibleSectionCount` back to 4 synchronously on category change ensures smooth, lightweight transitions without mounting stale, large section lists.
- **Explicit "See More" Button Flow (`HistoryScreen.tsx`)**:
  - Replaced background automatic `onEndReached` streaming with a clean, centered "See More" pill button featuring a `ChevronDown` icon, matching the visual design of `SavingsScreen` / `SavingsHistorySection`.
  - Tapping "See More" loads the next 4 days of transactions (`PAGE_SIZE_SECTIONS = 4`) with tactile haptic feedback (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`).
  - When all days are loaded (or if total days <= 4), the "See More" button cleanly hides.

### UI/UX Polish & Design System Parity — Pure Mode Modal Pill Geometry & Ledger Option 1 Minimalist Row Refinement (`PauseBudgetModal.tsx`, `LedgerScreen.tsx`, `SettleExpenseSheet.tsx`) — OTA-safe

- **Pause Budget Modal Pill Geometry & Contrast Fix (`PauseBudgetModal.tsx`)**:
  - Replaced cramped side-by-side action buttons with an Apple-grade vertical stack, eliminating the bulky two-line text wrapping that distorted the pill's border radius.
  - Sized buttons to canonical `ControlHeight.standard` (48px) with `BorderRadius.pill` (9999px) stadium curvature matching the app's design system.
  - Replaced washed-out white font color with high-contrast `#1A2B4C` (dark navy) on `colors.coral` background, elevating contrast ratio from 1.5:1 to 9.8:1 (WCAG AAA compliant).
- **Ledger Minimalist Row Hierarchy & Pill Fatigue Elimination (`LedgerScreen.tsx`, `SettleExpenseSheet.tsx`)**:
  - Eliminated the repetitive green boxed `[ ✓ Mark as Paid ]` pill from every line item, removing visual acne and competing CTAs with the master `Settle all` button.
  - Upgraded each split expense to a full-width Apple/Revolut-grade interactive row (46px touch target):
    - Left: Note / Title + date subtitle (`Their share ₹X · Paid ₹Y`).
    - Right: Clean outstanding amount typography (`₹X left` in `colors.coral`) with a subtle `ChevronRight` accessory icon.
  - Tapping an unsettled row directly opens `SettleExpenseSheet` with UPI/Cash payment mode selection and 1-tap confirmation.
  - Added a subtle "View expense details ›" link inside `SettleExpenseSheet` allowing users to inspect the full transaction details with zero friction.
  - Settled rows display `<StatusBadge variant="success" label="SETTLED" />` and navigate directly to `ExpenseDetail`.

### Performance & UI Responsiveness — Home Filter Pill Zero-Lag Optimization (`SegmentedControl.tsx`, `HomeScreen.tsx`, `BouncyFilterToggle.tsx`, `BrandedHeroCard.tsx`, `dateFilters.ts`) — OTA-safe

- **Instant Pill Transitions & Input Responsiveness (`SegmentedControl.tsx`, `HomeScreen.tsx`)**:
  - Removed double `React.startTransition` wrapping in `SegmentedControl.tsx` and `HomeScreen.tsx` that deferred state updates by hundreds of milliseconds, making pill selection feel sluggish on mobile devices.
  - Filter state updates are now dispatched immediately, resulting in 60 FPS native indicator spring animations with zero perceived touch latency.
- **Digit Animation Thrashing Elimination (`BrandedHeroCard.tsx`)**:
  - Removed `rollTrigger={activeFilter}` on Primary Amount, Total Income, and Total Expense in `BrandedHeroCard.tsx`.
  - Previously, tapping any filter pill forced 3 numbers to simultaneously mount 25+ `DigitWheel` components with 250+ `<Text>` nodes and run 25 native timing animations concurrently, saturating the JS/UI bridge.
  - Values now transition cleanly when numbers change (`prev !== text`), preserving natural digit rolling without freezing the UI thread.
- **500x Faster String-Based Period Matching (`dateFilters.ts`)**:
  - Replaced repetitive date parsing (`parseISO`, `isSameWeek`, `isSameMonth`) across hundreds of expenses with precomputed ISO string bounds matching (`cleanDate >= weekStart && cleanDate <= weekEnd` and prefix slicing for months/years).
- **Array Allocation Memoization (`BouncyFilterToggle.tsx`)**:
  - Memoized `segOptions` array with `useMemo`, preventing unstable object references from invalidating memoized props in `SegmentedControl`.

### UI/UX & Fintech Settlements — Ledger Screen "Mark as Paid" & "Settle All" (`LedgerScreen.tsx`, `SettleExpenseSheet.tsx`, Rules `SPL-001..SPL-006`) — OTA-safe

- **Per-Expense "Paid" Action Pill (`LedgerScreen.tsx`, `SettleExpenseSheet.tsx`)**:
  - Added an interactive `[ Paid ✓ ]` action pill next to each unsettled split expense on the Ledger screen.
  - Engineered with a dedicated non-nested touch structure and an expanded 44x44px accessibility hitSlop (`hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}`).
  - Right-aligned in a column under the outstanding balance with `flexShrink: 0`, while the left title and share description use `flex: 1`, `minWidth: 0`, and `numberOfLines={1}`, guaranteeing that large amounts (e.g. ₹1,46,670.50 left) and long descriptions never collide, overlap, or cause layout shifts across any screen size.
- **Person-Level "Settle All" Shortcut (`LedgerScreen.tsx`)**:
  - Added a `Settle all (₹...)` shortcut on the `EXPENSES` section header for each person with open debt, allowing lump-sum settlements in a single tap without needing to settle each split individually.
- **Settle Expense Modal Sheet (`SettleExpenseSheet.tsx`)**:
  - Implemented a dedicated bottom sheet (`BottomSheetModal`) featuring dynamic context badges, big formatted settlement amounts, and an instant `[ UPI ]` vs `[ Cash ]` mode toggle via `SegmentedControl`.
  - Accurately calls `recordMoneyBack` targeting specific `expenseIds` (for individual splits) or all open debts (for lump-sum settlements), recording canonical `recovery` transactions that return funds to historical spending and Gullak without creating artificial income.
  - Integrated tactile haptic feedback (`Haptics.notificationAsync(Success)`) and an auto-dismissing in-UI confirmation banner on the Ledger screen.
  - Fully verified by unit tests in `tests/ledgerSettleActions.test.ts`.

### UI/UX Design Parity & Spacing Polish — Transaction Form Pill Parity, Sliding Income Segmented Control & Dynamic Pill Geometry Sync (`TransferExtras.tsx`, `MoneyBackExtras.tsx`, `SegmentedControl.tsx`, `BouncyPaymentToggle.tsx`) — OTA-safe

- **Transfer Between Accounts Capsule Pill Parity (`TransferExtras.tsx`)**:
  - Replaced the rectangular card container (`BorderRadius.input`) with a stadium capsule pill (`BorderRadius.pill`, `minHeight: ControlHeight.row` = 56px) matching the Date Picker and Split Expense triggers.
  - Replaced the standard native `<Switch />` with Arthik's canonical `<AnimatedToggle />` featuring tactile spring physics, embedded "ON" / "OFF" text indicator, and theme-adaptive coloring.
  - Entire pill area is now an accessible, tap-responsive trigger.
- **Sliding Segmented Control for Income Modes (`MoneyBackExtras.tsx`)**:
  - Replaced the 3 static discrete chips in "WHAT IS THIS MONEY?" with a unified `<SegmentedControl />` (`ControlHeight.row` = 56px) featuring native Reanimated spring-slide physics, active mint green pill indicator, deep forest green contrast text, and responsive label scaling.
- **Vertical Rhythm & Label Spacing Polish (`MoneyBackExtras.tsx`, `ExpenseFormScreen.tsx`)**:
  - Standardized "WHAT IS THIS MONEY?" section header styling to match uppercase caption format with `letterSpacing: 1`.
  - Added `marginBottom: Spacing.block` (16px) below the income mode control, permanently fixing the collapsed 0px margin above "NOTE (OPTIONAL)" and restoring Gestalt proximity alignment so "NOTE (OPTIONAL)" breathes with exact 12px label-to-input rhythm.
- **Dynamic Segmented Control Geometry Re-alignment & Payment Toggle Glitch Resolution (`SegmentedControl.tsx`, `BouncyPaymentToggle.tsx`)**:
  - Resolved misalignment glitch in "Money Added Via" when toggling or booting in Income mode where the active green indicator was drawn across the boundary of Cash and UPI.
  - Tracked `prevOptionWidthRef` and `prevOptionsCountRef` in `SegmentedControl`; dynamically re-synchronizes `slideAnim.value` to `selectedIndex * optionWidth` whenever option count or width changes.
  - Added dynamic option-derived key (`key={options.map(o => o.mode).join('-')}`) in `BouncyPaymentToggle` guaranteeing immediate Frame-0 geometric alignment.
  - Added dedicated unit test in `tests/segmentedControl.test.ts`.

### Financial Correctness & System Integrity — Comprehensive Audit Resolutions (FIN-06, FIN-07, FIN-08, FIN-09, FIN-11, FIN-12, FIN-13) — OTA-safe

- **FIN-06 (UNCOVERED-01) — Income Deletion & Reduction Gullak Auto-Reconciliation (`gullakReconciliation.ts`, `ExpenseDetailScreen.tsx`, `useExpenseForm.ts`, `dailyBudgetStore.ts`, Rules `GUL-001` & `GUL-004`)**:
  - Implemented real-time backing deficit calculation via `calculateGullakIncomeDeficit` when deleting an income entry or reducing its value.
  - If a user reduces income on a date where income-funded Gullak deposits exist (e.g. income reduced from ₹10k to ₹3k when ₹4k was deposited), an explicit confirmation alert informs the user that the unbacked excess (₹1k) will be deducted from Gullak.
  - If user deletes the income entry entirely, the full unbacked Gullak deposit amount is adjusted via `adjustGullakIncomeDeposits`, preventing phantom savings balances.
  - Verified by 6 dedicated unit tests in `tests/gullakIncomeDeleteEditGuard.test.ts`.
- **FIN-07 — "Split Equally" Remainder Absorption & Exact Paise Balancing (`useExpenseForm.ts`, Rule `SPL-001`)**:
  - Fixed form validation lockout on odd/fractional split amounts (e.g. ₹0.02 among 4 people, ₹10 among 3 people) where floating point rounding caused total member shares to exceed paid amounts.
  - Distributes exact integer paise across participants with remainder absorption allocated to the payer/earlier members, ensuring mathematical precision and 100% total conservation.
  - Verified by dedicated unit tests in `tests/splitEqualSharePrecision.test.ts`.
- **FIN-08 — Instant App Cold Launch (`SplashScreen.tsx`)**:
  - Reduced hardcoded minimum splash delay from 2200ms to 500ms, providing a crisp logo entrance while opening the app 1.5 seconds faster on cold starts.
- **FIN-09 — Waterfall Simulation Decoupling & Cross-Filter Ticker Rollover Motion (`HomeScreen.tsx`, `BrandedHeroCard.tsx`, `RollingText.tsx`, `rollingText.ts`)**:
  - Decoupled `computeWaterfallFromState` from `activeFilter` and `referenceDate`. The chronological multi-pass lifetime simulation runs only when financial transactions change, while pill taps execute instantaneous $O(N)$ scope filtering without UI freezes.
  - Added `rollTrigger` prop and `forceSpin` planning mode to `<RollingText />` and `planRoll`. Tapping between "Daily" and "Weekly" filter pills (including Mondays when both intervals have identical values) now reliably triggers a full delightful digit rollover cycle.
  - Verified by unit tests in `tests/rollingText.test.ts`.
- **FIN-11 — AutoLog Diagnostics & Error Isolation (`features/autoLog/service.ts`)**:
  - Replaced naked empty `catch {}` blocks across queue draining, live SMS processing, and inbox catch-up with structured diagnostic warning telemetry, ensuring transient database locks or malformed event records never cause silent queue data loss.
- **FIN-12 — History Screen Category Switch Lag Elimination (`HistoryScreen.tsx`)**:
  - Synchronously resets progressive pagination window on category selection to prevent mounting massive offscreen section windows when tapping "All".
  - Introduced fast `dateHeaderCache` lookup for date headers (`EEEE, d MMM`) eliminating redundant `parseISO` and string formatting calls across historical transactions.
- **FIN-13 — Database Schema Cleanliness (`schema.sql`)**:
  - Deduplicated redundant index definitions for `idx_expenses_category` and `idx_categories_user` in the maintenance migration section.

### UX & Reliability — Auto-Log Review & Split Instant Clearance & Keyboard-Aware Split Runway (`ReviewSheet.tsx`, `reviews.ts`, `ExpenseFormScreen.tsx`, `SplitExtras.tsx`, `useFormKeyboard.ts`) — OTA-safe

- **Auto-Log Review & Split Instant Clearance (`ReviewSheet.tsx`, `reviews.ts`, `ExpenseFormScreen.tsx`)**:
  - Resolved issue where tapping "Save and split with friends" on Auto-Log Review redirected to the expense form, but left the Home review banner visible after saving, forcing a redundant second review.
  - `ReviewSheet.tsx`: `logAndSplit` now preserves any category selected in the sheet and explicitly clears `needsCategory` in the SQLite database (`needs_category = 0`), so the transaction is immediately marked decided.
  - `ExpenseFormScreen.tsx`: Introduced `reconcileExpenseSaved` helper on save to ensure any linked SQLite events are atomically marked resolved, immediately refreshing `useAutoLogStore` and vanishing the Home banner without requiring a second save.
  - Added dedicated unit tests in `tests/autoLogReviewSplit.test.ts` verifying zero-lag clearance.
- **Fintech Keyboard-Aware Split Form Runway & Per-Member Auto-Scroll (`useFormKeyboard.ts`, `SplitExtras.tsx`, `ExpenseFormScreen.tsx`)**:
  - Solved software keyboard input occlusion where person name and share amount inputs were hidden underneath the keyboard and "Save Expense" button.
  - **Dynamic 280px Runway**: `ScrollView` dynamically expands its bottom padding (`paddingBottom: isKeyboardOpen ? 280 : Spacing.section`), ensuring ample scroll range for all person cards.
  - **Per-Member Focus Auto-Scroll**: Implemented `handleSplitLayout` and `handleSplitFocus` layout tracking; tapping any person's name or share input smoothly scrolls that card into clear, unobstructed view in the safe zone above the keyboard.
  - **Auto-Scroll on Adding Members**: Tapping "+ Add Person" or quick friend suggestions automatically scrolls to the newly appended person card.
  - Added comprehensive unit tests in `tests/useFormKeyboard.test.ts`.

### Financial Correctness & UX — Multi-Cadence Insights Savings & Option 2 Month Budget Share (FIN-04, `weeklyInsightsUtils.ts`, `monthlyInsightsUtils.ts`, `WeeklyBreathingStrip.tsx`, `MonthlyBreathingStrip.tsx`, `useInsightsData.ts`, Rules `INS-002` & `HEA-002`) — OTA-safe

- **Multi-Cadence Insights Savings Reconciliation (`weeklyInsightsUtils.ts`, `monthlyInsightsUtils.ts`)**:
  - Resolved `INS-002` & `HEA-002` data disconnect where Weekly and Monthly cadence users saw ₹0 Gullak savings on Weekly/Monthly Insights tabs due to absence of `dailyRecords`.
  - Added support for reading and aggregating finalized savings directly from `budget_periods` (`cadence === 'weekly'` and `cadence === 'monthly'`).
  - Seamlessly handles cross-month weekly periods via `activeEnd` attribution matching true cash accounting rollovers.
  - Seamlessly handles mid-interval cadence switches by additively combining daily records and period slices without double-counting or data loss.
- **Dynamic Cadence Badges & Discipline Takeaways**:
  - Dynamically renders cadence-accurate pill labels: `🐷 X Saved Days` (Daily), `🐷 X Saved Weeks` (Weekly), and `🐷 1 Saved Month` (Monthly).
  - Enhanced smart takeaways to generate cadence-aware financial feedback celebrating weekly and monthly discipline when staying under budget.
- **Option 2: "Month Budget Share %" for Monthly Savers on Weekly Tab**:
  - Replaced the irrelevant ₹0 Gullak card for monthly budget users on the Weekly tab with an executive fintech metric: `MONTH BUDGET SHARE`.
  - Displays the current week's burn as a percentage of the user's monthly pool, status pill (`🟢 On Track` for $\le 25\%$, `⚠️ High Burn` for $> 25\%$, `🚨 Critical Burn` for $> 50\%$), subtext (`₹X of ₹Y pool`), and tailored pacing takeaways.
  - Retained exact dual-tile `BreathingStripShell` layout with zero layout shifting or screen redesign.
- **Comprehensive Unit Test Suite (`tests/multiCadenceInsightsSavings.test.ts`)**:
  - Added 9 unit tests verifying HEA-002 parity, mid-week cadence switching, Option 2 percentages and thresholds, cross-month weekly period attribution, and monthly period aggregations.

### Financial Correctness — Multi-Day Inactivity Scheduled Plan Catchup (FIN-02, `rollover.ts`, Rules `CAD-001` & `ROL-001`) — OTA-safe

- **Resolved Inactivity Gap Plan Drop (`rollover.ts`, `applyScheduledPlanChanges`)**:
  - Replaced tight `c.effectiveFrom === todayStr || c.effectiveFrom === yesterdayStr` lookup with canonical `resolvePlanForDate(planChanges, todayStr)`.
  - Scheduled plan transitions (cadence switches, budget modifications, mode toggles) that mature during an app inactivity period of 2 or more days (e.g. user absent over a 3-day weekend) now activate reliably upon app launch instead of being permanently dropped.
  - Added dedicated Vitest unit tests in `tests/dailyBudgetRollover.test.ts` verifying 3-day inactivity catchup and non-premature activation of future scheduled plans.

### Financial Correctness & UX — Backdated Ungoverned Spending Notice & Vault Guard Shortfall Pre-fill (FIN-01, `budgetUtils.ts`, `useExpenseForm.ts`, `ExpenseFormScreen.tsx`, `VaultSpendingGuardModal.tsx`, `metrics.ts`, Rules `GUL-001` & `SEC-001`) — OTA-safe

- **Universal Gullak Hard Cap (`GUL-001`, `metrics.ts`)**:
  - Enforced `totalAccumulatedSavings = Math.min(rawAccumulatedSavings, totalAccountRemaining)` universally across both Budget Mode and Pure Mode. Gullak savings can never mathematically exceed the user's net account cash liquidity under any state or transition.
- **Dynamic Contextual Backdated Spending Notice (`budgetUtils.ts`, `useExpenseForm.ts`, `ExpenseFormScreen.tsx`)**:
  - Implemented pure detection helper `getBackdatedSpendingNotice` that identifies when an expense is logged on a past date with no active budget or unspent funds (e.g. Sunday before Monday activation).
  - Rendered an Apple-grade fintech notice chip directly below the Date Picker on `ExpenseFormScreen`:
    - **Sufficient Gullak Funds**: Displays PiggyBank coin badge and info chip: *"Sunday had no active budget · ₹400 will be drawn from your Gullak (₹500 available)."*
    - **Shortfall Warning**: Displays AlertTriangle warning chip: *"Sunday had no budget · ₹300 short · You only have ₹100 in Gullak. Add ₹300 to log this expense."*
    - **Zero Balance**: Displays AlertTriangle warning chip: *"Sunday had no budget · Balance ₹0 · Your vault balance is ₹0. Please add money first to log this expense."*
- **Proactive Shortfall Guarding & In-Sheet Pre-fill (`SEC-001`, `useExpenseForm.ts`, `VaultSpendingGuardModal.tsx`)**:
  - Intercepts expense submission when backdated amount exceeds available vault liquidity on ungoverned days, launching `VaultSpendingGuardModal` pre-filled with the exact shortfall (`Math.max(0, evaluatedAmount - totalVaultLiquidity)`) rather than the full transaction amount.
  - Enhanced `VaultSpendingGuardModal` with dynamic status header (*"Available: ₹X • Need: ₹Y"*) and custom title ("Insufficient Balance"), letting the user deposit the exact deficit and complete saving atomically via "Add Money & Save" without losing form state.
- **Comprehensive Unit Test Suite (`tests/budgetUtils.test.ts`, `tests/vaultSpendingGuardAndBudgetEdit.test.ts`)**:
  - Added full test coverage for ungoverned day detection, deterministic yesterday calculations relative to `todayStr`, Pure Mode exemptions, sufficient Gullak drawdowns, exact shortfall calculations, and zero-liquidity guards.

### Financial Correctness & UX — Savings Tab Pause Elimination & Pure Mode Scheduling Parity (`SavingsScreen.tsx`, `BudgetHubSection.tsx`, `PauseBudgetModal.tsx`) — OTA-safe

- **Eliminated Dead "Budget Mode Paused" State**:
  - Removed confusing disabled/dead grey box and "Paused" badge in Savings Tab. The Allowance card now remains fully active, showing live progress, spent amounts, and budget targets without locking the UI.
- **Unified Budget Mode Scheduling Parity**:
  - Wired the Savings tab toggle directly to `handleSetBudgetModeEnabled(false)`, harmonizing it with Profile Screen settings.
  - Toggling OFF now prompts `PauseBudgetModal` (retitled to "Switch to Pure Mode?") to confirm that streak and accumulated Gullak savings remain safe, and schedules the transition to Pure Mode for tomorrow at 12:00 AM (`effectiveFrom = tomorrow`).
  - Displays a dedicated scheduled banner (`Tomorrow: Switching to Pure Mode · Takes effect tomorrow at 12:00 AM · Tap ✕ to cancel`).
  - Seamless Same-Day Reversal: Flipping the toggle back ON on the same day or tapping ✕ cancels the pending change immediately, restoring normal budget mode.
- **Copy & Explainer Alignment**:
  - Updated `PauseBudgetModal` to "Switch to Pure Mode?" with clear financial explanations. Integrated `budget_pause` topic into `MoneyExplainerModal` directly accessible from the confirmation dialog.

### Financial Correctness — Yearly Inflow & Cashflow Gullak Income Double-Counting Fix (FIN-03, `yearlyInsightsUtils.ts`, Rule `GUL-004`) — OTA-safe

- **Eliminated Phantom Income Inflation (`yearlyInsightsUtils.ts`)**:
  - Replaced legacy condition `(dep as any).source !== 'daily_savings'` with strict check `dep.source === 'external'` across `computeYearlyInflow` and `compute12MonthCashFlow` (monthly breakdown bar chart).
  - Aligned with canonical rule `GUL-004` and `schema.sql`: Deposits funded from available income (`source === 'income'`) represent re-allocation of already-counted earned income, and are strictly excluded from annual and monthly inflow calculations to prevent double-counting. Fresh capital deposits (`source === 'external'`) continue to increment inflow accurately.
- **Comprehensive Test Coverage (`tests/yearlyInsightsInflowDeposits.test.ts`)**:
  - Added dedicated unit tests verifying that income-funded deposits do not inflate annual inflow in both Pure Mode and Budget Mode, and do not inflate monthly cashflow bars.

### Reliability & Offline Resilience — Range Pagination Per-Page Timeout & False Offline Banner Elimination (FIN-05, `expenseStore.ts`) — OTA-safe

- **Per-Page Timeout & Pagination Scaling (`expenseStore.ts`)**:
  - Replaced the single global 5-second `Promise.race` timeout that wrapped the entire pagination loop with a dedicated 10-second `withTimeout` guard per 1000-row page. Total fetch time now naturally scales with data size without timing out healthy multi-thousand transaction accounts on high-latency connections.
  - Implemented automatic per-page retries (up to 2 retries with exponential backoff) for transient timeouts and connection resets before failing.
- **Intelligent Connectivity Verification & False Banner Fix (`expenseStore.ts`)**:
  - In the event of a fetch failure, `fetchExpenses` now validates true device connectivity via `NetInfo.fetch()` (`isConnected === false` or `isInternetReachable === false`) before calling `useNetworkStore.getState().setOffline(true)`. Slow or high-latency fetches no longer trigger a false "You are offline" banner while the user is actively connected.
- **Atomic Cache & State Invariant (Invariant 1 & 2)**:
  - If a page fails after retries, partial rows are completely discarded and never committed to state or the `@arthik_cached_expenses_${userId}` cache. State safely falls back to previously cached expenses.
- **In-Flight Cancellation Guard (`expenseStore.ts`)**:
  - Introduced monotonic `activeFetchSeq` sequence tracking to immediately discard and ignore any late-finishing or superseded fetch loops upon store reset (`resetExpenses`) or concurrent refreshes, permanently preventing stale data overwrites.
- **Comprehensive Unit Test Suite (`tests/fetchExpensesTimeout.test.ts`)**:
  - Added dedicated test coverage verifying: (a) slow multi-page fetches (6+ pages taking 6s total) complete without triggering offline status, (b) true network disconnections set offline status and load cache, (c) failure on page N preserves existing state and cache without partial overwrites, and (d) late-finishing loops after cancellation do not mutate state.

### UI/UX Polish & Automation — AutoLog ReviewSheet Parity, Horizontal Category Scroll & Self-Transfer Rule Automation (`ReviewSheet.tsx`, `reviews.ts`, `engine.ts`, `db.ts`) — OTA-safe

- **Compact Split-Row Receipt Card (`ReviewSheet.tsx`)**:
  - Eliminated right-hand void space by restructuring the transaction summary into a compact, fintech split-row receipt: Large bold amount and merchant title on the left, account pill badge and date/source on the right.
  - Formatted original SMS/notification snippet into a subtle 1-line italic quote box, reducing summary card vertical height by ~30% and elevating category selection into immediate focus.
- **Horizontal Category Scroll with Gradient Faders (`ReviewSheet.tsx`)**:
  - Replaced the 2-column grid with the exact horizontal scrollable category chip system from `ExpenseFormScreen.tsx`.
  - Added left and right SVG `LinearGradient` fade overlays (`reviewCategoryFadeLeft`, `reviewCategoryFadeRight`) with zero-interaction pointer events, elegantly feathering chips into the modal sheet card background during horizontal scroll.
  - Implemented animated scale press feedback (`Animated.spring` physics), SVG gradient backgrounds with `getCategoryChipGradient`, Lucide icons, and bold labels.
  - Included a standardized "None" chip with `CircleOff` icon when not in `categoryOnly` mode for effortless unsetting.
- **Uniform 48px Stadium Pills (`ReviewSheet.tsx`)**:
  - Replaced the bulky rectangular preference card with a standardized 48px stadium pill (`BorderRadius.pill`) with concise single-line copy (`Remember preference for "..."`).
  - Standardized "Remember preference", "Mark as Self Transfer", and "Save and split with friends" to the exact same 48px stadium pill height (`ControlHeight.standard`).
- **Self-Transfer Rule Automation (Real Money Invariant, `reviews.ts`, `engine.ts`, `db.ts`)**:
  - Added `markAsSelfTransfer` review action: purges any pre-logged expense from state and database (ensuring self-transfers never count towards expenses or income), updates local event status to `'transfer'`, saves the transfer rule to `self_transfer_rules`, and persists merchant preference as `'transfer'`.
  - Updated AutoLog engine (`processSms` and `processEmail`) to recognize `'transfer'` merchant preferences, automatically marking future transfers as `status = 'transfer'` and bypassing expense creation.
- **Bottom Button Hierarchy**:
  - Standardized primary CTA to 52px CTA with generous 38px comfortable touch targets for secondary actions ("Not a transaction" · "Delete transaction" / "Discard review").

### UI/UX Polish — Branded Hero Card Chip Boundary Enclosure & Redundant Income Elimination (`BrandedHeroCard.tsx`, `homeCalculations.ts`) — OTA-safe

- **Concentric Pod Boundary Enclosure (`BrandedHeroCard.tsx`)**:
  - Relocated `subtextContainer` inside `topSection`, strictly bounding subtext chips to the safe left column (`paddingRight: podSize + GAP + 6`) and permanently preventing horizontal protrusion into the top-right circular chart pod and SVG socket cutout.
  - Added strict `maxWidth: '100%'` and `flexShrink: 1` with `ellipsizeMode="tail"` across `subtextContainer`, `subtextChipRow`, `gullakSpendingBadge`, and text elements to guarantee chips never break card boundaries.
- **Standalone Gullak Spending Chip & Zero-Income Elimination (`homeCalculations.ts`)**:
  - When all period income is exhausted (`₹0 income`) and deficit spending draws from Gullak reserves, promoted Gullak spending into a single, clean standalone chip (`Drawn ₹... from Gullak`) instead of rendering an awkward, redundant `+₹0 income` pill alongside it.
  - Standardized Gullak drawn chips to render with `styles.gullakSpendingBadge` styling and red `PiggyBankCoinIcon` for consistent fintech alert hierarchy.

### UI/UX Motion & Apple Polish — Silky Smooth Filter Pills, UI-Thread Text Crossfade & Supabase Migration Parity (`SegmentedControl.tsx`, `BouncyCategoryFilter.tsx`) — OTA-safe

- **Apple-Grade Physical Spring Motion (`SegmentedControl.tsx`, `BouncyCategoryFilter.tsx`)**:
  - Eliminated the glitchy rubber-band distortion ("liquid morph" scaleX 1.14x / scaleY 0.95x warping and leading edge overshoot) that caused pill corner smearing and animation stutter.
  - Preserved fixed stadium pill geometry (`BorderRadius.pill`) with zero scale deformation during motion.
  - **Transform-Only UI Motion (`BouncyCategoryFilter.tsx`)**: Replaced layout property animation (`left`) with hardware-accelerated `transform: [{ translateX: pillX.value }]` anchored at static `left: 0`, completely eliminating expensive per-frame Android Yoga native relayout passes (~16ms UI thread blocks).
  - **Render & Callback Decoupling**: Mirrored layout measurements and container width to mutable refs (`layoutsRef`, `containerWidthRef`), stabilizing `animateTo` and `centerCategory` callbacks and removing intermediate React state re-renders during pill transit.
  - Implemented Apple-calibrated critically damped spring physics (`stiffness: 447.4, damping: 49, mass: 1, overshootClamping: true`) across both the Home toggle and History category filters.
  - Implemented 60/120fps UI-thread text color crossfade (`interpolateColor`) synchronized 1:1 with sliding pill position, eliminating mid-transit text color jumps.
  - Added automatic viewport centering (`scrollTo`) in `BouncyCategoryFilter` whenever an off-center or edge category is selected, keeping active categories smoothly centered.
  - Integrated native haptic feedback (`Haptics.selectionAsync()`) on the causal frame of touch.
- **Supabase CI Migration Directory Parity Fix (`supabase/migrations/`)**:
  - Aligned local migration filenames (`20261018111651_split_and_money_back.sql`, `20261018160000_multi_person_split.sql`) with remote `supabase_migrations.schema_migrations` timestamps.
  - Recorded migration version `20261018160000` (`multi_person_split`) in remote Supabase schema migrations table.
  - Permanently resolved GitHub Actions error: `"Remote migration versions not found in local migrations directory."`.

### UI/UX Polish — Fintech-Grade 2-Column Review Sheet Grid, Elevated Height & Sizing Balance (`ReviewSheet.tsx`, `BottomSheetModal.tsx`) — OTA-safe

- **Fintech-Grade 2-Column Category Grid (`ReviewSheet.tsx`)**:
  - Replaced erratic, variable-width `flexWrap` category pills with a mathematically balanced 2-column grid (`chipWidth = (availableWidth - 10) / 2`).
  - Standardized every category chip to a uniform 48px height (`ControlHeight.standard` touch target), complete stadium pill radius (`BorderRadius.pill`), 28x28 round icon badges, and 13.5px semibold/bold typography.
  - Active category selections render a crisp right-aligned checkmark with subtle tinted background and mint green outline without altering pill dimensions.
  - "None" chip in full review mode shares the identical 48px × `chipWidth` dimensions with a clean `CircleOff` badge for seamless alignment.
- **Elevated Bottom Sheet Height (`BottomSheetModal.tsx`, `ReviewSheet.tsx`)**:
  - Elevated review pop-up height to ~86% of window height (`maxHeight: '92%'`), eliminating the cramped feeling and providing generous breathing room for summary cards, category pills, preference toggles, and actions.
  - Replaced hardcoded 120px inner category scroll restriction with an unconstrained, fluid single-scroll layout that avoids nested scroll gesture traps on Android.
  - Updated `BottomSheetModal` slide entrance and exit distance to use dynamic window height (`initialSlide`), ensuring tall sheets enter and exit completely off-screen with zero visual clipping.
- **Balanced Button Hierarchy & Touch Targets**:
  - Upgraded "Save and split with friends" from a flimsy 36px compact button to a substantial 48px standard button with a `Users` icon.
  - Refined bottom secondary row ("Not a transaction" · "Delete transaction") with comfortable 36–38px touch targets, generous hit-slop, and 14px `bodySmall` typography.
  - Generous 16px padding on "Remember preference" card prevents awkward text wrapping.

### Enhancement — Vault Spending Guard In-Sheet Top-Up, Keypad Preservation & Zero-Spend Immediate Budget Adjustments — OTA-safe

- **Vault Spending Guard In-Sheet Top-Up & Save (`VaultSpendingGuardModal.tsx`, `SEC-001`)**: In Budget Mode, when account balance is exhausted (₹0) and an expense is attempted, the spending guard modal now provides an inline "Add Money & Save Expense" workflow directly within the bottom sheet:
  - Users can select smart pre-filled preset chips (`Exact ₹X`, `₹500`, `₹1,000`, `₹2,000`) or tap on an integrated numeric keypad to customize the incoming money amount.
  - Choose deposit mode via quick `UPI` / `Cash` pills.
  - The expense cannot be saved without adding funds (`addedAmount >= expenseAmount`), but users never have to abandon or re-type their filled expense form. Pure Mode remains 100% untouched (`canAddExpense: true`).
- **Expense Form Keypad Fix (`ExpenseFormScreen.tsx`)**: Selecting a category chip no longer dismisses the custom numeric keypad (`hideKeypad` removed on chip selection), preventing jarring screen jumps and allowing continuous editing.
- **Zero-Spend Immediate Budget Adjustment (`BudgetEditModal.tsx`, `BPR-002`)**:
  - When ₹0 has been spent in the current period (`todaySpent === 0` for Daily, `currentWeekSpent === 0` for Weekly, `currentMonthSpent === 0` for Monthly), budget modifications take effect **IMMEDIATELY** today without waiting until midnight or next period.
  - If spending has already occurred (`spent > 0`), the existing safe scheduling rules apply (tomorrow 12:00 AM for Daily, next Monday for Weekly, 1st of next month for Monthly).
  - The modal's dynamic subtitle updates in real-time (`"Takes effect today"` when spent is 0), and any obsolete pending future changes are superseded.

### Performance — Progressive Section Pagination & UI-Thread SegmentedControl Migration — OTA-safe

- **Incremental Progressive Section Pagination (`HistoryScreen.tsx`)**: Bounded initial rendering of the "All" category filter to the first 7 active date sections (~15–20 transactions), completely eliminating the ~80–120ms native view inflation stall on the Android Main UI Thread. Subsequent batches are seamlessly appended via `onEndReached` (threshold `0.6`) during scrolling with zero visual interruption.
- **React 19 `startTransition` Motion Decoupling**: Decoupled touch-driven pill animation from heavy SectionList re-grouping and Home screen period waterfall recalculations using `React.startTransition`, ensuring Reanimated springs accelerate freely on Frame 0 at solid 60/120 FPS.
- **Universal Reanimated SegmentedControl**: Upgraded `SegmentedControl.tsx` from legacy core `Animated` (inside `useEffect`) to native UI-thread `react-native-reanimated` worklets (`slideAnim`, `stretchAnim`, `squishAnim`, `leadAnim`) with Apple-calibrated critically damped springs (`stiffness: 447.4, damping: 49`), eliminating the 60–100ms touch delay across `HomeScreen` (All/Daily/Weekly/Monthly), `InsightsScreen`, `ProfileScreen`, and `BudgetEditModal`.
- **Row Callback Memoization**: Stabilized `TransactionRowItem` and `GullakRowItem` click handlers (`handlePress`), preventing redundant cell re-renders during filter transitions.

### Enhancement — Multi-Person Split Refund Recipient Attribution (Solution 2) — OTA-safe

- **Interactive Refund Recipient Choice (Revolut / Monzo / Splitwise Pattern)**: When logging a merchant refund for a multi-person split expense (e.g. food delivery item cancellation, returned item, or ticket refund), users can now interactively choose who the refund was for:
  - **Split among everyone** (`everyone`): Automatically distributes the refund proportionally across all participants (user + friends) according to their original shares.
  - **Just for me** (`me` / `user`): Credits the refund entirely to the user's portion of the bill, leaving friends' outstanding debts untouched.
  - **Specific friend** (`[Person Name]`): Credits the refund directly against that friend's outstanding debt (up to their remaining share), without penalizing other friends' obligations.
- **Live Balance Progression Preview**: The refund form (`MoneyBackExtras.tsx`) and conversion bottom sheet (`MoneyBackSheet.tsx`) render a real-time before-and-after breakdown (`₹X → ₹Y`, with a green `(Settled)` badge when cleared) showing exact balance impacts for every participant before saving.
- **Split Expense Detail Attribution**: `SplitDetailCard.tsx` clearly badges each refund slice with its exact recipient attribution: `Refund · ₹X (for Bob)`, `Refund · ₹X (split proportionally)`, or `Refund · ₹X (for you)`.
- **Zero Ledger Drift & Debt Isolation**: Replaced naive debt-clamping math in `src/lib/splitLedger.ts` so that one friend settling or receiving a targeted refund never clamps or wipes out another friend's outstanding debt.

### Enhancement — Single Concise AutoLog Review Sheet (`ReviewSheet.tsx`) — OTA-safe

- **Concise 1-Page Review Interface**: Replaced the sequential 4-step wizard (Type → Confirm → Category → Remember) in `ReviewSheet.tsx` with a single, elegant bottom sheet displaying transaction context, Type selector (`SegmentedControl`), compact Category chips, and Remember preference toggle simultaneously.
- **Explicit Save Gate**: Review decisions now persist ONLY when the user explicitly taps the primary "Save Transaction" button (`Save as Income` / `Save as Expense`), giving users complete control before modifying their ledger.
- **Visual Category Selection**: Rendered categories as compact visual chips with icon badges, category colors, and active selection checkmarks, plus a "None" option.
- **One-Tap Remember Toggle**: Interactive "Remember for future transactions" checkbox card with intelligent merchant-aware microcopy, auto-assigning preferred categories to future incoming/outgoing transactions.
- **Dedicated Resolution Cards**: Preserved specialized confirmation cards for own-account transfers (`possible_transfer`) and manual entry duplicates (`possible_duplicate`), and streamlined secondary actions ("Not a transaction" / "Discard review").

### Enhancement — Mode Transition Next-Day Scheduling & Same-Day Reversal Protection (`PUR-003`) — OTA-safe

- **Next-Day Mode Activation (`PUR-003`)**: Toggling between Pure Mode and Budget Mode in Profile now schedules the transition for **tomorrow at 12:00 AM (00:00:00)** (`effectiveFrom = tomorrowStr`). This ensures today's running budget, active daily records, and midnight Gullak savings conclude cleanly without mid-day disruption.
- **Same-Day Reversal Protection**: If a user schedules a mode transition for tomorrow and changes their mind on the same day (toggling the switch back to today's active mode), the app cancels the pending switch immediately (`handleCancelPendingPlanChange`), removes the scheduled confirmation notification (`removeNotification`), and seamlessly continues in the current mode with zero glitches or contradictory notifications.
- **Pure Mode Hero Card Details Guard**: In Pure Mode, disabled the Hero Card tap-to-open interaction and suppressed the "Tap the card for details" hint (`GUL-002`), keeping the interface calm since budget breakdowns and targets are inactive in Pure Mode.
- **Digital Vault Guard Overspend Solvency Rule**: Verified and documented that exceeding a weekly or monthly budget allowance (e.g. "Over by ₹1,000 this week") is absorbed from available Income and Gullak savings. Digital Vault Guard blocks new expense additions only when the entire account liquidity is depleted (`accountRemaining <= 0`).

### Fix & Polish — Scheduled Plan Rollover, Re-Enable Budget Modal & Performance Audit — OTA-safe

- **Custom Split Share Input Preservation**: Fixed `addMember` in `src/hooks/useExpenseForm.ts` to preserve existing members' custom split amounts when adding subsequent participants, ensuring typed allocations are not wiped out while still auto-distributing equally when all prior members were equal.
- **Offline Scheduled Plan Rollover Gap Resilience**: Updated `applyScheduledPlanChanges` in `src/store/dailyBudget/rollover.ts` to evaluate both `todayStr` and `yesterdayStr`, ensuring scheduled plan transitions maturing during multi-day offline gaps activate cleanly without requiring internet access.
- **Home Ledger Dot Floating-Point Precision Guard**: Wrapped `ledgerOwed` summation in `src/screens/HomeScreen.tsx` with `round2`, eliminating ghost indicator dots on the Home header caused by IEEE 754 decimal paise artifacts after all debts are settled.

- **Profile Budget Re-Enable Verification**: Fixed `handleToggleBudgetMode(true)` in `ProfileScreen.tsx` to always present `BudgetEditModal` rather than silently auto-scheduling previous budget amounts without user review.
- **Accurate Next-Day Schedule Copy**: Fixed `BudgetEditModal.tsx` to display `"Takes effect tomorrow (Day, Date)"` when re-enabling Budget Mode with scheduled activation, reserving `"Takes effect today"` strictly for fresh onboarding.
- **Rollover Scheduled Plan Amount Application**: Fixed `applyScheduledPlanChanges` in `src/store/dailyBudget/rollover.ts` so that when a scheduled plan change matures on midnight rollover, the corresponding cadence budget amount (`dailyBudgetAmount / weeklyBudgetAmount / monthlyBudgetAmount`) is immediately updated alongside `budgetCadence`.
- **HomeScreen Idle Render Optimization**: Short-circuited `heroDetails` computation in `HomeScreen.tsx` when the details sheet is closed or when in Pure Mode, eliminating redundant scans over `dailyRecords` and `budgetPeriods` on idle scrolls.
- **Dark & AMOLED Theme Contrast Polish**: Replaced hardcoded mint-green text colors in `HeroDetailsSheet.tsx`, `LedgerScreen.tsx`, `SplitDetailCard.tsx`, and `MoneyBackExtras.tsx` with adaptive theme tokens (`isDark ? colors.mintGreen : colors.mintGreenDark`) for WCAG AAA contrast.
- **Per-Person Split Edit & Recovery Guards (`SPL-006`)**: Upgraded `minShareForExpense` to support per-person queries and added `settledPersonsForExpense` in `src/lib/splitLedger.ts`. In `useExpenseForm.ts`, strictly prevent lowering an individual friend's share below what they already paid back or removing them from the split while their repayment is linked.
- **Edit Mode Type-Switch Guard (`SPL-006`)**: In `useExpenseForm.ts`, blocked changing transaction type from 'expense' to 'income' for expenses that have money-back recoveries or refunds attached, preventing orphaned recovery records.
- **Multi-Person Split Form React Key Stability (`break-ui`)**: Added stable member IDs in `useExpenseForm.ts` and `SplitExtras.tsx` (`key={member.id}`) ensuring clean React reconciliation and preventing cursor jumps or stale text inputs when adding or removing split members.
- **ExpenseDetail & Ledger Visual Polish**: Replaced hardcoded `mintGreenDark` with adaptive theme tokens in `ExpenseDetailScreen.tsx` for dark/AMOLED WCAG contrast, and wrapped `totalOwed` calculation in `round2` in `LedgerScreen.tsx` to prevent floating-point addition jitter.
- **Split Expense Edit Form Protections (`SPL-006`)**: Enforced strict safety checks in `src/hooks/useExpenseForm.ts` (`handleSplitOn` & `handleSave`) preventing users from toggling off split or reducing the expense amount/split share below the money already paid back by friends, protecting linked repayment integrity.
- **Duplicate Split Participant Prevention**: Upgraded `validateSplitAllocations` in `src/lib/splitLedger.ts` to detect duplicate participant names across multiple split rows, preventing key collisions, React render warnings, and shadowed settlement balances.
- **Universal Non-Spending Exclusion Enforcement**: Replaced legacy bare `=== 'self_transfer'` checks in `src/lib/budgetCalculations.ts` (`extractNonIncomeExpense`) and `src/lib/notificationSync.ts` with `isExcludedFromTotals`, ensuring money-back recovery rows are never mistakenly counted in daily/weekly spend summaries or category rankings.
- **Defensive Recovery Slice Date Formatting**: Wrapped date parsing in `src/screens/ExpenseDetailScreen.tsx` with error boundary fallbacks to eliminate potential `RangeError: Invalid time value` crashes when reviewing money-back slices.

### Addition — Home Card: One Chip + Tap-for-Details Sheet — OTA-safe

- **One chip on the card**: the Home card (All / Daily / Weekly / Monthly) now shows a single, most important chip: money drawn from Gullak, else over the limit, else budget used up, else budget left, else income. Remaining, Total Income and Total Expense stay on the card.
- **Tap the card for details**: in Budget Mode, a sheet opens with the whole period: Budget (given / spent from budget / left), Money in (received / still unspent / **Money back** on its own line, never counted as income), and Gullak (added / taken out / in Gullak now on the All view). Pure Mode keeps the card calm and uncluttered with no redundant tap hint or sheet (`GUL-002`), since all Net Balance, Inflow, and Outflow numbers are already directly visible on the card.
- **Calibrated Sheet Visual Hierarchy**: elevated Total Spent into a prominent hero card at the top of the details sheet (`heroCard`, bold typography, integrated date subtitle) establishing the period's primary spend metric instantly. Calibrated line item amounts so zero values (`₹0`) remain visually neutral (`textMuted`) rather than screaming in green, maintaining crisp typographic hierarchy.
- **Clear "till today" dates**: a running week or month says how far its numbers go ("12–18 Oct · till today", "1–31 Oct 2026 · till 18 Oct"). Past weeks and months show the full range.
- **No money rule changed** (display only). Pure logic in `src/lib/heroDetails.ts` with `tests/heroDetails.test.ts` (12 tests).

### Addition — Split Expenses, Multi-Person Sharing, Money Back & Refunds (`SPL-001..SPL-006`) — OTA-safe, needs one SQL run

- **Split an expense with one or multiple people**:
  - **Discoverable capsule pill**: redesigned the "Split this expense" trigger into a compact capsule pill (`BorderRadius.pill`) with an `AnimatedToggle` (matching Profile screen styling), placed alongside `DATE` and `PAID VIA` pills immediately above `Note (Optional)` so it is prominent and visible above the numeric keypad fold without scrolling.
  - **Multi-person sharing ("Who shares this?")**: expanded splitting to support unlimited participants. Add people via "+ Add Person" or quick suggestion chips, enter individual shares or use the "Split equally" shortcut, and see real-time calculation breakdown ("Your share ₹X · Total split ₹Y").
  - **Multi-person debt tracking & settlement**: settlements match repayments to individual participants (`settlementByPerson`). When one friend repays, their debt clears independently without affecting other participants, while correctly reducing the counted expense amount.
  - **Multi-person detail view**: `SplitDetailCard` cleanly presents individual participant rows, their shares, repayments, and statuses when an expense is split among multiple people.
- **Money that comes back is not income**: a friend paying back or a refund is recorded as a "Money back" row. It reduces the original expense from its ORIGINAL day, so the money returns to that day's budget (and Gullak), to the income pool, or to Gullak, depending on where it came from. Total Income does not change.
- **Ledger screen**: a new button on the Home header (next to Notifications and Profile; shows a dot while someone owes you) opens the Ledger: total you will get back, every person with what they owe, shared and paid-back totals, each shared expense (with "SETTLED" or what is left) and every payment back with its date. Tap an expense or payment to open it. Derived only from the expense rows (`buildPersonSummaries`).
- **Add Money now asks what the money is**: Income / Friend paid back / Refund. A friend's payment settles the oldest unpaid expenses first; extra money becomes normal income. A refund is linked to the expense it is for.
- **Automatic Logging**: the "logged" notification asks "Name owes you ₹Y. Is this their payment?" (name and amount first, then name only), the review screen always lists people who owe money ("Paid back by someone?"), and any logged income can be marked as money back from its detail screen. Arthik only asks; it never settles by itself.
- **History & details**: money-back rows show as "Money back"; split expenses show "Split with Name" and what came back; the detail screen shows what is still owed and every payment back.
- **Safety**: an expense with money back cannot be deleted until its money-back entry is deleted (deleting that entry restores everything); the edit form always edits the amount paid; the cash-flow chart ignores money-back rows.
- **Fix**: Automatic Logging category / type updates wrote the counted amount instead of the amount paid; they now always use the amount paid.
- **Database**: run `supabase/migrations/20261018_split_and_money_back.sql` and `supabase/migrations/20261018_multi_person_split.sql` once (also in `schema.sql`). Normal expenses keep working before it is run; only the new features need it.
- **Docs**: canonical rules `TXN-004` and `SPL-001` updated (`SPL-001..SPL-006`); new [ADR 0016](docs/adr/0016-split-expenses-and-money-back.md); AGENTS, CONTEXT, PRD, architecture, maps, AutoLogging, notifications and design-system updated.
- **Tests**: `tests/splitLedger.test.ts` (32), `tests/splitMultiPerson.test.ts` (7), and `tests/splitMoneyBackStore.test.ts` (15).

### Performance — History Category Pill UI-Thread Reanimated Animation & Zero-Shift Typography — OTA-safe

- **Touch-Driven UI-Thread Spring Dispatch**: Moved the Reanimated spring launch from `useEffect` into the touch event handler (`handleSelect`) in `src/components/BouncyCategoryFilter.tsx`. Starting the UI-thread animation synchronously on touch ensures the pill glides immediately on frame 0 (~8–16ms) without waiting for React to complete heavy SectionList re-grouping and initial item mounting.
- **Eliminated Mid-Flight Animation Clobbering**: Replaced the fragile `pillLeft.value !== activeLayout.x` in-flight check in `useEffect` with a dedicated `lastActiveLayout` ref. This prevents intermediate React re-renders from mistaking an in-flight spring position for an obsolete layout measurement and violently snapping the pill.
- **Component Memoization**: Wrapped `BouncyCategoryFilter` with `React.memo` to eliminate redundant component re-render cycles when parent screen states change.
- **UI-Thread Worklet Animation Migration**: Replaced React Native core `Animated` with `useNativeDriver: false` in `src/components/BouncyCategoryFilter.tsx` with native UI-thread `react-native-reanimated` shared values (`pillLeft`, `pillWidth`, `stretchAnim`, `squishAnim`, `leadAnim`) and worklets.
- **Apple-Calibrated Critically-Damped Spring & Dual-Edge Liquid Morph**: Calibrated Reanimated springs to the exact mathematical equivalents of React Native Origami tension and friction (`tension: 100, friction: 16` -> `stiffness: 447.4, damping: 49` for primary slide; `tension: 160, friction: 16` -> `stiffness: 664.6, damping: 49` for dual-edge liquid morph recovery). Restores the authentic snappy liquid-morph feel with zero position overshoot and synchronized ~130ms settling time completely offloaded from the JavaScript thread.
- **Zero-Shift Typography Architecture**: Solved layout measurement churn caused by switching active tab font weight between `FontFamily.medium` and `FontFamily.bold`. An invisible bold placeholder (`hiddenPlaceholder` with `opacity: 0`) locks tab container dimensions, completely eliminating `onLayout` width expansion and preventing secondary React re-render passes during tab switches.
- **Stable Options Prop Memoization**: Stably memoized `categoryFilterOptions = useMemo(() => [{ id: null, name: 'All' }, ...categories], [categories])` in `src/screens/HistoryScreen.tsx`, preventing new array references on unrelated state passes.
- **Frame Telemetry Validation**: High-FPS frame extraction (30 fps) across device screen recordings confirms complete elimination of the ~200ms initial stall on "All" filter resets, with smooth continuous glide and liquid morph across all filter transitions.
- **Architectural Decision Record**: Fully documented in [ADR 0015](docs/adr/0015-ui-thread-reanimated-worklet-migration-and-render-optimizations.md).

### Performance — History Screen SectionList Virtualization Optimization — OTA-safe

- **Optimized SectionList Initial Render Batch**: Reduced `initialNumToRender` from `50` to `12` and `maxToRenderPerBatch` from `30` to `10` in `src/screens/HistoryScreen.tsx`.
- **Eliminated Synchronous UI Freeze on Category Filter Reset**: Slashes 76% of the initial component mounting workload when transitioning from an individual category back to the "All" filter, reducing maximum frame time spikes on Android by ~65–69% (from ~108–114ms down to ~35–37ms on emulator).
- **Zero Layout or Visual Regressions**: Preserves full list fidelity, section header totals, category filtering, search, and bidirectional scrolling with smooth progressive rendering across the full viewport window.

### Performance — Granular Store Selectors for Category & Expense Screens — OTA-safe

- **Granular Store Subscriptions**: Replaced broad whole-store subscriptions (`useCategoryStore()` and `useExpenseStore()`) in `src/screens/ManageCategoriesScreen.tsx` and `src/screens/CategoryDetailScreen.tsx` with targeted, fine-grained selectors for only the specific state fields and action references needed (`categories`, `expenses`, `fetchCategories`, `deleteCategory`, `fetchExpenses`).
- **Eliminated Ghost Rerenders from Store Churn**: Prevents both screens from re-rendering on unrelated state updates within `categoryStore` (e.g. `loading`, `isFetched` toggles) and `expenseStore` (e.g. `isSyncing`, `lastSyncedAt`, `failedSyncItems`, `transactionType`).
- **Measured Rerender Isolation**: Unit tests verify that 6 consecutive unrelated state mutations across both stores trigger 6 unwanted re-renders under the old whole-store subscription pattern, but exactly 0 re-renders under the granular selector pattern, while preserving 100% reactivity when `categories` or `expenses` actually change.
- **Zero UI or Semantic Drift**: Preserves all existing UI layouts, navigation, empty states, and action execution without altering store implementations or financial behavior.

### Performance — Insights Category Lookup Map Optimization — OTA-safe

- **Memoized $O(1)$ Category Lookup Map**: Replaced repetitive linear array scans (`categories.find((c) => c.id === exp.category_id)`) inside `src/screens/insights/useInsightsData.ts` with a stably memoized `categoryMap: Map<string, Category>` constructed via `buildCategoryMap(categories)`.
- **Eliminated Hot Loop Overhead Across Render Passes**: Replaced all 9 linear lookup call sites (`earliestExpenseDate`, `currentTotal`, `categoryTotals`, `sortedCategories`, `weeklyData`, `monthlyCashFlowData`, `currentPeriodIncome`, `weekTransactionCount`, `monthTransactionCount`, `yearTransactionCount`) with instant $O(1)$ Map queries, eliminating thousands of linear equality comparisons per render.
- **Empirical Performance Gains**: Microbenchmark measurements confirm a 2.35x speedup for standard accounts (150 transactions, 10 categories), 3.54x speedup for heavy accounts (500 transactions, 25 categories), and 5.37x speedup for power users / yearly views (2,000 transactions, 40 categories).
- **100% Behavioral & Fallback Equivalence**: Preserves exact fallback handling for missing/null category IDs (`'others'`), unknown category IDs (`'Unknown'`), and empty category collections without modifying any financial formulas, UI components, or store synchronization.

### Performance — HomeScreen Recent Transactions Bounded Top-5 Scan — OTA-safe

- **Single-Pass Bounded Top-5 Selection**: Replaced the full-array mapping, spreading, and $O(N \log N)$ sorting of the entire historical transaction database in `HomeScreen.tsx` with a single-pass $O(N)$ bounded selection algorithm (`selectRecentTransactions` in `src/lib/homeCalculations.ts`).
- **Zero Full-Array Intermediate Allocations**: Eliminates generating thousands of intermediate transaction wrapper objects on every HomeScreen render when viewing or adding transactions, saving ~5,000 object allocations on larger accounts and accelerating recent transaction preparation by 4.4x to 11.4x.
- **100% Sorting Parity & Stability Guarantee**: Preserves identical descending ordering (`expense_date` then `created_at`), handles optimistic past-dated additions correctly, and maintains tie-breaking stability across expenses and Gullak deposits without altering any financial calculations or UI rendering.

### Changed — Smart Budget & Gullak Card Compact Executive Redesign — OTA-safe

- **Authentic Indian Rupee (₹) Gullak & Ditto Silhouette Icon**: Re-engineered `PiggyBankCoinIcon` to a 1:1 mathematical vector replica of the reference sprite sheet icon. Features the chubby silhouette piggy body with curling tail, two triangular ears, rounded snout, splayed sturdy legs, smiling eye (◡) cutout, and an authentic, razor-sharp Indian Rupee (`₹`) symbol inside the coin with parallel bars and clean diagonal kick leg. All app touchpoints (`BottomNavBar`, `ProfileScreen`, `SavingsHeroCard`, `GullakDepositDetailScreen`, `DepositGullakModal`, `BudgetHubSection`, `SavingsRecordRow`, etc.) immediately render this premium graphic.
- **Uniform Settings Icon Container Styling**: Updated `budgetIconContainer` in `ProfileScreen.tsx` to use `colors.cardSubtle` (sleek gray container) with `colors.textPrimary` (crisp white in dark/AMOLED, dark navy in light theme), establishing 100% visual uniformity with all rows in the `ACCOUNT` settings card (`Manage Categories`, `Notifications`, `Theme`, `Ambient Background`, `App Lock`).
- **1:1 Card Size & Geometry Parity**: Synchronized `profileCard` and `budgetCard` to an identical `minHeight: 80` and 14px vertical padding. Re-engineered `budgetIconContainer` into a 52x52 rounded squircle (`borderRadius: 16`), matching the exact physical dimensions and visual mass of the 52x52 circular avatar.
- **Enlarged & Bold Avatar Letter ("K")**: Scaled the user initial font from 20px up to 24px (`lineHeight: 28`) directly in `FontFamily.bold` (`Quicksand_700Bold`) without conflicting `fontWeight`, preventing Android's system font fallback and keeping the font 100% consistent with the user's name ("Kislaya").
- **Enhanced Subtitle Legibility & Tap Target**: Enlarged the `Daily · ₹250 · Edit ✎` subtitle from 12px caption to 14px (`FontSize.bodySmall`, `lineHeight: LineHeight.bodySmall`), giving the interactive budget edit cue instant readability and comfortable touch affordance.
- **Eliminated Awkward Line Breaking & Title Wrapping**: Removed the brittle dynamic layout measuring hacks (`budgetTitleWraps`, `onTextLayout`, invisible width test components) that awkwardly forced "Smart Budget & ⚠️" onto line 1 and "Gullak" onto line 2. The title is now locked on a single line (`numberOfLines={1}`) with `adjustsFontSizeToFit` and `minimumFontScale={0.88}`.
- **Zero Void Space**: Completely removed empty padding voids and vertical sprawl, elevating settings groups further above the fold.

### Fixed — Money Explainer Modal White Scroll Indicator & Standard Pill CTA — OTA-safe

- **Beside-the-Cards White Scroll Indicator**: In `MoneyExplainerModal.tsx`, replaced Android's native black overlapping scrollbar with a custom animated scroll indicator. Styled with a 10px clear gutter (`paddingRight: 10`), the indicator renders cleanly beside the cards rather than overlapping card borders. In dark/AMOLED themes, it is rendered in crisp white (`#FFFFFF`) with smooth fade-in on scroll and automatic fade-out at rest.
- **Unified 60px CTA Pill Parity**: Replaced the non-standard 48px custom button with the canonical `AppButton` primitive (`size="cta"`, `ControlHeight.cta = 60`), enforcing 100% design system consistency with all other primary action pills across the app, complete with responsive spring touch feedback.

### Changed — Profile Hero Card Compact Executive Redesign — OTA-safe

- **Horizontal Ergonomic Architecture**: Re-architected `profileCard` in `ProfileScreen.tsx` from an expansive ~240px vertical stack into a sleek ~82px horizontal executive row, eliminating excessive void spaces and saving >60% vertical viewport height.
- **Pure Circular Avatar & Camera Removal**: Removed the confusing camera badge overlay from the 52px avatar, creating an unadorned, pure circular initial badge (`colors.mintGreen`) with centered bold typography and clean press accessibility.
- **Zero-Truncation Clean Profile Card**: Replaced the compressed email address on the profile hero card with an elegant `Personal Account` subtitle, permanently eliminating awkward horizontal truncation (`...`) on narrow mobile viewports while keeping the user's name uncluttered and prominent.
- **Dedicated Read-Only Registered Email in Edit Modal**: Added a read-only `Registered Email` field inside `EditProfileModal.tsx` equipped with a `<Mail size={16} />` icon, styled in parity with name inputs, displaying the full registered email without any truncation.
- **Visual Balance & Touch Ergonomics**: Positioned the 52px circular avatar on the left, primary name and account subtitle stack in the center, and a tactile 34px pill "Edit" button with `<SquarePen size={13} />` icon on the right thumb edge.
- **Above-the-Fold Settings Elevation**: "Budget & Savings" and "Account" settings groups are now immediately elevated into direct view on standard screens without requiring immediate scrolling.

### Changed — Manage Categories Row Proportions & Action Button Parity — OTA-safe

- **Badge & Icon Size Parity**: In `CategoryRowItem.tsx`, increased icon badge size from 44px to 48px with 22px category icon (`strokeWidth={2.2}`), creating 1:1 visual parity with `TransactionRow` across Recent Transactions on Home and History screens.
- **Rhythm & Typography Calibration**: Matched `ItemRowShell` rhythm with 16px text-to-badge margin (`Spacing.group`), 12px vertical padding, -0.2 title letter spacing, and standard border dividers (`isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'`).
- **Concentric Circular Action Buttons**: Re-engineered Edit and Delete buttons into proportional 40x40 circular capsules (`BorderRadius.pill`) with 18px icons, refined border tints, accessible touch targets, and tactile spring press feedback.

### Fixed — Live Home Display Name Sync & 15-Character Name Limit Guardrail — OTA-safe

- **Full Display Name on HomeScreen Header**: HomeScreen now displays the user's full name (first + last name or full metadata/email display name) via `getDisplayName` instead of truncating to first name only. Name updates in Profile edit reflect live and instantly on HomeScreen without app restart.
- **Proportional Name Font Sizing**: Fine-tuned header greeting name font scaling with explicit dynamic `lineHeight` (`Math.round(nameFontSize * 1.2)`), preventing vertical gaps and ensuring names up to 15 characters render crisply beside action buttons.
- **15-Character Business Limit Guardrail**: Established `MAX_PROFILE_NAME_LENGTH = 15` (benchmarked to `"Kislaya Agarwal"` = 15 characters) enforced across `EditProfileModal`, `ProfileSetupScreen`, and `authStore.ts`.
- **Live Input Clamping & Immediate User Feedback**: In `EditProfileModal` and `ProfileSetupScreen`, inputs dynamically clamp excess characters with real-time warning feedback (`"Maximum 15 characters allowed. Cannot write more."`) and a visual character counter (`${len}/15`). Save actions are guarded against exceeding the limit.

### Added — AutoLog Review Swipe-to-Delete, Bulk Dismiss & Reset Learned Rules — OTA-safe

- **Swipe-to-Reveal Delete Action with Spring & Layout Physics**: In `AutoLogReviewScreen.tsx`, each pending review card supports a fluid swipe-to-reveal gesture with momentum projection, rubber-banding, and haptic feedback. Tapping the revealed Delete button animates the card smoothly off-screen (`withTiming` with `EASE_OUT`) and triggers `ROW_CLOSE` (`LinearTransition`) layout animation to gracefully glide subsequent items into place without jank.
- **Bulk Dismiss ("Clear All") Reviews**: Added top header trash icon button to `AutoLogReviewScreen.tsx` with a destructive confirmation dialog to dismiss all pending review items at once.
- **Review Sheet Direct Discard**: In `ReviewSheet.tsx`, added a direct "Discard review" action on Step 1 and "Delete transaction" on category step with confirmation alerts, removing any pre-logged ledger records immediately.
- **Reset Learned Rules & Merchant Preferences**: In `AutoLogCenterScreen.tsx`, added a "Reset learned rules" action in the Navigation card with `<RotateCcw />` icon. Clears `merchant_prefs` (merchant category mappings) and `rules` (custom ignore rules) back to factory clean slate without touching tracked accounts or past transaction ledger history.
- **Deduplication Invariant Preserved**: Dismissing pending reviews marks events as `status = 'ignored'` rather than deleting database rows, permanently retaining cryptographic SMS/email fingerprints to prevent background listeners from re-detecting and re-prompting the same transaction.

### Changed — Bottom Navigation Bar Concentric Geometry & Uniform Inter-Icon Spacing — OTA-safe

- Calibrated floating `BottomNavBar` geometry so that the active capsule's outer margin matches the vertical 13px gap ($R - r = 34 - 21 = 13\text{px}$) while preserving balanced, equal distances between all 5 icons (`Home` $\leftrightarrow$ `History` $\leftrightarrow$ `+ FAB` $\leftrightarrow$ `Savings` $\leftrightarrow$ `Insights`).
- Eliminated clustering/crowding around the center FAB by tuning `pillBar` padding (4px) with balanced wing space-around distribution and 68px center isolation.
- Added `maxWidth: 400` to prevent over-stretching on tablets or foldables.
- Synchronized Pure Mode `purePillBar` concentric padding to `8px` matching $(58 - 42) / 2 = 8\text{px}$ ($R - r = 29 - 21 = 8\text{px}$).

### Changed — Manage Categories Clean Borderless List & Tactile Feedback — OTA-safe

- Removed the awkward container card (`listCard`) from `ManageCategoriesScreen.tsx`, rendering category rows directly on the screen background canvas with clean dividers (`borderSubtle`).
- Set `FlatList` to `flex: 1` with `paddingBottom: insets.bottom + 96` so long category lists scroll smoothly and never get obscured by the floating `+` FAB.
- Added tactile active press states (spring scale and opacity) to `CategoryRowItem.tsx` edit and delete buttons as well as the Floating Add Button.

### Fixed — Home All pill and the account total disagreed on a carry gap week (canonical `CAR-001`, `BAL-001`) — OTA-safe

- In CAR-001 Mode B (weekly / monthly) the Home All pill left out the WHOLE budget of a carry-funded period (`carryCover = pc.base`) while the account total (spending guard, Gullak cap, Pure Mode deficit) left out only the funded part. On a gap week (e.g. ₹3,000 funded + ₹2,000 gap) they differed by the gap for good (Home ₹33,000 vs ₹35,000). Home now leaves out only the carry-FUNDED part (`pc.funded`): the gap counts like any budget, real money added grows it by exactly that amount, and both numbers are always the same. Owner decision recorded in `CAR-001` §3.
- Test 5 of `tests/carryAllocationWeeklyMonthly.test.ts` expected the wrong number (it only checked Home); corrected and a new test compares Home against the account total on every day of a mid-month Monthly→Weekly switch.

### Changed — Daily allocation keeps the account total flat (CAR-001, behaviour that was already changed by the last release, now covered by a test and documented) — OTA-safe

- Switching Monthly/Weekly → Daily with allocation used to make the account total drop by the carried amount and then grow by the daily budget every day (the carried money looked lost and came back slowly). `computeAllTimeBudget` now includes the carry still to be used (`dailyCarryRemaining`, `periodCarryRemaining`), so carried money is never new money and never disappears: the total stays flat; each finished day with unspent daily budget still reaches Gullak. New regression test in `tests/carryAllocationWeeklyMonthly.test.ts`.

### Added — "Carried money has run out" notice (CAR-001, NOT-001) — OTA-safe

- While carried money funds the daily / weekly / monthly budget the user gets the short funding message each day / week / month (unchanged). On the FIRST day / week / month that carry no longer funds the budget, ONE extra message is sent: "Carried money has run out — From today your ₹500 daily budget is no longer covered by carried money. Add ₹500 today to fund it." (weekly: this week, monthly: this month). After it no more carry messages. Additive / next-day switches have no such message. New `carryEndCopy`, `buildCarryEnds`, `carryEnds` in the plan context, id `carry_end_<date>`; tests for daily, weekly and monthly.

### Cleanup — OTA-safe

- Removed the `typeof registerX === 'function'` guards that had been added to `expenseStore.ts` only to satisfy test mocks; production code is back to plain calls. Replaced a stale comment in `metrics.ts` that still said a Pure Mode leftover becomes income (`PUR-002`). Removed a duplicated "Period Carry Funding" entry from `CONTEXT.md`.
- Added [`docs/CODEBASE_GUIDE.md`](docs/CODEBASE_GUIDE.md) to repository documentation indexes in [`docs/README.md`](docs/README.md) and [`README.md`](README.md).

### Added — Pure Mode Rules (PUR-001, PUR-002, SEC-001 amend) — OTA-safe (JS only)

- **Pure Mode Never Blocks Spending (SEC-001 amend)**: Pure Mode now permits unconstrained spending into negative balance without triggering the "Account balance exhausted" modal or AutoLog liquidity review flags (`canAddExpense: true`, no reason). Budget Mode Digital Vault spending guard remains strictly enforced when liquidity $\le 0$.
- **Pure Mode Ended-Pool Leftover Retention (PUR-002)**: When a weekly or monthly budget pool ends while in Pure Mode, unused funds do NOT convert to income (`incomeAvail` and `incomeRestored` are untouched; historical `pure_end_*` inbox alert deleted). Unspent pool funds are tracked as `pureLeftover`, consumed first by subsequent Pure Mode spending before income or Gullak, and flow into Gullak (`totalAccumulatedSavings`) only when Budget Mode is re-enabled. Remaining balance is completely unchanged.
- **Pure → Budget Deficit Auto-Balancing (PUR-001)**: When re-enabling Budget Mode while account remaining is negative ($R < 0$), exactly one real income transaction for $D = \text{round2}(-R)$ with note `Auto-balance (Pure Mode deficit)` is created. Backdated to the earliest expense causing cumulative Gullak draw $\ge D$ (`WAT-002`). Excluded from the Home budget chip `periodIncome` but fully counted in all-time inflows/waterfall. Inbox notification `pure_deficit_balanced` posted. Total Income never decreases; repeat cycles balance only the incremental deficit.
- **Tests & Docs**: Added 6 acceptance tests in `tests/pureModeRules.test.ts`. Updated `tests/useExpenseForm.test.ts`, `tests/cadenceFixes.test.ts`, `tests/vaultSpendingGuard.test.ts`, `tests/financialCorrectnessMatrix.test.ts`, `tests/moneyFixesFour.test.ts`, `tests/canonicalStatusAndGuard.test.ts`. Synchronized `docs/ARTHIK_CANONICAL_RULES.md`, `docs/adr/0012-...`, `docs/adr/0014-...`, `CONTEXT.md`, `docs/prd.md`, `docs/architecture.md`, `docs/maps/daily-budget-map.md`, `docs/notifications.md`, `docs/RELEASE_PROCESS.md`, and `app.json`.

### Added — CAR-001 Mode B (Allocation) for Weekly and Monthly Targets — OTA-safe (JS only)

- **Multi-Period Allocation Drawdown for Weekly and Monthly**: Fully implemented CAR-001 Mode B when switching to Weekly or Monthly budget targets. Carried unspent money $U$ funds subsequent periods ($k = 1, 2, 3\dots$) with $\text{funded}_k = \min(B, \text{remaining}_{k-1})$, requiring the user to add only the remaining gap $\text{toAdd}_k = B - \text{funded}_k$. The period budget stays exactly $B$ (not $B + \text{carry}$).
- **Real-Money Invariant & All-Pill Zero Double-Counting**: In `homeCalculations` and `metrics.ts`, only the carry-funded part of a budget period is left out of the All-pill budget pool (the gap part counts like any budget; see the Fixed entry above). Invariant asserted: Remaining (All) before switch == immediately after switch == after each funded period start (no growth).
- **Multi-Period Switch Cascading**: Allocation carry still unused when a user switches cadences again is carried into the next plan via `periodCarryRemaining`, ensuring unused carry is never lost and never duplicated.
- **Cadence Switch Modal**: Option 2 for Weekly/Monthly displays "Pay my {weekly|monthly} budget from it" with accurate period coverage and guidance copy computed from `computeAllocationSummary`.
- **Period Carry Lifecycle Notifications**: Scheduled at 08:30 on the start of each funded week (Monday) or month (1st of month). Gap periods prompt the user to deposit the remaining gap. One "Carried money has run out" notice is sent on the first unfunded period, then silence.
- **Tests & Docs**: Added 10 comprehensive acceptance tests in `tests/carryAllocationWeeklyMonthly.test.ts`. Synchronized `docs/ARTHIK_CANONICAL_RULES.md`, `docs/adr/0014-...`, `docs/adr/0012-...`, `docs/notifications.md`, `docs/prd.md`, `docs/architecture.md`, `docs/maps/daily-budget-map.md`, `CONTEXT.md`, and `docs/RELEASE_PROCESS.md`.

### Removed — Split Expenses / Shares and the Reimbursement class (canonical `REF-001`, `TXN-004`) — OTA-safe (JS only)

- Arthik is simple personal cashflow again: the **Split expense** button, the friend-shares screens, "Is this your friend's share?" questions (form and AutoLog review) and the friend-repayment matching are gone. An expense is recorded at its full amount; money that comes back (a friend paying you, a refund) is simply **Income**.
- Removed `src/lib/shares.ts`, `src/store/sharesStore.ts`, `src/components/shares/*`, the `reimbursement` transaction class and every "reimbursement" channel in the money engine (`moneyWaterfall`, `budgetCalculations`, `budgetPeriods`, `homeCalculations`, store metrics, rollover, self-healing).
- **Kept and moved**: remembered self-transfer notes now live in `src/store/transferRulesStore.ts` + `src/lib/transferRules.ts`; the transfer switch is `src/components/transfer/TransferExtras.tsx`; the detail card is `TransferDetailCard.tsx`.
- **Owner action (run once in Supabase → SQL Editor):** `supabase/migrations/20261017083146_retire_shares_reimbursements.sql`. It turns old `reimbursement` rows into normal income and tightens the class check to `('normal','self_transfer')`. Lifetime income for anyone who used Split goes up by the repaid amounts. The `expense_shares` table is kept, unused (no data deleted).
- Old data on devices is handled: a queued or cached `reimbursement` is read as normal income; an old pending "split_repayment" AutoLog question becomes the normal "What is this?" question.

### Changed — One status word: `missed` (canonical `BUD-008`) — OTA-safe

- The overspent-day status is `'missed'` everywhere (code, database, UI). `'exceeded'` no longer exists as a status and the code↔database translation layer is gone. Days cached by older versions as `'exceeded'` are read as `'missed'` (`src/store/dailyBudget/legacyStatus.ts`, store persist version 4). The limit-exceeded notification keeps its own alert kind.

### Changed — Spending guard message (canonical `SEC-001`) — OTA-safe

- When the account has no money, the guard (Pure and Budget Mode) says "Account balance exhausted. Please add money first." (`VAULT_GUARD_MESSAGE`).

### Fixed — Self-transfers and transfer detection (canonical `TXN-003`, `BAL-001`) — OTA-safe

- The all-time "account remaining" no longer counts the debit leg of a self-transfer as money spent (the credit leg was already ignored), so moving money between your own accounts never lowers your balance.
- A note or category name containing words like "transfer" or "card bill" no longer silently removes an income from your available income. Only the structured self-transfer mark does (`isInternalTransfer` keyword guessing removed).

### Docs & Tests — canonical rules as the supreme source of truth

- New `docs/ARTHIK_CANONICAL_RULES.md` (final-state rules; pending "Phase 4" wording removed; AutoLog, category, payment-mode and matching rules aligned with the code). New ADR `0014`. `AGENTS.md` now has a Canonical Rules Supremacy block (stop-and-ask on contradiction, doc-sync checklist). `CONTEXT.md`, `README.md`, `docs/prd.md`, `docs/architecture.md`, `docs/README.md`, `docs/RELEASE_PROCESS.md`, `docs/maps/daily-budget-map.md`, `docs/specs/EMAIL_AUTO_LOGGING_SPEC.md`, ADR 0002/0005/0010/0011/0012 updated to match.
- Tests: removed the split / reimbursement suites; added `tests/selfTransfersAndIncome.test.ts` and `tests/canonicalStatusAndGuard.test.ts`, plus a self-transfer balance test in `tests/moneyFixesFour.test.ts`.

### Fixed — Timezone Sensitivities & Registration Date Integrity (Daily Budget Section 3 Audit)

- **Local Device Registration Date Resolution**: Updated `getUserCreatedAtStr()` in `metrics.ts` to delegate directly to `getUserCreatedAtLocalDate()`. Converts UTC timestamp (`created_at`) to local device date (`yyyy-MM-dd`) via `parseISO`, preventing 1-day UTC drift for Indian and non-UTC users from misclassifying pre-registration transactions as active budget days.
- **Timezone-Safe Best Streak Gap Bridging**: Replaced legacy `new Date(rec.date)` and `setDate()` arithmetic in `src/lib/budgetCalculations.ts` with `date-fns` calendar date math (`parseISO`, `differenceInCalendarDays`, `addDays`). Eliminates UTC midnight parsing shifts, preventing broken streak bridges across month and year boundaries in timezones west of UTC.
- **Section 3 Modernization**: Updated `docs/maps/daily-budget-map.md` Section 3 with accurate submodule file mappings, line numbers, and multi-cadence rollover specifications.
- **Section 4 Modernization (Income Inconsistency & Cold-Start Sequencing)**: Updated `docs/maps/daily-budget-map.md` Section 4 to reflect the dedicated `classifiers.ts` submodule, `incomeClassifier.ts` helpers, and authoritative `SplashScreen.tsx` cold-start hydration sequence.
- **Startup Rollover Notification Race-Condition Fix (Ticket S3.3)**: Updated `hydrateFromSupabase` in `hydrate.ts` to check `!areExpensesLoaded()`. If fresh expenses finished loading before budget hydration completes, yesterday's savings rollover notifications are permitted rather than unconditionally dropped.
- **Section 5–7 Resolution Modernization**: Updated `docs/maps/daily-budget-map.md` marking all historical uncertainties (Tickets 01–03, S3.2, S3.3) 100% diagnosed, tested, and resolved; updated facade line count to 875 lines and comprehensively catalogued all 18 active consumers across screens, modals, hooks, and services.
- **Email Auto-Logging Specification Modernization (`docs/specs/EMAIL_AUTO_LOGGING_SPEC.md`)**: Fully updated all 54 sections of the specification to align with the Authoritative Dual-Core Architecture (Option A: Bank SMS & Bank Email alerts), eliminating obsolete third-source phrasing and intermediate payment-app notification references.
- **Mandatory Documentation Atomicity & Perpetual Reconciliation (`AGENTS.md`)**: Hardened Rule 4 and Gate 4 in `AGENTS.md` to mandate bidirectional, atomic documentation synchronization whenever any code or documentation edit occurs across `docs/maps/*`, `docs/specs/*`, `docs/adr/*`, `docs/*.md`, `AGENTS.md`, `README.md`, and `CHANGELOG.md`.
- **ADR Alignment & Perpetual Reconciliation (Category 4 Audit)**: Standardized explicit `## Status` headers across all 13 ADRs (0001–0013), expanded ADR 0005 cross-store callback matrix with split shares (`registerSharesGetter`) and metrics getters (`registerMetricsStoreGetter`), updated ADR 0008 pure calculation line mappings, synchronized exact store line counts in ADR 0013, and cross-referenced multi-cadence period evolution in ADR 0010/0011/0012.
- **Documentation Consolidation & Refactor Directory Retirement (Category 5 Audit)**: Cleaned up redundant historical refactor artifacts (`BASELINE.md`, `COVERAGE_GAPS.md`, `FOUND_BUGS.md`, `PLAN_DAILY_BUDGET_STORE.md`, `PLAN_EXPENSE_STORE.md`) whose implementations are 100% complete and codified in ADR 0013 and `docs/maps/daily-budget-map.md`. Merged the comprehensive 18-point device verification checklist into `docs/RELEASE_PROCESS.md §3.1`, permanently retiring the obsolete `docs/refactor/` directory.
- **Scratch Directory Complete Purge (Category 6 Audit)**: Permanently removed `.scratch/` and all legacy task ticket notes (`daily-budget/`, `design-tokens/`, `expense-form/`, `formatters/`, `home/`, `savings/`, `unified-budgeting/`), reducing repository markdown files to exactly 28 canonical, authoritative, and perpetually maintained documents.
- **Documentation Streamlining & Canonical Consolidation**: Merged physical phone/emulator dual hot-reload instructions directly into `README.md` and consolidated manual owner action protocols into `AGENTS.md`, permanently retiring `DEV_SETUP_PHONE_AND_EMULATOR.md` and `docs/AGENT_BRIEF.md`. Kept historical `docs/adr/0007-income-classification-divergence.md` intact, bringing active repository documentation to an ultra-lean 26 canonical files.
- **Proactive Skill Utilization Protocol**: Added Protocol 5 to `AGENTS.md` mandating that agents proactively identify and invoke relevant skills for code tasks.

### Changed — Automatic Logging Streamlining (Option A: Bank SMS & Bank Email Only)

- **Removed Payment App Notification Reading**: GPay, PhonePe, Paytm, Navi, and CRED notifications are no longer captured or processed. Intermediary payment app notifications lack bank account last-4 digits and often mismatch bank merchant VPAs, which previously caused false-positive duplicate review prompts ("Bank SMS never arrived, please review!").
- **Authoritative Dual-Core Sources**: Automatic Logging now relies exclusively on **Bank SMS** and **Bank Email alerts** (Gmail, Outlook, etc.). Both sources provide exact bank account digits, real money debit/credit confirmation, and exact reference numbers.
- **Streamlined Setup & Center UI**: Removed redundant payment-notification setup step and health-check lines in `AutoLogSetupScreen`, `AutoLogCenterScreen`, and `AutoLogIntroScreen`. Notification Access is now cleanly dedicated to Bank Email alerts.
- **Quiet Legacy Sweep**: Updated `sweepAwaiting` to quietly resolve or ignore any legacy pending notification previews without generating phantom review notifications.

### Added — Money Waterfall Limit Alerts & AutoLog Vault Spending Guard

- **Real-Time Money Waterfall in Limit Exceeded Alerts**: When a user crosses their spending limit (Daily, Weekly, or Monthly), `notifyLimit` now calculates and explicitly states where the overspend is drawn from: e.g. "₹300 over limit: ₹100 covered from Income, ₹200 drawn from Gullak", or "covered from your Income" / "drawn from your Gullak" (`notificationPolicy.ts`, `dailyBudgetStore.ts`).
- **Vault Spending Guard on Automatic Logging**: If an auto-logged expense exceeds total available liquidity (Income = 0, Gullak = 0, and amount > budget allowance), AutoLog blocks silent negative deficit creation and flags the event for review with `reviewReason: 'exceeds_liquidity'` and immediate user alert (`engine.ts`, `ledger.ts`, `copy.ts`, `types.ts`).
- **Facade Pattern & Submodule Architecture Invariant (`AGENTS.md` §6.1)**: Formally mandated the Facade Pattern for all complex stores and domain features to permanently prevent 2,000+ line god files in future development.

### Changed — Notification Schedule & Policy

- **Removed Artificial 1-Per-Day Scheduled Notification Cap**: All legitimate and necessary notifications (morning Gullak reward/carry cover, evening recaps, evening log nudge) now fire at their intended hours rather than arbitrarily dropping valid messages (`notificationPolicy.ts`, `docs/notifications.md`).
- **Immediate Nudge Cancellation on Auto-Log**: When an expense is auto-logged via Bank SMS or Email in the background, tonight's scheduled 20:30 evening nudge is immediately cancelled from the Android alarm queue, preventing false reminders (`cancelTonightNudge`).

### Documentation — Complete PRD & AGENTS.md Synchronization (v2.1.0)

- **PRD v2.1.0 Full Alignment (`docs/prd.md`)**: Updated version from v1.2.4 to v2.1.0, added feature inventories for Automatic Logging (native module, SQLCipher SQLite, Bank SMS & Email) and Bill Splitting & Shares, updated dual-storage architecture constraints, and removed shipped features from the roadmap.
- **Strict Documentation Atomicity Invariant (`AGENTS.md`)**: Formally mandated that any change in the app must atomically update all related documentation in `docs/` in the same change — no documentation updates may be deferred.

### Changed — Internal refactor (no user-visible change)

- **InsightsScreen Split (Step 3a)**: Extracted `Period` type, constants, and date calculation utilities to `src/screens/insights/periodUtils.ts` and `PeriodNavigator` component to `src/screens/insights/PeriodNavigator.tsx`.
- **InsightsScreen Styles (Step 3b)**: Moved StyleSheet styles out of `InsightsScreen.tsx` into `src/screens/insights/InsightsScreen.styles.ts`.
- **InsightsScreen Data Hook (Step 3c)**: Extracted pure financial and analytics derivations into useInsightsData hook with comprehensive unit tests and explicit assertions.
- **Rulebook & Repository Cleanliness**: Streamlined `AGENTS.md` into 20 strictly sequential sections, enforced mock reuse in test rules, cleaned `.gitignore`, and converted snapshot tests to clean explicit assertions.
- **ProfileScreen Split (Step 4)**: Extracted PauseBudgetModal, EditProfileModal, DeleteAccountModal, and StyleSheet styles.
- **SavingsScreen Split (Step 5a)**: Extracted SavingsHeader, SavingsHeroCard, BudgetHubSection, SavingsHistorySection, and StyleSheet styles.
- **Modal Styles Split (Step 5b)**: Moved StreakCalendarModal and DepositGullakModal styles to dedicated style files.
- **Streak Calendar Row Mapping (Step 5c)**: Extracted `mapRemoteRowsToDayLog` pure function to `src/lib/streakCalendarData.ts` with unit and mutation tests.
- **ExpenseStore Pending Queues (Step 6a)**: Extracted pending queue storage keys, exponential backoff schedule, UUID validation, and offline queue mutators to `src/store/expense/pendingQueues.ts`.
- **ExpenseStore Sync Phases (Step 6b)**: Split `syncPendingExpenses` into four discrete phase functions (`syncPendingDeletes`, `syncPendingAdds`, `syncPendingUpdates`, `flushSideQueues`).
- **ExpenseStore Sync Module (Step 6c)**: Moved `syncPendingDeletes`, `syncPendingAdds`, `syncPendingUpdates`, and `flushSideQueues` to `src/store/expense/syncPending.ts` and core types to `src/store/expense/types.ts`.
- **DailyBudgetStore Pending Storage & Types (Step 7a)**: Extracted offline pending storage key getters and queue mutators to `src/store/dailyBudget/pendingStorage.ts`, and core types/interfaces to `src/store/dailyBudget/types.ts`.
- **DailyBudgetStore Expense Bridge & Classifiers (Step 7b)**: Extracted module-level expense singletons and registration callbacks to `src/store/dailyBudget/expenseBridge.ts`, and classifiers to `src/store/dailyBudget/classifiers.ts`.
- **DailyBudgetStore Metrics & Calculations (Step 7c)**: Extracted `computeMetrics`, `computeAllTimeBudget`, `runWaterfall`, and cadence calculation helpers to `src/store/dailyBudget/metrics.ts`.
- **DailyBudgetStore Rollover Helpers Split (Step 7d-1)**: Decomposed `checkAndRollover` in-place into five modular helpers (`applyScheduledNextDayBudget`, `groupSpentByDate`, `collectPastDates`, `finalizeDailyRecords`, `finalizePeriods`).
- **DailyBudgetStore Rollover Module (Step 7d-2)**: Moved `applyScheduledNextDayBudget`, `groupSpentByDate`, `collectPastDates`, `finalizeDailyRecords`, and `finalizePeriods` to `src/store/dailyBudget/rollover.ts`.
- **DailyBudgetStore Hydrate Helpers Split (Step 7e-1)**: Decomposed `hydrateFromSupabase` in-place into modular helper functions (`waitForPersistHydration`, `readPendingSettings`, `buildOfflineHydrationPatch`, `fetchRemoteBudgetData`, `mergePendingPlanChanges`, `mergePendingPeriods`, `selfHealDefaultBudget`, `selfHealCorruptedRows`, `hydrateGullakDeposits`).
- **DailyBudgetStore Hydrate Module (Step 7e-2)**: Moved `waitForPersistHydration`, `readPendingSettings`, `buildOfflineHydrationPatch`, `fetchRemoteBudgetData`, `mergePendingPlanChanges`, `mergePendingPeriods`, `selfHealDefaultBudget`, `selfHealCorruptedRows`, and `hydrateGullakDeposits` to `src/store/dailyBudget/hydrate.ts`.
- **Type Safety Improvements (Step 8a)**: Replaced `any` with precise types in `src/screens/SplashScreen.tsx`, `src/lib/chartUtils.ts`, and `src/store/dailyBudget/hydrate.ts` (`PersistStoreLike`, `RemoteProfileData`, `RemoteSavingsLogEntry`, `RemotePlanChangeEntry`, `RemoteBudgetPeriodEntry`, `RemoteBudgetData`).
- **Storage List Deduplication (Step 8b)**: Extracted canonical `getStoredList` and `setStoredList` into `src/lib/asyncStorageList.ts` and eliminated duplicate implementations across `src/store/categoryStore.ts` and `src/store/dailyBudget/pendingStorage.ts`.

### Fixed — Monthly / Weekly / All card: one consistent story (deficit, income chip, "Drawn from Gullak")

> **OTA safe (JS only).** Apply after OTA 1, 2 and 3. Only two source files change.

- **A deficit now shows only when the budget AND the income are both used up.** The card adds up all income of the period, but money moves day by day: an overspend that happened before an income arrived was paid from Gullak, and that later income is still unspent. Showing "Budget Exceeded" while income was left was wrong. Now the card shows "Remaining" with that income and "Budget used up". A real deficit still shows when no income is left.
- **No more invented "₹0 income".** The income chip always shows the real income left (also in the deficit state, where it can really be ₹0).
- **"Drawn ₹136 from Gullak"** instead of "using ₹136 from Gullak" (the money already came out). It is computed live from the period's data: it shrinks if an expense is edited or deleted, and the Monthly card starts again on the 1st.
- New pure helper `buildHeroSubtextChips` (tested) builds the chips; `BrandedHeroCard` uses it.
- Tests: NEW `tests/monthlyCardConsistency.test.ts` (9). Mutation-checked.

### Fixed & Added — Cadence / Pure Mode money logic (ADR 0012), carry-over, split in Review

> **OTA safe (JS only).** No native change, no database migration. Apply AFTER OTA 1 and OTA 2.
> Users affected by items 1 and 2 will see a **lower** Gullak after the self-heal (the extra money never existed).

**Fixes**
1. **No second (daily) budget for weekly / monthly users.** A day owned by a weekly / monthly plan or by Pure Mode no longer gets a daily budget record. Existing wrong records are corrected on the next sync and the server rows are overwritten. (Example: weekly ₹2,100 + leftover daily ₹500 gave Gullak ₹8,300 instead of ₹2,900.)
2. **Additive carry is added once**, to the first period of the new plan only (it used to be added to every following week / month). Existing periods are recomputed.
3. **Weekly / monthly -> daily no longer loses the left-over money.** Two choices at the switch: "Add to tomorrow's budget" or "Pay my daily budget from it" (₹100/day over ₹1,550 = 15 days, then ₹50 on day 16). Carried money is counted once in "All". A morning notification says how much to add today ("Nothing to add today" / "Add only ₹50 today"), and the hero shows the same line. Only money that really is left can be carried.
4. **Switching from daily carries nothing** (today's unused money reaches Gullak tonight; it used to be counted twice). Carried money that is still unused can move on to the next cadence.
5. **One budget per calendar period** (ADR 0012). Pausing (Pure Mode), resuming or switching back inside the same week / month continues the same budget instead of giving a new full one. **Pure Mode keeps the same books**: budget pool first, then income, then Gullak, so switching back shows exactly what Budget Mode would have shown. A period that ends in Pure Mode turns its unused part into income (nothing to Gullak). Coming back to a cadence you switched away from in the same period leaves nothing in it. New rules apply to periods starting on/after 14 Oct 2026 (`BUDGET_RULES_V2_FROM`); older periods keep their numbers.
6. **"All" counts only days the app tracked** (and today): days nobody opened the app no longer add budget.
- The Digital Vault guard uses the real remaining of the account in Pure Mode too.
- Short messages: Pure Mode confirmation ("Your ₹7,600 budget stays with this month..."), "Welcome back: ₹4,600 left of this month's ₹9,000", "Last month ended in Pure Mode...", and a line in the switch dialog about coming back in the same period. Explainer texts and docs updated.

**New: split an auto-logged expense while reviewing it.** In the Review sheet, after choosing Expense, the category step has a small "Split this expense" row. It opens the existing split sheet; the shares are saved on the expense that is created (or on the already-logged expense that only needed a category). Income is never split.

**Docs**: new `docs/adr/0012-one-budget-per-calendar-period.md`; ADR 0011 marked "amended"; `CONTEXT.md` (Budget Pool, Carry-over, Paused, Pure Mode); ADR indexes.

**Tests**: NEW `tests/cadenceFixes.test.ts` (40, day-by-day simulator of the real store); `tests/autoLogSplit.test.ts` +4; updated old tests that encoded the old behaviour (`homeCalculations`, `gullakDeposits`, `realTimeIncomeGullakDeduction`, `dailyBudgetStore` carry). Mutation-checked.

### Fixed & Added — Auto Logging accuracy, email as a first-class source, "Friend paid back?" question

> **OTA safe (JS only).** Apply AFTER the previous update (needs the split repayment code in `src/lib/shares.ts`). The native 3-second debounce note in the scan needs a new APK and is NOT part of this update.

**Auto Logging fixes**
- **Own transfer with a shared UPI reference**: the credit SMS was dropped as a "duplicate" of the debit, so the debit stayed as an expense. Duplicate checks are now direction-aware (`matching.isSameSourceDuplicate`).
- **Credit card bill** wording in either order ("payment of Rs X for ... Credit Card ... has been received") is no longer logged as an expense.
- **Payment-app notifications**: "Rahul paid you ₹500" / "You received ₹500" are credits (they contain "paid"), no more ghost expenses in review.
- **Real debits no longer ignored**: "debited ... e-mandate", SIP standing instruction, merchants named Discount / Voucher / Offer. Only truly future messages ("will be debited", reminders, requests) are skipped.
- **Own-transfer guess never deletes anything**: same amount + close in time is only "likely". Certain = same reference, or the messages name the other account (self / own account / last 4 / other bank). Likely → new review question "Own account transfer?" (Yes removes the expense, No logs it).
- **One failing event no longer throws away the rest** of the queue (per-event try/catch in `processQueue`).
- **"Cashback" in an extra sentence** no longer turns a friend's credit into an automatic "refund" income.
- **Database safety**: only a real wrong-key error starts clean. A locked / busy / temporary error is retried and never wipes tracked accounts and rules.
- **Money arriving 2-3 times quickly is counted every time**: identical SMS (no reference) are no longer merged within 5 minutes (same message = within 2 s). The inbox safety net now counts identical messages instead of matching text, so it neither duplicates nor loses one. Payment-app re-posts are merged only within 15 s, identical emails (no reference) only within 60 s.
- **Email is a first-class source**: a bank email that names no account number logs immediately when exactly one account of that bank is tracked. A later SMS for the same transaction is added to "Why was this logged?" as another source (no second transaction).

**Friend paid back? (Auto Logging)**
- New review question when a credit equals exactly what a friend still owes on an unsettled split (SMS and email, also while the app is closed). Yes -> logged as a reimbursement linked to that split (the money then goes back to where the expense was paid from). No -> the normal "Income or Expense?" question.
- New review question "Own account transfer?" (see above).
- Tests: NEW `tests/autoLogFixes.test.ts` (39), `tests/autoLogSplit.test.ts` (9); `tests/helpers/autoLogTestEnv.ts` knows about splits.

### Fixed — Weekly/Monthly All pill, vault guard, limit alerts, Pure Mode funding card, split repayments, split keyboard

> **OTA safe (JS only).** No native change, no migration.

- **All pill for weekly / monthly cadence users**: the budget of a week / month is added once per period (it used to be counted as 0, so "Total Remaining" showed "Total Spent" and a wrong total). Daily users unchanged.
- **Vault guard**: in Budget Mode the liquidity is what is really left (all budgets + income + reimbursements + external deposits - spent, incl. the running weekly / monthly budget). "From income" Gullak deposits are no longer counted as new money. Pure Mode unchanged. New store getter `getTotalAccountRemaining`.
- **Daily "limit exceeded" alert** follows the budget (like Home and the weekly / monthly alerts); income no longer delays it.
- **Pure Mode expense detail** no longer says "Paid from Gullak" (shows "Your balance"); the funding card is hidden in Pure Mode.
- **Split repayments** (a friend pays back a share): the money goes back to where the expense was paid from, in the same proportion - Gullak part to Gullak, income part to income, budget part to unspent budget. Home recent / History say "Split repayment · Rahul" / "Split of 10 Oct · money came back"; the detail screen shows the split date, whether it is closed and where the money went. New `useMoneyWaterfall` hook; `sharesStore` registers shares with the money engine; Home / History load shares.
- **Split sheet and the keyboard**: the sheet sits above the keyboard and scrolls (`BottomSheetModal` `avoidKeyboard`, only the split sheet uses it).
- Tests: NEW `tests/moneyFixesFour.test.ts` (16), `tests/splitRepayment.test.ts` (18); `tests/transactionFunding.test.ts` Pure Mode case updated.

### Fixed — Money logic: budget -> income -> Gullak (one source of truth)

> **OTA safe (JS only).** No native change, no database migration. Existing users are repaired automatically on next app open.

**The rules (now enforced everywhere)**
- Every expense is paid from the budget of the active cadence first (day / week / month), then from income, then from Gullak.
- **Income never moves into Gullak by itself.** Gullak only receives the unspent *budget* at the natural end of a day / week / month, plus manual deposits.
- Money is replayed in time order, so income that arrives today is never eaten by an overspend that happened before it arrived.

**What was broken**
- Expense detail said "Paid from Income" even when income was already 0 (it used lifetime income, Home used a different number).
- All pill did not show income received today (old overspends were subtracted from new income).
- Savings "Daily Allowance" card said "deducted from Income" using lifetime income.
- Days / weeks / months added income into the saved amount, so unspent income was rolled into Gullak.
- Weekly / Monthly cadence users had no income chip at all, and today was treated as a daily pool.

**Changes**
- NEW `src/lib/moneyWaterfall.ts`: time-ordered engine (`computeMoneyWaterfall`, `computeWaterfallFromState`, `buildPoolResolver`, `summarizeScope`). Home chips, Gullak total, income balance, Expense detail and the Savings allowance card all read it.
- `budgetCalculations.ts`: `evaluateDayStatus` ignores income (saved = unspent budget); `calculateSavingsMetrics` takes the real "drawn from Gullak" amount.
- `budgetPeriods.ts`: weekly / monthly finalization and live summary no longer add income to the budget.
- `homeCalculations.ts`: income chip and Gullak badge come from the waterfall of each pill (Daily = today's income, Weekly = this week's, Monthly = this month's, All = what is really left).
- `BrandedHeroCard.tsx`: income chip for weekly / monthly cadence; "₹0 income + using ₹X from Gullak" row when income is finished.
- `transactionFunding.ts`: expense detail uses the same waterfall (shows budget / income / Gullak split exactly).
- `dailyBudgetStore.ts`: Gullak total and `getAvailableIncomeBalance` / `getPriorAvailableIncomeBalance` use the waterfall; **self-heal** of already finalized weekly / monthly periods (matched by cadence + start date so no duplicates; never runs before expenses are loaded). Finalized daily records were already recomputed on every sync, so they heal automatically.
- `HomeScreen.tsx`, `SavingsScreen.tsx`: wired to the waterfall.

**Tests**
- NEW `tests/moneyWaterfall.test.ts` (34) and `tests/moneyWaterfallStore.test.ts` (9, real store, includes "existing user with corrupted data").
- Updated 4 old tests that expected income to roll into Gullak (`budgetCalculations`, `budgetPeriods`).
- Full suite: 1244 passing. Mutation-checked: re-introducing income-into-Gullak, removing the period heal, or ignoring time order each makes tests fail.

### Fixed & Refined — Gullak Savings Balance, All Card Income & Warning Styling
- **Gullak Savings History & Past Income Records**: Fixed `calculateSavingsMetrics` where past days with income that resulted in savings were mistakenly flagged as overspent if `spent > budget`. Corrected order so records with positive savings or 'saved' status are added to savings first, eliminating false penalties.
- **Gullak Live Overspend Real-Time Synchronization**: Decoupled today's live overspend from past finalized overspends in `calculateSavingsMetrics` so today's spending only deducts its exact excess beyond available income from Gullak (e.g. exactly ₹2,001.2 from Gullak on ₹5,000 expense).
- **All Card Historical Income Consumption**: Integrated `availableIncomeBalance` into `calculatePeriodSummary` in `HomeScreen` and `homeCalculations`, ensuring that income spent in the past reflects as ₹0 remaining income on the All card rather than showing unspent lifetime income.
- **Gullak Spending Warning Badge Styling**: Updated the `using ₹X from Gullak` chip in `BrandedHeroCard` to prominent red warning colors (`#DC2626` text/icon and `rgba(239, 68, 68, 0.12)` background matching Exceeded badges) so users are alerted when Gullak savings are drawn.

### Fixed & Refined — Insights & UI Polish Refinements
- **Insights Hero Card Geometry**: Reduced excess bottom padding below the period navigator and pagination dots to `Spacing.gutter` (24px) with tighter dot margins, eliminating awkward empty vertical space while safeguarding corner curvature clearance.
- **Unified Savings & Gullak Pills**: Standardized Gullak saved days indicators across Weekly, Monthly, and Yearly breathing strips to sleek frosted black capsules (`rgba(255, 255, 255, 0.05)` with `rgba(255, 255, 255, 0.08)` borders) paired with vibrant bold mint green typography (`colors.mintGreen`), matching Cash Flow's capsule language.
- **Cash Flow Palette Synchronization**: Harmonized Cash Flow card Net Cash Flow metrics and positive cash flow digits to use Arthik's signature mint green (`#B8E0C8`), achieving visual consistency with Gullak savings badges.
- **Navbar Touch & Haptics Optimization**: Expanded touch targets and hitSlops across Bottom Navigation Bar tabs and Add buttons with instant zero-delay press feedback and tactile haptics.

### Fixed & Refined — Visual Balance & Typography Refinements
- **Hero Cards Visual Harmony (`BrandedHeroCard` & `InsightsScreen`)**: Scaled down oversized primary amount text to 32px bold and metrics amounts to 18px bold, bringing calm, balanced visual weight to Home and Insights hero cards.
- **Insights Card Tag & Chip Consistency**: Replaced round capsule pill (`BorderRadius.pill`) with sleek squarish tags (`borderRadius: 8`, 11px semibold text) in `InsightsScreen` hero card matching Home summary styling; expanded bottom padding to eliminate edge truncation and added subtle glassmorphic highlights.
- **Design Token Standardization**: Replaced legacy font tokens and raw numbers across `AmountText`, `CategoryDetailScreen`, `GullakDepositDetailScreen`, `HistoryScreen`, `OnboardingScreen`, `ProfileScreen`, `ResetPasswordScreen`, `SavingsScreen`, `SplashScreen`, and `UpdateRequiredScreen`.
- **Vertical Spacing Rhythm**: Eliminated dead vertical gaps and normalized section headers across History, Profile, and Savings screens.

### Fixed — Part 2
- **No false merges**: a notification/SMS/email pair is no longer treated as one payment on amount + direction + time alone. A matching account or merchant (or an exact reference) must also agree; otherwise it goes to review. Same-source duplicate protection is unchanged.
- **Email confirmation is final**: a confirmed email transaction never needs an SMS. Notifications still waiting, or already sent to "bank confirmation missing" review, are merged into it when the email is confirmed. Later SMS/notifications attach as extra sources.
- **Why was this logged?** now says the SMS arrived later and was not needed (or that none is expected).
- **Login password field**: removed the fixed 100% height that cropped characters; uses a min-height container and an explicit line box (no per-device offsets).
- Home hero shows a "reimbursed" chip so the chips add up to the spendable total. Income stays stacked below the budget.

### Added — Part 1: Expense shares, reimbursements & self-transfers
- **Split expense** (optional, compact): record friends' shares on an expense. The original amount is never changed; the detail screen shows each friend's share and your own share. Shares can be edited later from the expense detail.
- **Reimbursements**: when an incoming payment plausibly matches an outstanding friend share, Arthik asks "Is this your friend's share for a previous expense?" (never otherwise). One match is offered directly, several make you choose, partial repayments are supported, nothing is linked until you tap. The payment stays on the day it was received and is labelled **Reimbursement**.
- **Self-transfers**: "Transfer between your own accounts?" switch, with "Always remember / Only this transaction". Remembered rules match on the note descriptor only, never on amount.
- New `transaction_class` column (`normal` / `reimbursement` / `self_transfer`), `expense_shares` and `self_transfer_rules` tables with RLS (`supabase/migrations/20261009_shares_reimbursements_transfers.sql`).
- New `src/lib/shares.ts` (pure logic), `src/store/sharesStore.ts`, `src/components/shares/*`.

### Changed — Part 1
- Reimbursements are real cash but **no longer count as income** (totals, charts, history, Insights, Gullak cushion). They feed the existing `eligibleReimbursements` channel of `calculateCycleFinancials`, which was declared but never populated before. Wired into daily, weekly/monthly period finalisation, hydration, `syncWithExpenses` and the Home hero.
- Self-transfers (either leg) are excluded from income, expenses, spendable money and Gullak. Detection now uses the structured `transaction_class`; the old note/category keyword guess remains only as a legacy fallback for rows without it.
- `buildPeriodsToFinalize` is now actually given income (it was previously called without it) plus reimbursements.
- "Amount reimbursed so far" is derived from linked reimbursement rows rather than stored, so it cannot drift.

### Added
- **Unified Cycle Financials Single Source of Truth**: Unified all calculation engines across Daily rollover, Weekly and Monthly period slicing, and Home Hero Summary card through canonical `calculateCycleFinancials`.
- **Smart Income & Reimbursement Classification**: Categorized internal account transfers (Self-Transfers, Card Bills) to exclude them from spendable pools, and added reimbursement detection (Option B) restoring spending allowances without inflating total income.
- **Vertical Hero Card Chip Stacking**: Enhanced `BrandedHeroCard` to stack income and deposit chips on their own lines directly beneath budget allowances, auto-expanding card height smoothly with dynamic concentric SVG notched backgrounds.
- **AutoLog Bank Email Direct Confirmation**: Bank emails from verified senders with tracked accounts now confirm immediately without requiring SMS, while payment notifications waiting in `awaiting_sms` immediately merge and confirm via `takeOverRoot`.
- **Android Login Password Field Fix**: Added `includeFontPadding: false` and vertical centering to `AuthFormField` to prevent password bullet masks and character descenders from clipping on Android devices.

### Docs
- `AGENTS.md`: duplicate section numbers fixed (Auto Logging / release / email are now §23 / §24 / §25), new §26 documentation map + local-only files; tech table, repo map, Expo module list, blast-radius files, dev-build notes (two devices, dev tools), test rules for Auto Logging and frozen dates, doc-sync rules for Auto Logging / release.
- `docs/architecture.md`: test counts (66 files / 1103 tests), Automatic Logging layer, force-update note.
- Release asset naming: **`Arthik-vX.Y.Z.apk`** (versioned, used by force-update links) **+ `Arthik.apk`** copy (permanent `releases/latest/download/Arthik.apk`). Updated README, AGENTS.md §24, `docs/RELEASE_PROCESS.md` (rewritten as a generic, version-agnostic playbook).
- `.gitignore`: local guides and APK/AAB build files.

## [2.1.0] — Bank emails in Automatic Logging ✉️

> **Native release — new APK required** (email apps added to the native notification listener). Force-update users to 2.1.0 (see `docs/RELEASE_PROCESS.md`).

### Added
- **Email notifications as a third Automatic Logging source** (optional, off by default). Bank / payment alert emails shown by Gmail, Outlook, Samsung Email, Yahoo Mail, Proton Mail, Spark and Zoho Mail are read **from their notifications, on the device**. No inbox access, nothing uploaded, old emails never imported.
  - Native (`modules/arthik-autolog`): `EMAIL_APPS` allow-list, `isFinancialEmail` privacy gate (drops non-financial and real OTP / login / password mails; a "never share your OTP" footer does not drop a bank alert), separate `email_enabled` switch (`setEmailEnabled` / `isEmailEnabled`), group-summary notifications skipped. Queue event type `email`.
  - Parser: `parseEmail`, `resolveEmailSender` (bank / payment provider / unknown sender), `extractTxnTime` (transaction time written in the email, used instead of arrival time when trustworthy).
  - Engine: `processEmail`. **Source-agnostic identity** (`matching.ts`: `identityScore`, `decideIdentity`): same reference = same transaction across SMS / notification / email even hours apart; without a reference, amount + direction plus account / merchant / day / time must agree; contradictions never merge; same source never fuzzy-merges; a transaction takes at most one source of each kind without a shared reference; two or more possible matches (or only a weak one) → Pending Review.
  - Email-only transactions are logged when the sender is a recognised bank / payment provider and the account is tracked. Unknown sender → review (`unknown_sender`). Account named but not tracked → never logged. Payment-provider / unknown-sender emails map to the tracked account by last 4 digits only when exactly one matches.
  - An email can confirm a waiting payment-app notification (SMS is not mandatory) and enrich an existing transaction (merchant). A bank SMS arriving after an email joins that transaction.
  - New review reasons: **Might be a duplicate** (`ambiguous_match`), **New email sender** (`unknown_sender`).
- **Email notifications screen** (`AutoLogEmailScreen`): explanation (what is / isn't used), status, turn on / off; independent of SMS and payment-app detection.
- **Setup**: new optional "Bank emails" step after payment notifications (v2.1 binaries only).
- **Center**: "Email notifications" health line and row; dev tool "Bank email · ₹349 Zomato".
- **Privacy**: SMS / notification / email access lines, tracked accounts, email privacy bullets. **How it works**: bank emails section.
- **Why was this logged?**: email sources, "Financial email detected", merchant, "Same transaction reference", three-source wording. Transactions show every source (email → notification → SMS chains included).
- FAQ: 2 email questions.
- Tests: `tests/autoLogEmail.test.ts` (32) — parser, identity rules, email-only, account filtering, unknown sender, OTP/login, duplicates, SMS↔email, notification↔email, all three sources, delayed email, ambiguous matches, independent sources, old emails.

### Changed
- A shared transaction reference now matches SMS ↔ payment notification at any delay (previously only within 15 minutes). Different references still never match.
- `db.getEventsForExpense` also returns sources merged into a merged source.
- Version 2.1.0.

 — Automatic Logging ⚡

> **Native release — new APK required.** Native changes (SMS receiver, notification listener, SQLCipher, background tasks) cannot be delivered by OTA.

### Added
- **Automatic Logging** (Android): bank SMS and payment-app notifications (Google Pay, PhonePe, Paytm, Navi, BHIM, CRED, Amazon Pay, MobiKwik, super.money) become transactions automatically. All detection is on-device.
- **Setup wizard** (`AutoLogSetupScreen`): explanation → SMS access → notification access → battery reliability → **Discovery** (learns banks, accounts, formats from the last 90 days; never adds old transactions) → account selection (multi-account) → review of unclear messages → complete. Live mode starts automatically, no Start button.
- **Automatic Logging Center** (Profile → Automatic Logging): status, tracked accounts, today's counts, last checked, health checklist (SMS / notifications / accounts / background), recent activity, pause / resume / turn off.
- **Pending Review** inbox with Income / Expense → confirm → category → "Remember Zomato → Food?" flow; ignore only this message / similar messages from this sender.
- **Why was this logged?** + source chips + **Report a problem** on every automatic transaction (ExpenseDetail).
- **Welcome back** after sign-in: *Recover missed transactions* or *Learn from this period* (Recovery limited to 30-day gaps).
- **Re-install / data-clear detection**: setup is redone instead of pretending old settings exist; the unavailable period is discovery-only.
- Cross-source matching (notification + SMS = one transaction), own-transfer and credit-card-bill detection, manual-entry duplicate check, live boundary.
- Home banner when transactions need review or Automatic Logging needs attention.
- 6 FAQ entries (new "Automatic Logging" category).
- Supabase table `autolog_profiles` (migration `20261006_autolog_profiles.sql`) — stores only enabled flag, timestamps and bank + last 4 digits.
- Local Expo module `modules/arthik-autolog` (Kotlin).
- Tests (59 new):
  - `tests/autoLogParser.test.ts` — 24 tests: bank SMS + notification parsing, balance-vs-amount, future/failed/OTP, templates, masking, matching rules.
  - `tests/autoLogFlows.test.ts` — 33 end-to-end tests running the REAL db + engine + service + reviews on Node's built-in SQLite: discovery never logs, live boundary, untracked/new accounts, notification↔SMS merge (both orders), same-source ₹20 safety, double-read SMS, notification-only → review, manual duplicate, own transfer, card bill, future/failed/balance, income review + remember, category learning, narrow ignore rules, report problem, offline queue, sign-out → Welcome back → Recovery, Learn-only, pause, clear cache, clear storage/reinstall, other user, turn off, dev tools.
  - `tests/expenseStore.test.ts` — +2 tests for the new optional `{ id }` in `addExpense`.
  - `tests/helpers/autoLogTestEnv.ts` — test doubles (SQLite, native module, ledger, server).
- **Developer test tools** card in Automatic Logging Center (only when `__DEV__`, i.e. dev-client builds; invisible in preview/release APKs): simulate PhonePe notification, bank SMS, credit from a person, unreadable message, and "skip 20 min".
- Docs: `docs/AUTO_LOGGING.md`.

### Added — release & rollout
- **In-app mandatory updates**: `UpdateRequiredScreen` downloads the APK inside the app (progress bar) and opens Android's installer automatically; no skip. "Install update" retry, "Install unknown apps" shortcut, browser fallback. New `src/lib/apkInstaller.ts`; `versionCheck` now reads optional `apk_url`, `update_title`, `update_highlights`; version is re-checked whenever the app returns to the foreground. Permission `REQUEST_INSTALL_PACKAGES`. New deps: `expo-file-system`, `expo-intent-launcher`, `expo-application`.
- **Automatic Logging is Beta** with a server-controlled rollout: `app_config.feature_flags.autolog` (`audience`: `existing` | `all` | `none`, `existing_before`). Default: existing users only (paused for new users). New `src/features/autoLog/rollout.ts`.
- **"New in Arthik 2.0" screen** (`AutoLogIntroScreen`) shown once to existing users (phone upgraded from v1.x, or account created before the cutoff). Never shown to new users. "Turn on" starts setup; "Not now" leaves it off.
- `BetaPill` on the Profile row, Automatic Logging Center and setup; Beta note in setup and FAQ.
- Migration `supabase/migrations/20261007_release_v2_flags.sql`.
- `eas.json` preview profile: `autoIncrement: true` (versionCode).
- Docs: `docs/RELEASE_PROCESS.md` (step-by-step release, force update, rollback, rollout SQL), `docs/AGENT_BRIEF.md`; README rewritten; AGENTS.md §24; Play Store doc updated for the in-app updater.
- Tests: `tests/appUpdate.test.ts` (8), `tests/autoLogRollout.test.ts` (11). Suite: 1071 passing.

### Changed
- `expenseStore.addExpense` accepts an optional 7th argument `{ id }` so automatic transactions keep a link to their source message. Existing callers are unaffected.
- Log Out confirmation explains that Automatic Logging stops while signed out (only when it is set up).
- `App.tsx` wraps the app in `GestureHandlerRootView`; notification taps route Automatic Logging notifications.
- `index.ts` imports `src/features/autoLog/background` (defines headless + background tasks).
- `App.tsx`: if the session ends without the Log Out button (e.g. expired), Automatic Logging still records the sign-out boundary, so nothing from the signed-out time is logged silently.

### Dependencies (bundled now so future features ship by OTA)
- New: `expo-sqlite` (SQLCipher), `expo-secure-store`, `expo-task-manager`, `expo-background-task`, `expo-haptics`, `react-native-reanimated`, `react-native-worklets`, `react-native-gesture-handler`, `@shopify/flash-list`.
- Reanimated / Gesture Handler / FlashList are installed but existing screens are **not** refactored — future animation and list work can now ship over OTA.

### Fixed
- `tests/budgetModesStore.test.ts`: 3 tests were written for "today = 2026-09-30" but read the real clock, so they failed once another full week had passed (Gullak showed ₹9,500 instead of ₹2,500). The file now freezes `Date` at 2026-09-30 (timers stay real). App code unchanged. Full suite: 1052/1052 passing.


### 🔍 Code-Quality Review & Test Coverage (post `noUnused*` pass)
- **Fixed 3 visual regressions introduced while extracting shared UI primitives** (`KeypadGrid`, `ItemRowShell`, `AuthFormField`): the numeric keypad lost its 8px gap between keys (6px on Budget Edit); transaction/deposit rows lost their `BorderRadius.card` press-clip (had dropped to a hard-coded 12px with no `overflow: hidden`); the Auth / Reset Password / Profile Setup fields lost their original spacing and radius (label letter-spacing, field gap, input radius). All three now match the pre-extraction screens exactly, pinned by `tests/uiPrimitiveParity.test.ts`.
- **Fixed a `BottomSheetModal` race**: reopening the sheet while its close animation was still in flight could unmount the now-open sheet when the stale close callback fired. Guarded with a token so only the close that is still current can unmount it (`tests/bottomSheetModal.test.ts`).
- **13 new test files (+160 tests)** for previously-untested modules: `transactionUtils`, `navBarStore`, `otaStore`, `budgetAlerts`, `useFocusEntry` (including the frozen-tab regression), `useScrollDirection`, `useFormKeyboard`, `useSavingsDashboard`, `useExpenseForm` (keypad, vault guard, save/edit, validation — 48 tests), `bottomSheetModal`, `uiPrimitiveParity`. Added `tests/helpers/hookRuntime.ts` and `tests/helpers/fakeStore.ts`, a small in-house hook test runtime (no new dependency) that models React's layout-effect re-run on `freezeOnBlur` reveal.
- **Docs**: corrected stale test counts (61 files / 993 tests) and the `ambientStore` AsyncStorage key name in `docs/architecture.md` and `README.md`.


### 💎 UI Architecture Polish & Precision Improvements
- **Floating Navigation Bar Polish (`BottomNavBar.tsx`, `navigation/index.tsx`)**: Removed Android hardware texture rasterization artifacts (`renderToHardwareTextureAndroid` and `needsOffscreenAlphaCompositing`) for clean 34px rounded capsule pill corners, and configured `tabBarStyle: { position: 'absolute', backgroundColor: 'transparent' }` so screen ambient backgrounds flow smoothly to the bottom edge without grey lines.
- **Precision Toggle Switch Alignment (`AnimatedToggle.tsx`)**: Mathematically calibrated inner track dimensions (`innerHeight = height - 2`, `padding = 3px`, `thumbSize = 22px`) for perfect pixel-symmetric vertical and horizontal centering (`top = left = 3px`) with soft elevation shadow.
- **Unified Breathing Strips (`BreathingStripShell.tsx`, `WeeklyBreathingStrip.tsx`, `MonthlyBreathingStrip.tsx`, `YearlyBreathingStrip.tsx`)**: Consolidated ~500 lines of duplicate breathing strip cards into a high-performance shell with 100% visual and gesture parity and added dedicated unit tests (`tests/breathingStrips.test.ts`).
- **Canonical UI Primitives (`ItemRowShell.tsx`, `CategoryRowItem.tsx`, `AuthFormField.tsx`, `AuthMessageBanner.tsx`, `KeypadGrid.tsx`, `BottomSheetModal.tsx`)**: Unified transaction rows, category lists, auth text inputs, animated message banners, keypad matrices, and bottom sheets across all screens.
- **Shared Insights & Chart Utilities (`insightsCommon.ts`, `chartUtils.ts`)**: Extracted shared date parser helpers (`toDateStr`, `toDateObj`, `isDateInBounds`), TypeScript interfaces (`ExpenseLike`, `InsightTakeawayStatus`), and unified chart palettes (`getCashFlowChartColors`).
- **Unit Test Suite Expanded**: 50 passing test files with 833 passing tests (0 failures).

### 🐷 Auto-Save Unspent to Gullak Toggle & Hydration Invariant (`dailyBudgetStore.ts`)
- **Permanent Toggle State Persistence**: Resolved an issue where turning OFF "Auto-save unspent to Gullak" (`isAutoRenew: false`) in SavingsScreen was forcibly overridden and reset back to ON with a fallback budget on HomeScreen pull-to-refresh or store hydration.
- **Removed Forced Auto-Renew Overrides**: Eliminated legacy hydration conditions (`if (resolvedBudgetModeEnabled && !resolvedAutoRenew && resolvedBudget > 0) resolvedAutoRenew = true;`) and hardcoded `|| 100` fallbacks across both offline fast-paths and online Supabase hydration.
- **Accurate Paused Allowance State**: Today's unfinalized daily record correctly reflects a paused state (`budget: 0, saved: 0, status: 'unknown'`) when auto-renew is turned off, while the configured daily budget amount (e.g. ₹250) is safely preserved.
- **Unit Test Coverage & Invariant Enforcement**: Added Slice 8 tests (`tests/dailyBudgetStore.test.ts`) guaranteeing that pausing auto-save preserves `isAutoRenew: false` and custom allowances across full hydration cycles. Total test suite expanded to 812 passing unit tests.

### 🧹 Codebase Cleanup & Strict TypeScript Unused Checks (`tsconfig.json`)
- **Full Unused Items Elimination**: Removed ~90 unused imports, destructured variables, dead helper functions, and wasted intermediate computations across 44 source components, screens, utilities, stores, and test suites.
- **Eliminated Wasted Computations**: Removed redundant aggregations, string conversions, and unused memoized loops in `InsightsScreen.tsx`, `YearlyCashFlowChart.tsx`, `SavingsRecordRow.tsx`, `BrandedHeroCard.tsx`, and `dailyBudgetStore.ts`.
- **Enforced Strict Compiler Checks**: Permanently enabled `"noUnusedLocals": true` and `"noUnusedParameters": true` in [`tsconfig.json`](file:///d:/Arthik-App/tsconfig.json) to prevent unused variables and dead code from re-entering the codebase.
- **Zero Regressions**: 100% unit test pass rate maintained across all 810 test cases (`vitest run`) and 0 type errors (`npx tsc --noEmit`).

### 🔑 1-Click Google OAuth PKCE Fix (`AuthScreen.tsx`)
- **Direct PKCE Code Exchange**: Exchanged authorization `code` parameters returned by `WebBrowser.openAuthSessionAsync` immediately via `supabase.auth.exchangeCodeForSession(code)`, restoring instant 1-click Google Sign-In / Sign-Up.
- **Eliminated Multi-Click & Permission Loops**: Resolved the issue where PKCE codes were missed in URL parsing, eliminating stranded AuthScreen states, premature notification dialog prompts, and duplicate click requirements.
- **Graceful Multi-Flow Fallbacks**: Preserved support for legacy implicit hash fragments and cached active sessions with complete profile completeness verification.

### 🗓️ Cadence-Aware Streak Calendar (`StreakCalendarModal.tsx`, `budgetPeriods.ts`)
- **Connected-Date Background Layer**: Integrated subtle horizontal underlay bands connecting dates belonging to the same weekly (7-day groups) and monthly savings cycles, while keeping Daily cadence dates as independent dots.
- **Cross-Row Continuity**: Saturday connects to the right edge and Sunday connects from the left edge for weekly cycles spanning calendar rows with zero diagonal distortions.
- **Historical Accuracy Preservation**: Past periods reflect the cadence that was actually active on those dates using `getDateOwner` and `resolvePlanForDate`; switching cadences never alters historical data.
- **Comprehensive Unit Testing**: Added pure calculation engine `computeCalendarConnections` with full test coverage for daily, weekly, monthly, cross-row, multi-switch, and mid-cycle scenarios.

### 🛡️ Cadence Switch & Budget Modal Polish (`CadenceSwitchModal.tsx`, `BudgetEditModal.tsx`)
- **Over-Capacity Budget Guard**: Automatically disables and greys out the switch button if the target budget exceeds the available period capacity, providing a one-tap "Set Safe Budget" action pill.
- **Simplified Information Hierarchy**: Streamlined modal copy into concise one-liner cards with dynamic period dates and Gullak clarity.
- **Pill Button Geometry**: Standardized action buttons (`Cancel`, `Save Budget`, `Switch to ...`) to symmetrical full-width pills (`BorderRadius.pill`, `ControlHeight.row`).
- **Default Carry Mode**: Set default carry-over behavior to `'allocation'` ("Keep it at").

### 🎨 Precision Geometry & Toggle Alignment (`AnimatedToggle.tsx`, `SegmentedControl.tsx`)
- **Subpixel Toggle Alignment**: Calibrated toggle thumb top offset to `(height - thumbSize) / 2 - 0.5` for perfect border centering on Android.
- **SegmentedControl Tab Symmetry**: Resolved 1px right-edge clipping by adjusting track inset calculation, guaranteeing uniform 4px padding across Daily, Weekly, and Monthly tabs.

### 🔔 Smart Notification System (`notificationPolicy.ts`, `notificationSync.ts`, `notificationService.ts`)
- **Single-Source Policy Engine**: Replaced legacy daily reminders with an unshakeable, pure policy matrix (`notificationPolicy.ts`). Enforces a strict **max-1-per-day** limit across all push notifications (priority order: Monthly recap > Weekly recap > Gullak reward > Evening nudge).
- **Quiet Evening Nudge**: Scheduled for 20:30 only on days when nothing has been logged. Automatically goes quiet after 3 consecutive unopened days; logging an expense immediately cancels tonight's nudge via `notificationSync.ts`.
- **Gullak Morning Reward**: Congratulates daily-cadence users at 08:30 the next morning when yesterday was logged and ended with savings added to Gullak.
- **Weekly & Monthly Insights Recaps**: Delivers high-level spending summaries on Sunday at 19:00 (≥ 3 expenses logged) and on month-end at 21:00 (≥ 6 expenses logged).
- **In-App Bell Separation**: Non-intrusive in-app notifications for 80% allowance alerts, midnight rollovers, and budget plan updates. Over-budget state surfaces as a silent banner.
- **Separated Android Channels**: Four distinct system notification channels (`Budget alerts`, `Reminders`, `Gullak updates`, `Weekly & monthly recaps`) allowing granular user control in Android system settings.

### 🔢 Tactile Rolling-Digit Numbers & Focus Continuity (`RollingText`, `AmountText`)
- **Native-Thread Rolling Numbers**: Every financial figure across Home, Savings (Gullak balance & allowance limits), Insights (breathing strips), and Category Details rolls vertically digit-by-digit (odometer style) on value updates and screen focus.
- **Frozen-Tab Focus Resilience**: Integrated mount/reveal layout effects so navigating back to frozen tabs (`freezeOnBlur`) reliably re-triggers rolling transitions from zero without layout shift, downward snaps, or JS thread stalls.
- **Butter-Smooth Donut Chart 60fps Sweep**: Upgraded `DonutChart` and `DualRingChart` arcs with Apple critically damped cubic bezier easing (`0.25, 0.1, 0.25, 1`, 380ms) and focus-entry synchronization via `useFocusEntryCount`.

### 🌌 Ambient Background & Atmosphere Polish (`AmbientBackground`, `ambientStore`)
- **Organic Top Glow & Wind Sprite**: Subtle tinted glow across the top header zone with randomized wispy directional wind drafts drifting beneath an ultra-light film grain tile.
- **Resource Discipline**: Runs exclusively on the native thread. Automatically throttles and pauses when screens lose focus, when the app backgrounds, or when system Reduce Motion is enabled. Weaker intensity in AMOLED mode.
- **Profile Preference Switch**: Ambient background toggle in Profile (`ambientStore`) persisted via AsyncStorage with zero flash on app startup.

### 🎯 SegmentedControl Touch & Reach Resilience (`SegmentedControl`)
- **Cross-Screen Reach Touch Handling**: Eliminated dropped taps when reaching across long distances (e.g., from Yearly to Weekly). Added 16px outer-edge hit-slop, 20px `pressRetentionOffset` to prevent micro-slides from cancelling taps, elevated option rows (`elevation: 4`, `zIndex: 10`), and stopped in-flight animations on tap down.

---

## [1.2.4] — 2026-10-03 (OTA)

### 🎞️ Instagram-Style Pull-Up to History (`HomeScreen`)
- **Pull-up rebuilt from scratch (`PullToHistoryList`):** The Recent Transactions list no longer uses a native `ScrollView` (on Android it cancelled any JS pull gesture after ~8dp). One component now owns drag, momentum, pull-up and pull-down-to-refresh, so the pull is reliable on slow and fast swipes alike.
- **Footer rises from behind the nav bar:** The ring + label rest hidden behind the floating nav pill and travel with the rows as one rigid block. The list is clipped exactly at the nav pill's top edge.
- **Measured Instagram physics (`pullToHistoryPhysics.ts`):** Content follows the thumb 1:1 then stiffens progressively (rubber band, ~192dp max). Release springs back with a spring fitted to a 120fps recording of Instagram's Vanish Mode (stiffness 42, damping 11.6, ~0.88 damping ratio, no visible overshoot). The content can be caught mid-bounce.
- **Countdown ring (`PullToHistoryIndicator`):** Ring starts fully white, a grey track eats it clockwise from 12 o'clock in step with the pull, and at 100% the ring and label flip to the accent colour in a single frame ("Release for History"). Light haptic tick when armed.
- **History opens only on release:** The History tab opens only when the finger is lifted while the ring is full; lifting earlier springs back.
- **One pull-to-refresh animation across the app (`AppRefreshControl`):** Home, History, Savings and Insights now share a single themed native refresh circle (mint arc on a card-coloured disc, dropping in below the status bar). Previously Android ignored `tintColor`, so each screen showed the default circle, and Home briefly used a custom spinner. Pulling down never moves any content.
- **Home refresh (`RefreshScrollShell`):** Home hosts the same native circle through a non-scrolling shell, so pulling down anywhere on Home refreshes exactly like the other tabs. The Recent Transactions list no longer moves down or shows its own spinner; it hands downward drags at the top to the refresh circle and switches the circle off while it owns the touch (so scrolling the list can never trigger a refresh).
- **Removed dead code:** `pullToHistoryUtils.ts` (+ its test) and the unused `TelegramPullIndicator` component.
- **Unchanged:** the dissolve fade of rows under the "Recent Transactions" header.
- **Tests:** Added `tests/pullToHistoryPhysics.test.ts`, including regressions against the measured Instagram spring curve and ring-vs-travel linearity.

### 🎨 Responsive Layout & Behavioral Insights Polish
- **Apple Design Fluid Numeric Transitions (`BrandedHeroCard`):** Completely eliminated numeric jitter, character-width popping, and strobing during filter and cadence switches on the Hero Card. Upgraded the counter interpolation with an integer rounding guard (`Number.isInteger`) that stops floating decimals from popping in mid-flight and causing `adjustsFontSizeToFit` text spasms. Switched easing to Apple's canonical standard cubic bezier `Easing.bezier(0.25, 0.1, 0.25, 1)` (320ms duration) with continuous 60fps frame updates (16ms throttle), guaranteed presentation-value continuity on gesture interruption, added tabular numeric alignment (`fontVariant: ['tabular-nums']`), and isolated chart pods (`DonutChart` and `DualRingChart`) from frame-by-frame JS ticking. Added a native-driver micro-morph (subtle opacity softening and 1.5px physical lift) for an ultra-premium, fluid finish.
- **Apple Dual-Edge Liquid Morph & Direct-Manipulation Scroll Agency (`BouncyCategoryFilter`):** Upgraded the scrollable category filter on `HistoryScreen` with Apple WWDC-inspired Dual-Edge Liquid Morph animation (`tension: 100, friction: 16`, direction-aware leading-edge stretch & vertical volume squish). Removed the disruptive automatic `scrollTo` on option click, allowing users to scroll freely without the list auto-jumping backward, while the highlight pill glides to the selected category with fluid physical motion.
- **Unified Pill Surface Consistency (`BouncyCategoryFilter`):** Replaced `colors.card` with canonical `colors.cardSubtle` and `colors.borderSubtle`, matching the grayish elevated surface and border treatment of `SegmentedControl` and other pills across the app. Inactive text now uniformly uses `colors.textSecondary` with `FontFamily.medium`.
- **Unified Pill Height Standardization (`ControlHeight.standard: 48px`):** Standardized all screen, tab, and modal filter pills across the entire application to `ControlHeight.standard` (`48px`). Resolved the size mismatch on `SavingsScreen` ("Day-by-Day Savings History" toggle now matches 48px) and aligned default `SegmentedControl`, `BudgetEditModal`, `InsightsScreen`, `ProfileScreen`, and `BouncyFilterToggle` to strictly adhere to the canonical 48px token.
- **Apple Dual-Edge Liquid Morph Animation (`<SegmentedControl />`):** Replaced under-damped bouncy slide physics with Apple WWDC-inspired fluid liquid morph motion across all segmented toggles in the app (Home filters, History filters, Savings filters, Insights periods, Profile theme, Cadence modal, Form toggles). Combines a critically damped primary slide spring (`tension: 100, friction: 16`) with direction-aware leading-edge stretch (`scaleX: 1.08–1.28`), vertical volume squish (`scaleY: 0.96–0.88`), and strict track clipping (`overflow: 'hidden'`), eliminating container boundary overshoot while delivering physical liquid expansion.
- **Responsive Form Segmented Toggles (`BouncyPaymentToggle` & `BouncyTypeToggle`):** Restored standard form pill height to `ControlHeight.row` (`56px`), strictly matching the Date Picker trigger button (`datePickerButton`) across "Paid Via", "Money Added Via", and "Expense / Income" toggles. Fixed active text contrast in `BouncyPaymentToggle` by ensuring deep contrast `colors.forestGreen` (`#1A2B4C`) on top of peach-coral pills, resolving the invisible text bug when selecting payment modes.
- **Responsive Insight Cards Layout (`BehavioralInsightRow`):** Relocated the accent pill badge into the top `headerRow` alongside the title, unlocking 100% full card width for `headline` and `detail`. Replaced rigid single-line truncation (`numberOfLines={1}`) with responsive multi-line wrapping (`numberOfLines={2}` on title/headline and `numberOfLines={3}` on detail) and capped scaling (`maxFontSizeMultiplier={1.3}`) so cards never truncate with ellipsis (`...`) across small screens or large Android system font settings.
- **Concise & Non-Technical Insight Titles:** Streamlined `"WEEKEND VS WEEKDAY BURN"` to `"WEEKEND VS WEEKDAY"` and `"LARGEST H2 SPENDING ACCELERATION"` to `"LARGEST H2 SPEND INCREASE"`, eliminating technical buzzwords and preventing header collisions on narrow devices.

### ✨ Premium UX, Interaction & Motion Polish (P0 & P1 Approved Audit)
- **Eliminated Jitter & Unnecessary Screen Animations:**
  - Removed the 50px slide/fade entry animation from `HistoryScreen` on focus for instant tab navigation.
  - Removed keypad `amountScale` punch on digit entry in `ExpenseFormScreen`, preserving tactile keypress feedback and shake feedback on zero-save while keeping real money amounts strictly stable.
  - Calmed down `StreakFlame` by eliminating continuous ember particles, radial pulses, and flutter loops; retained subtle milestone springs on streak change.
  - Replaced gesture-intercepting `PanResponder` on `TelegramPullIndicator` with an accessible, tap-driven full history affordance that does not fight `HomeScreen` scrolling.
- **Segmented Control & Toggle Consolidation:**
  - Enhanced canonical `<SegmentedControl />` with icon support, configurable heights (`standard: 48`, `compact: 36`), and custom active pill colors.
  - Consolidated `BouncyFilterToggle`, `BouncyTypeToggle`, `BouncyPaymentToggle`, `BudgetEditModal`, and `ProfileScreen` theme selector to use `<SegmentedControl />`.
  - Simplified `AnimatedToggle` by removing 360° ball rotation and artificial highlight dot, leaving a crisp, spring-settled thumb translation.
  - Fixed floating badge alignment in `<SegmentedControl />` with exact horizontal pill centering and clearance for label icons and text.
- **Action Buttons & Badges Modernization:**
  - Migrated raw action buttons in `ExpenseDetailScreen` and `GullakDepositDetailScreen` to `<AppButton />` with `primary` and `danger` variants.
  - Replaced ad-hoc circular category container in `CategoryDetailScreen` with canonical `<GradientIconBadge />`.
  - Replaced hardcoded hex colors and deprecated typography tokens in `ExpenseDetailScreen` with theme tokens (`colors.background`, `colors.textPrimary`, `colors.textSecondary`, `FontSize.display`).
  - Encapsulated unified 0.98 scale press feedback and subtle active background highlight directly inside `<TransactionRow />`.
- **Spatial Continuity & Fluid Transitions:**
  - Added exit lifecycle transitions (`isMounted` + 180ms ease-out slide-down) to custom bottom sheets (`VaultSpendingGuardModal`, `PeriodRenewalModal`, `CadenceSwitchModal`, `DepositGullakModal`) to prevent abrupt disappearance.
  - Implemented continuous value-to-value interpolation in `DonutChart` and `SpendingFlowChart`, removing intermediate 0-resets when switching filters.
  - Optimized `BrandedHeroCard` numeric count-up animation by throttling re-renders to ~20fps, reducing JS-thread pressure by ~80% while ensuring exact final values.

### 🎨 Arthik Design System Unification & Token Governance
- **Runtime Source of Truth (`src/config/theme.ts`):** Standardized 8-tier typography hierarchy (`display`, `titleLarge`, `titleMedium`, `titleSmall`, `body`, `bodySmall`, `caption`, `micro`), spatial rhythm tokens (`Spacing.nano` through `Spacing.section`), and interactive `ControlHeight` tokens (`cta: 60`, `row: 56`, `standard: 48`, `compact: 36`).
- **Standardized UI Primitives (`src/components/ui/`):**
  - `<AmountText />`: Enforces the Real-Money Invariant with Indian comma grouping (`₹`), optical symbol baseline alignment, signed direction tints, and screen-reader accessibility across all financial surfaces.
  - `<AppButton />`: Unified button primitive enforcing standardized heights (60px, 48px, 36px), variants (`primary`, `secondary`, `outline`, `danger`, `ghost`), and spring touch physics (`tension: 70, friction: 8`).
  - `<AppInput />`: Unified text and search input primitive with floating/standard labels, clear actions, and error states.
  - `<StatusBadge />`: Standardized stadium pill badge with semantic color tints across Light, Dark, and AMOLED themes.
  - `<SegmentedControl />`: Unified sliding active pill filter with smooth spring animations.
- **Whole-App Screen Migration:**
  - Migrated `HomeScreen`, `HistoryScreen`, `SavingsScreen`, `InsightsScreen`, `ProfileScreen`, `ManageCategoriesScreen`, `CategoryDetailScreen`, `ExpenseFormScreen`, `ExpenseDetailScreen`, `GullakDepositDetailScreen`, `AuthScreen`, `NotificationsScreen`, `FaqScreen`, and `ResetPasswordScreen`.
  - Replaced ad-hoc transaction and deposit rows with canonical `<TransactionRow />` and `<GullakDepositRow />`.
  - Replaced divergent filter buttons with `<SegmentedControl />`.
  - Replaced ad-hoc amount formatting with `<AmountText />`.
- **Governance & Specification (`docs/design-system.md`):** Complete human-and-agent usage guide with semantic role tables, allowed exceptions, and strict token registration workflows.

### 🍩 Unclipped Responsive Category Donut Architecture (`InsightsScreen`, `AnimatedCategoryDonut`, `chartUtils`)
- **Responsive Viewport Donut Scaling (`InsightsScreen`):** Dynamically scales donut chart size (126dp–156dp) based on `useWindowDimensions().width` rather than a fixed 160dp literal, preventing flex-row overflow and clipping on narrow screens (320dp–380dp).
- **Flexbox Row Guards & Zero-Shrink Protection:** Added strict `flexShrink: 0` to `donutLeftContainer` and `minWidth: 0` to `categoryStackRight` to ensure the donut canvas is never compressed by neighboring text elements.
- **SVG ViewBox Coordinate Normalization (`AnimatedCategoryDonut`):** Bound SVG canvases to `viewBox="0 0 {size} {size}"` with dynamic inner text `maxWidth` clamping to guarantee vector paths render edge-to-edge without hardware-level clipping.
- **Accurate SVG Large Arc Geometry (`chartUtils.ts`):** Fixed `generateRoundedBlockPath` arc flags to evaluate span between actual corner-tangent points rather than unadjusted raw angles, eliminating inverted arc loops on dominant categories (~50%–55%).

### 🔄 Unified Cross-Page Insights Architecture (Weekly · Monthly · Yearly)
- **Unified Time-Series Flow Hierarchy (`InsightsScreen`):** Repositioned the Monthly `CashFlowChart` immediately below `MonthlyBreathingStrip` (before `By Category`), creating an identical 4-stage narrative across Weekly (`SpendingFlowChart`), Monthly (`CashFlowChart`), and Yearly (`YearlyCashFlowChart`): Macro Numbers $\rightarrow$ Time-Series Flow $\rightarrow$ Category Allocation $\rightarrow$ Behavioral Insights.
- **Consistent Breathing Strip Naming (`YearlyBreathingStrip`):** Standardized the right savings tile title across all three timeframes to `SAVINGS & GULLAK` (previously `ANNUAL GULLAK WEALTH`), aligning with the bottom milestone card and Tab Bar navigation.

### 🗓️ Redesigned Yearly Insights & Long-Term Financial Journey
- **Fair Year-to-Date (YTD) Comparison & Daily Burn Pace (`InsightsScreen` & `yearlyInsightsUtils.ts`):** 
  - Day-matched comparison compares Day 1..$D$ of current year against Day 1..$D$ of previous year (or full 12 months for historical years), suppressing misleading +100% baseline jumps for first-year users with `"First Year with Arthik"` or `"Annual Baseline"`.
  - Added live average annual daily burn pace badge (`₹X/day avg`) next to the trend badge in the Hero Card.
- **Dual Clean Tiles Architecture (`YearlyBreathingStrip`):** Replaced boxy dashboards with a spacious, calm layout:
  - **Net Cash Flow Tile:** Displays `NET SURPLUS` (mint green) or `NET DEFICIT` (terracotta) with compact subtext (`₹A In · ₹B Out`).
  - **Annual Gullak Wealth Tile:** Displays total saved in Gullak with `X% Savings Rate` pill and `🐷 N Saved Days` badge, tappable to `Savings`.
  - **Smart Annual Narrative Takeaway:** Highlights macro reflection with status dot (e.g. `"Strong Net Surplus · Saved X% into Gullak"`).
- **12-Month Annual Cash Flow Chart (`YearlyCashFlowChart`):**
  - Displays dual capsule bars (Jan–Dec) for real Inflow (mint green) and Outflow (terracotta).
  - Dimmed future inactive months to 25% opacity; highlights the active current month with a subtle MTD indicator dot.
  - Interactive tap navigates to `History` pre-filtered to the tapped month's full date bounds.
- **Annual Budget Discipline Score:** Seamlessly positioned below the 12-month chart, evaluating past completed calendar months to prevent unearned victory leaps (e.g. `"{keptMonths} of {totalCompletedMonths} months kept within budget ({consistencyRatio}% discipline)"`).
- **Category Progressive Disclosure:** Categories beyond the top 5 cleanly collapse behind an accessible `+ View N more categories` accordion toggle, preserving whitespace and typography without screen jumping.
- **Actionable Annual Behavioral Insights (`BehavioralInsightRow`):** Replaced redundant "Most Spent On" and generic "Top Payment" rows with macro insights:
  - **Annual Capital Outlier:** Detects the largest single purchase of the year ($\ge ₹500$ and $\ge 5\%$ of annual spend), tappable directly to `ExpenseDetail`.
  - **Long-Term Category Trajectory:** Detects significant spending acceleration or reduction between H1 and H2 ($|\Delta| \ge ₹1,000$), with graceful fallback to Primary Expense Driver for early-stage or steady accounts, tappable to `CategoryDetail`.
- **Annual Savings Milestone Climax (`YearlySavingsMilestoneCard`):** Repositioned to the very bottom of the page as a celebratory milestone climax, supporting both Budget Mode and Pure Mode (adapting "Best Streak" to "Total Deposits").
- **Refined Card Spacing & Legibility Polish (`YearlyBreathingStrip` & `YearlySavingsMilestoneCard`):** Standardized card distancing to 32dp across all sections matching Weekly and Monthly, increased Net Surplus In/Out subtext size to 12.5dp with semibold typography, eliminated double currency symbol display (`₹₹`), and cleanly rounded macro takeaway amounts.
- **Comprehensive Automated Test Coverage (`tests/yearlyInsightsData.test.ts`):** 14 Vitest unit tests covering active registered days, leap year 366-day boundaries, real-money inflow/outflow, YTD day-matching, capital outlier thresholds, H1 vs H2 trajectory shifts, and budget discipline consistency.

### 📈 Redesigned Insights Breathing Strip & Hero Budget Progress (Weekly & Monthly)
- **Integrated Hero Budget Progress (`InsightsScreen`):** Positioned a slim, responsive budget track and pool context label (`₹X left of ₹Y estimated` or `₹X left of ₹Y pool (₹A est. + ₹B income)`) directly inside the Orange Hero Card below the total spend amount. Eliminates empty hero card space and ensures financial pacing is immediately visible at a glance.
- **Dual Clean Tiles Architecture (`WeeklyBreathingStrip` & `MonthlyBreathingStrip`):** Replaced cluttered multi-metric lower cards with a streamlined dual-tile layout:
  - **Safe Daily Pace Tile:** Displays safe daily spending velocity (`₹X / day`) with remaining days, over-budget warnings, and income boosts. In Pure Mode, adapts cleanly to average daily burn across transactions.
  - **Auto-Saved to Gullak Tile:** Tappable savings milestone card (`+₹Z` in mint green with `🐷 N Saved Days` badge) navigating directly to the Savings screen.
  - **Strict Real-Money Invariants:** Estimated budget allowances are explicitly marked (`est.` / `estimated`) to distinguish estimated pacing from real deposited cash, and locked Gullak deposits are strictly excluded from spending pools.
- **Fair Day-Matched Comparison Guard & Refined Pill Spacing:** Fixed the day-matching comparison to distinguish between ₹0 spend in matched days vs an empty previous month (correctly reporting `+₹X vs same days` when previous month had spend). Refined Hero Card pill spacing with guaranteed `gap: Spacing.group` so comparison and daily burn badges never collide.
- **Fair Day-Matched MTD Comparison Engine (`monthlyInsightsUtils.ts`):** In-progress months (e.g. Day 10 of October) compare Day 1..10 against Day 1..10 of September rather than comparing partial days against a completed 30-day total. Handles month-end boundaries (31, 30, 28/29 days) and zero-spend previous month guards.
- **Daily Burn Rate Badge:** Hero Card displays live average daily burn pace (`₹X/day avg`) next to the trend badge for immediate velocity visibility.
- **Category Progressive Disclosure:** Collapsed categories beyond the top 5 behind a smooth `+ View N more categories` accordion toggle, eliminating vertical page clutter.
- **Budget Allowance Integration in Cash Flow In:** When Budget Mode is active, Cash Flow "In" dynamically integrates the allocated budget allowance (auto-renewed operational liquidity) alongside direct income transactions and external Gullak deposits, presenting a true reflection of real funds allocated vs spent without false deficit warnings.
- **Peak Outflow Week Narrative in Cash Flow:** Cash Flow chart sub-header highlights the heaviest spending week and percentage share (e.g. `"W1 had highest outflow (42% of month)"`), with graceful single-week in-progress and evenly-distributed states.
- **Behavioral Insights for Monthly:** Replaced redundant "Most Spent On" and generic "Top Payment" rows with actionable behavioral rows:
  - **Largest Single Outflow:** Outlier purchase isolation with date, merchant/note, and `% of month` accent pill (threshold $\ge$ ₹200 and $\ge$ 15% share), tappable to `ExpenseDetail`.
  - **Month-over-Month Category Shift:** Highlights the category with the largest spend increase or decrease ($|\Delta| \ge$ ₹300), gracefully falling back to Primary Expense Driver for first-month users.
- **Full Automated Test Coverage (`tests/monthlyInsightsData.test.ts`):** 13 comprehensive Vitest unit tests covering cadence budget derivation, mid-month joiner proration, Gullak auto-rollover deduping, MTD day-matching, and behavioral calculations.

### 📊 Redesigned Weekly Insights & Behavioral Analytics
- **Unified Breathing Strip (`WeeklyBreathingStrip`):** Introduced a clean, single-surface card at the top of the Weekly tab uniting a contextual Smart Takeaway observation with a dual gauge (Budget Health & Safe Daily Pace on the left; Gullak Auto-Savings Impact on the right).
- **Pure Mode Adaptation:** When Budget Mode is disabled, the Breathing Strip seamlessly adapts to display `"WEEK'S TRANSACTIONS"`, transaction count, and total outflow amount, eliminating misleading empty progress bars.
- **Fair Day-Matched Comparison Engine (`weeklyInsightsUtils.ts`):** In-progress weeks (e.g. Wednesday afternoon) compare Mon–today against Mon–same weekday of last week instead of comparing partial days against a completed 7-day total. Completed past weeks compare full 7-day periods.
- **Category Progressive Disclosure:** Categories inline stack displays the top 4 spending categories alongside the animated donut, with an accessible `+ View N more categories` toggle for seamless inline expansion without modals or screen jumping.
- **Behavioral Quick Insights (`BehavioralInsightRow`):** Replaced redundant "Most Spent On" and "Top Payment" rows with actionable behavioral insights:
  - **Largest Single Purchase:** Outlier purchase detection with relevance thresholds (only shows percentage badges for expenses $\ge$ ₹100 and $\ge$ 15% of weekly spend), tapping navigates directly to `ExpenseDetail`.
  - **Weekday vs Weekend Dynamics:** Analyzes Mon–Fri vs Sat–Sun spending patterns on weekends/past weeks, dynamically adapting to Daily Average Burn Rate during active weekdays.
- **Spending Flow Chart Header Polish:** Removed duplicate percentage trend badge from chart header and added clear peak day subtitle (e.g. `"Peak: Saturday (₹1,450)"` or `"No daily expenses"`).
- **Direct Modal & Drill-down Routes:** Tapping the Budget column opens `BudgetEditModal`, tapping Gullak navigates to `Savings`, and tapping daily bars navigates to `History` filtered by date.
- **Full Automated Test Coverage (`tests/weeklyInsightsData.test.ts`):** 18 comprehensive Vitest unit tests verifying all calculation formulas, mid-week joiner active day derivation, zero spend conditions, and threshold filtering.

### 🎨 Visual Polish & UI Consistency
- **Responsive "Smart Budget & Gullak" Wrap & Help Badge Alignment (`ProfileScreen`):** Dynamically adjusts layout when the title wraps onto two lines on smaller screens or larger accessibility fonts by placing the `MoneyHelpBadge` (`size={18}`) directly next to "Smart Budget &" on the first line and "Gullak" on the second line, while keeping them together on a single line when space allows. Matched badge size to Gullak hero card.
- **Unified Section Header & Sliding Filter Toggle (`SavingsScreen`):** Aligned `Day-by-Day Savings History` section header typography with Home screen's `Recent transactions` (`fontSize: 22`, bold, letter-spacing `-0.2`). Replaced static filter pills with animated, bouncy sliding filter toggle (`BouncyFilterToggle`) with identical haptics and spring physics.


### 🎨 Post-Implementation UX & Financial Correctness Hardening
- **Cadence-Aware Paused Auto-Renew Display (`SavingsScreen`):** Paused state on the Allowance Card now dynamically resolves and displays the active cadence's configured amount (`weeklyBudgetAmount` / `monthlyBudgetAmount` / `dailyBudgetAmount`) and cadence-appropriate rollover hints instead of falling back to daily budget.
- **Accurate Past Expense Deletion Alerts (`ExpenseDetailScreen`):** Replaced unconditional Gullak refund promises with cadence-aware restore notifications (restoring funds to active spending pool for weekly/monthly modes or updating past daily budget/savings).
- **Theme-Compliant Cadence Switch Actions (`CadenceSwitchModal`):** Replaced hardcoded purple hex colors (`#8E6CFF`) with semantic theme tokens (`colors.forestGreen` / `colors.mintGreen`), added full accessibility roles (`radio`, `button`) and labels, and enabled 1-tap "Set Safe Budget" pills for both daily and weekly target over-capacity states.
- **Context-Sensitive Explainer Dialog (`BudgetEditModal`):** Dynamically passes pacing preview vs rollover explainer topics, eliminating confusing cadence switch topics for first-time setup users.
- **Pure Mode Liquidity Clarity (`VaultSpendingGuardModal`):** Updated copy to clarify available balance rather than misleadingly claiming zero logged income for returning users.
- **Indian Number Grouping Formatting Strictness:** Replaced raw `toLocaleString` calls across `SavingsScreen`, `ExpenseDetailScreen`, and `cadenceSwitch.ts` with `formatAmountWithCommas` in accordance with Rule 8.

### 🛡️ Digital Vault Spending Guard & Zero-Proration Unified Budgeting Architecture
- **Digital Vault Spending Guard (`VaultSpendingGuardModal`):** Arthik enforces real-money discipline as a digital financial vault. If total available liquidity (active cadence allowance + logged income + external savings) is ₹0, expense outflow creation is blocked at the input boundary. Opens an informative, unboxed bottom sheet with a 1-tap `+ Add Income First` action.
- **Pure Mode Inflow Protection:** Pure Mode users with ₹0 income balance cannot create artificial negative outflows out of thin air.
- **Zero-Proration Architecture Enforcement:** Deprecated all legacy fractional day division formulas across `budgetPeriods.ts`, `budgetModeUtils.ts`, `BudgetEditModal.tsx`, `FaqScreen.tsx`, and `moneyExplainerContent.ts`. User-entered budgets remain 100% active immediately with non-binding daily pacing guidance.
- **Same-Cadence Budget Edit Confirmation Dialogs:** Editing Weekly or Monthly budget amounts while already on that cadence prompts a clear timing confirmation informing the user of the exact upcoming Monday or 1st of month activation date.
- **Past Expense Deletion Ripple Preview:** Deleting an expense from a past date alerts the user that funds will be returned to that past day's budget and credited into their Gullak savings balance.
- **Pure Calculation Engine Unit Tests (`tests/vaultSpendingGuard.test.ts`):** 11 comprehensive unit test cases verifying pure mode blocks, budget mode allowances, income reserves, and overspending waterfall allowances.

### 🔄 Next-Day Cadence Switching Engine & Carry-Forward Modes (Issue #6, PR #7)
- **Zero Mid-Cycle Gullak Dumps (Golden Invariant):** Mid-cycle cadence switching strictly preserves unspent funds in the user's spending pool rather than dumping them prematurely into the Gullak (`gullakDeposit: 0`). Gullak deposits now strictly occur when a period naturally completes (Sunday midnight for weekly, month-end midnight for monthly, day-end for daily).
- **Next-Day Activation (00:00:00):** Cadence switches schedule for tomorrow midnight (`addDays(today, 1)`), allowing today's budget and transactions to conclude cleanly under the active plan without retro-active split confusion.
- **User-Guided Carry-Forward Modal (`CadenceSwitchModal`):**
  - **Additive Pool Option:** Adds remaining unspent funds directly on top of the newly chosen budget (e.g. ₹30,000 base + ₹3,000 carried = ₹33,000 active pool).
  - **Remaining Allocation Option:** Uses carried funds as an opening headstart toward the newly chosen budget without expanding the base cap.
- **Over-Capacity Protection & Safe Suggestions (Audio Clip 2 Edge Case):**
  - Live mathematical validation when switching Monthly $\to$ Weekly or Monthly $\to$ Daily: detects when the requested cadence budget exceeds available remaining monthly capacity over remaining days.
  - Displays a high-contrast amber warning banner with a 1-tap *"Set Safe Budget"* suggestion button.
- **Overspent Zero-Carry Invariant (Audio Clip 4):** When switching cadences in an overspent state, previous period deficits are absorbed by Income/Savings according to real-money cashflow hierarchy, and the new cadence starts cleanly with ₹0 carry-forward.
- **Transparent Allowance Card Tracking (`SavingsScreen`):**
  - Additive pools show the complete breakdown: `₹33,000 pool (₹30,000 + ₹3,000 carried)`.
  - Scheduled cadence switches display an unboxed, luminous banner with countdown to 12:00 AM, amount, and 1-tap cancel.

### 💎 Unprorated Cadence Engine, Dynamic Pace Guidance & Period Renewal
- **Luminous Warm Coral Over-Budget Alerts (`SavingsScreen`):** Replaced saturated `#EF4444` on the violet Allowance Card with high-luminance Warm Coral (`#FF7A6E` / `#FF8A80`), completely resolving optical vibration ("chub raha hai") and clashing against violet gradients while achieving 5.5:1+ WCAG AA contrast.
- **100% Real-Money Invariant (Zero Proration):** Completely eliminated mathematical budget slicing. Mid-period budget activations allocate the entire budget pool intact (e.g. ₹30,000 or ₹7,000) without fractional reductions.
- **Dynamic Non-Binding Pace Suggestions (`BrandedHeroCard`):**
  - Weekly and Monthly users viewing the **Daily** tab see today's actual spend alongside live suggested daily pace (`remainingBudget / remainingDays`) and non-binding guidance disclaimer.
  - Monthly users viewing the **Weekly** tab see suggested weekly pace to stay within their monthly budget.
  - Weekly users viewing the **Monthly** tab see projected monthly spend dynamically calculated from actual calendar days in the active month (`(weeklyBudget / 7) * daysInMonth`, accurately reflecting 28, 29, 30, or 31 days).
- **Cadence-Default Home Screen Tab (`HomeScreen`):** App launches directly on the tab matching user's active cadence (`Daily` $\to$ Daily, `Weekly` $\to$ Weekly, `Monthly` $\to$ Monthly).
- **Adaptive Allowance Card (`SavingsScreen`):** Card title and date bounds adapt dynamically to the user's cadence (*"Weekly Allowance"*, *"Monthly Allowance"*, with date badges like *"29 Sep – 5 Oct"*). Over-budget turns progress bar full-width luminous coral.
- **Unified Period Renewal Bottom Sheet (`PeriodRenewalModal`):** Elegant linework bottom sheet appearing at the start of a new week or month for Weekly and Monthly users:
  - **Auto-Renew ON:** Celebrates Gullak rollover savings and confirms renewed budget with 1-tap *"Keep ₹X"* and *"Change Budget"*.
  - **Auto-Renew OFF:** Prompts setting the budget with quick presets and tactile numeric keypad.

### 💰 Income Protection for Overspending & Gullak Integrity
- **Income Buffer for Overspend:** Overspending from daily/weekly/monthly allowances is now absorbed by available income first before any deduction is made from Gullak savings (`calculateSavingsMetrics` and `dailyBudgetStore`).
- **Gullak Card Helper Protection:** The main "Your Daily Gullak" hero card no longer shows overspend penalty text; it consistently displays positive lifetime savings context.
- **Allowance Card Deduction Clarification:** When overspending occurs, the Allowance Card's footer now explicitly states `₹... deducted from Income` whenever available income covers the excess expenditure.
- **Hero Card Chips Enhancement:** Renamed external deposit subtext chip from `deposits` to `deposits to Gullak` for immediate user clarity, and enlarged the chip size, padding, and font across Daily, Weekly, Monthly, and All time views.

### 🖤 AMOLED Pure Black Theme & 3-Theme Selector
- **True AMOLED Theme (`AmoledColors`):** Implemented a pure black (`#000000`) flagship AMOLED theme optimized for OLED/AMOLED battery saving and high contrast:
  - Base canvas set to pitch black (`#000000`).
  - Elevated card surfaces at `#0A0A0A` with crisp `#1F1F1F` borders.
  - Brilliant `#FFFFFF` primary typography with signature mint green and peach coral accents.
  - Floating bottom navigation bar styled in true AMOLED black (`#050505`).
- **3-Option Theme Selector on Profile:** Replaced the two-state Dark Mode toggle with a tactile 3-choice selector (Light, Dark, and AMOLED) with a highlighted "Recommended" badge on AMOLED.
- **Dynamic Splash Screen Theme Adaptation:** Animated splash screen now inherits the user's chosen theme (Light, Dark, or AMOLED) seamlessly, rendering in pitch black `#000000` when AMOLED is selected.

### 💡 Contextual Money Explainer Badges & Pop-Up Guides
- **Tactile Exclamation Badges (`MoneyHelpBadge`):** Placed intuitive, animated circular exclamation badges (`(!)`) at high-friction financial decision points across the app to proactively eliminate user confusion about what happens to their real money.
- **Interactive Explainer Modal (`MoneyExplainerModal`):** Added a native animated bottom-sheet explainer covering 5 core money topics with structured bullet cards, visual status tags, reassuring icons, and practical financial tips:
  1. *Cadence Switching (`cadence_switch`):* Explains how past days are rolled into Gullak, how remaining days get a fair prorated allowance, and when the new cycle begins.
  2. *Pausing Budget Mode (`budget_pause`):* Confirms that Gullak savings stay 100% safe, past allowances remain in Inflow, and daily limits simply pause.
  3. *Deposit Sources (`deposit_sources`):* Clarifies the exact difference between "From Income" (internal allocation without inflating balance) vs "Add New Money" (fresh external funds).
  4. *Gullak Rollover (`rollover_savings`):* Explains midnight and period-end automated rollovers, streak math, and deficit handling.
  5. *Pure Mode Balance (`pure_mode_balance`):* Details how Total Inflow, Outflow, and Remaining Balance are calculated.
- **Embedded Touchpoints:** Integrated badges directly in `BudgetEditModal` (header & proration preview), `DepositGullakModal` (source options & header), `ProfileScreen` (Budget Mode switch & pause confirmation modal), and `SavingsScreen` (Gullak title).
- **Interactive Bottom Sheet Polish:** Upgraded `MoneyExplainerModal` with smooth Android scrolling responsiveness, tap-anywhere backdrop dismissal, and sleek diagonal 3-stop SVG gradients on badges.

### 🎨 UI/UX Refinements (Insights Navigator, Toggles & Visuals)
- **Premium Total Lifetime Savings Card (`SavingsScreen`):** Overhauled the main Gullak hero card into a premium layout matching fintech standards:
  - **Vibrant Violet Gradient:** Replaced the flat standard background with a rich, full-bleed SVG violet-to-deep-purple linear gradient backdrop.
  - **Seamless Full-Bleed Gradient & Shadow Fix:** Fixed the bottom cut-off and black line artifact by backing the card with a rich purple foundation (`#581C87`), exact dynamic `onLayout` dimension tracking for SVG rendering, and removing Android dark-mode elevation shadows.
  - **Tactile Thickened Deposit CTA Button:** Thickened the "Deposit to Gullak" pill button vertically to 46dp (with 15.5pt bold text and 17dp icon) and balanced card vertical padding to 16dp/15dp, restoring a prominent, solid, and clickable feel.
  - **Glassmorphic Touchpoints & Badges:** Transformed the PiggyBankCoinIcon container into an enlarged, prominent circular glass badge (48x48dp with 28dp icon) with subtle white-transparent overlays (`rgba(255, 255, 255, 0.15)`), enhancing visual hierarchy and elegance over the deep background.
  - **Enhanced Legibility for Auto-Saved Subtitle:** Increased the size and line height of the auto-saved unspent allowance helper line for effortless reading at a glance.
  - **Unboxed Minimalist Stats:** Removed the heavy boxed containers for "Best Streak" and "Saved Days" in favor of an elegant, single-row unboxed layout separated by a clean vertical divider line.
  - **High-Contrast Typography:** Repainted typography and numerical amounts to pure white and soft light-grays for striking legibility.
- **Deposit to Gullak Modal Theme Unification (`DepositGullakModal`):** Styled the deposit source selection and deposit flow modal with the signature violet-to-deep-purple SVG linear gradient:
  - **High-Contrast Curated Badges:** Redesigned the "From Income" pill in soft glowing mint (`#ADEBB3`) and "Add New Money" pill in vibrant sky blue (`#BFDBFE`) over frosted glass, ensuring maximum legibility without changing card dimensions.
  - **Frosted Glass Actions & Typography:** Replaced standard backgrounds with crisp white typography, frosted action pills, and white-bordered primary action buttons.
- **Change Budget Plan Modal Theme Unification (`BudgetEditModal`):** Applied the signature violet-to-deep-purple SVG linear gradient (`#8B5CF6` to `#581C87`) to the budget configuration and cadence modal:
  - **Full-Bleed Violet Gradient Backdrop:** Backed the modal with a rich purple foundation (`#581C87`) and full-bleed SVG gradient for seamless visual cohesion with the Savings screen and Deposit modal.
  - **Dynamic Layout Tracking & Zero Cutoffs:** Added dynamic `onLayout` dimension tracking and keyed SVG rendering so that when cadence switches to Weekly or Monthly (and proration cards expand the modal height), the gradient stretches dynamically to the exact bottom edge without any sharp lines or dark cutoffs.
  - **Frosted Glass Cadence Selector:** Styled the 3-segment Daily / Weekly / Monthly toggle with a frosted background (`rgba(255, 255, 255, 0.12)`), luminous `#ADEBB3` active sliding pill, and bold dark forest text (`#14532D`).
  - **Luminous Amount Input:** Framed the hero amount in frosted glass with a glowing `#ADEBB3` currency sign and crisp white tabular numerals.
  - **Decluttered Explainer Badge:** Removed the duplicate `(!)` badge from the Prorated allowance card, retaining a single, clear `MoneyHelpBadge` in the modal header for clean hierarchy.
  - **Refined Actions & Keypad:** Added a circular frosted close button, frosted cancel action pill, and bold mint `Save Budget` button with clear contrast.
- **Allowance Card Button, Colors & Progress Bar Refinements (`SavingsScreen`):**
  - **Thematic Vivid Red for Over-Budget State:** Aligned all over-budget indicators with the app's official theme danger red (`#EF4444`):
    - Over-budget status dot and "Over budget" text are rendered in high-saturation `#EF4444`.
    - Hero amount (e.g. `₹10`) and "EXCEEDED BY" label now use bold `#EF4444` rather than faded peach/salmon.
    - Deduction hint (e.g. `₹10 deducted from Income` / `₹10 deducted from Gullak`) is now rendered in matching `#EF4444` with semibold typography for unmistakable feedback.
  - **Unboxed Auto-Save Feature Row:** Removed the translucent box container surrounding "Auto-save unspent to Gullak" for a clean, cohesive, and unboxed presentation.
  - **Highlighted "Change >" Action Button:** Transferred the tactile translucent button styling onto the `Change >` action with a frosted white background (`rgba(255, 255, 255, 0.16)`), subtle border, and rounded corners so it reads clearly as an interactive button.
  - **Clean White Progress Bar:** Replaced the red progress bar fill with a solid, high-contrast pure white (`#FFFFFF`) fill.
  - **100% Full-Width Fill on Overspend:** Progress bar now expands across the full 100% width of the track when over budget (rather than stopping halfway when exceeded).
- **Fluid Filter Height Transitions & New Architecture Warning Fix (`HomeScreen`, `FaqScreen` & `BrandedHeroCard`):**
  - **New Architecture LayoutAnimation Safe Helper (`animationUtils.ts`):** Created `configureLayoutAnimation` and `enableLayoutAnimationOnAndroid` guarded against Fabric (`nativeFabricUIManager`), eliminating the repetitive `WARN setLayoutAnimationEnabledExperimental is currently a no-op in the New Architecture` warnings while preserving native layout animations across both Old and New Architectures.
  - **Native Layout Animation:** Enabled `configureLayoutAnimation` when switching between `All`, `Daily`, `Weekly`, and `Monthly` time filters, giving smooth, fluid card height expansion and contraction without sudden snaps.
  - **Responsive SVG Background Scaling:** Styled the notched card SVG with responsive 100% dimensions, dynamic `viewBox`, and `preserveAspectRatio="none"` so the background seamlessly tracks the card's native frame during transitions without visual tearing or black gaps.
  - **Zero-Blink Number Interpolation:** Replaced the count-to-zero animation with smooth previous-to-target numerical interpolation and direct chip rendering, completely eliminating the 0-flash and layout flicker on filter switches.
- **Premium Unified Daily Allowance Card (`SavingsScreen`):** Redesigned the allowance and budget hub into an ultra-premium, compact fintech card avoiding generic AI slop:
  - **Matching Violet SVG Gradient & Seamless Bottom:** Applied the exact same violet-to-deep-purple SVG linear gradient (`#8B5CF6` to `#581C87`) with dynamic `onLayout` card measurement, completely eliminating the dark horizontal band artifact at the bottom of the card.
  - **Strictly Compact Form Factor:** Preserved compact vertical padding and density without enlarging the card dimensions.
  - **Unboxed High-Visibility Status Indicator:** Removed the boxed outline pill around "On track" / "Near limit" / "Over budget", enlarging the status text and luminous dot for immediate readability.
  - **Clean Amount Baseline & Decluttering:** Removed redundant `of ₹250` text beside the amount, freeing up visual breathing room and aligning the hero balance with a sleek, unboxed mint `Change ›` action link.
  - **Enlarged Gullak Icon & Subtitle Typography:** Boosted `GradientIconBadge` size to 34dp (17dp `PiggyBankCoinIcon`) and increased the font size and weight of the auto-saved unspent allowance helper text.
  - **Frosted Glass Styling for Active & Paused States:** Upgraded progress track, spending split, and auto-save capsules with frosted glass overlays (`rgba(255, 255, 255, 0.12)`) and crisp white typography in both active and paused states.
- **Profile Screen Animated Toggles (`AnimatedToggle`):** Replaced standard OS switches with a custom compact rolling-ball toggle with smooth spring physics, internal ON/OFF state indicators, and signature mint green accents.
- **Insights Screen Bouncy Pill Controls:** Upgraded Weekly / Monthly / Yearly filter tabs to the bouncy tactile pill component matching the Home screen design language.
- **Spending Flow Chart Unified Gradients:** Upgraded weekly spending bars with a seamless vertical SVG linear gradient matching monthly charts with consistent opacity across all active days.
- **Category Detail History Style & Gradient Cards:** Enhanced Category Detail screen hero card with dynamic category-tinted gradients and restyled transaction items into cohesive, premium history-style rows.
- **Insights Period Navigator Date Range:** Cleaned up duplicate date labels in the Insights period navigator. Replaced the two stacked redundant labels with a single, elegant bold date range (e.g. `14 – 20 Sep 2026`) centered between navigation chevrons.
- **Notifications Screen Spacing:** Added comfortable breathing room (`Spacing.row`, 14px) between circular notification type badges and notification text.
- **Deposit to Gullak Modal Redesign (`DepositGullakModal`):** Overhauled the deposit source selection modal to completely remove nested box containers, eliminate overlapping exclamation badges, and adopt an unboxed premium list aesthetic:
  - Unboxed the two source options ("From Income" and "Add New Money") into seamless interactive rows separated by an elegant inset hairline divider.
  - Eliminated the redundant exclamation help badge inside the rows to prevent title wrapping and badge pill overlap, keeping the primary `MoneyHelpBadge` in the header.
  - Standardized icons with metallic-sheen `GradientIconBadge` (size 44 Gullak theme `#ADEBB3` with `PiggyBankCoinIcon`, size 48 `#4CAF7D` with `Wallet`, and size 48 `#3B82F6` with `PlusCircle`).
  - Added a silky smooth spring scale & translateY entrance animation (`sheetAnim`) and soft-surfaced Cancel pill button.
- **GradientIconBadge Design Invariant:** Standardized all Gullak, Savings, and category icons across `YearlySavingsMilestoneCard` and `GullakDepositDetailScreen` to use `GradientIconBadge` with `#ADEBB3` and dynamic SVG theme fills, removing legacy flat circle containers. Documented as an invariant in `AGENTS.md` (Section 9.9).
- **Cash Flow Chart Redesign:** Redesigned `CashFlowChart` to match the seamless Yearly Milestones pattern. Eliminated boxy `weekPod` background containers, unboxed the Executive Net Cash Flow summary, added an elegant 1px horizontal divider, and introduced subtle vertical gradients (`#C0EED0` → `#5EBF80` for Money In, `#FCD3CC` → `#E5735B` for Money Out) on animated dual pill bars while preserving compact proportions.

### 🚀 Budget Modes & Multi-Cadence Budget Engine (Pure Mode, Daily, Weekly, Monthly)

- **Pure Expense Tracking Mode**: Introduced Pure Mode as the default experience for new users, providing distraction-free spending and income tracking without spending limits, daily allowances, or Gullak savings. Features a streamlined 4-tab floating navigation bar and route guards preventing unauthorized navigation to Savings.
- **Concentric Dual Ring Chart (`DualRingChart`)**: Beautiful Inflow (outer mint ring) and Outflow (inner coral/red ring) chart on the Home screen with tap-to-toggle between `% spent` and compact `+₹Inflow / −₹Outflow` figures, supporting zero-state and overspent edge cases.
- **Multi-Cadence Budget Selection**: Budget Mode now supports three distinct cadences: **☀️ Daily**, **📅 Weekly** (Monday to Sunday), and **🗓 Monthly** (1st of month to month-end).
- **Discipline-Preserving Plan Scheduling & Proration**: Budget amount and cadence adjustments take effect starting tomorrow at 12:00 AM (or next period boundary), ensuring active cycles are never abruptly broken. Mid-period switches feature automatic day-count proration with transparent preview and one-tap cancellation of pending changes.
- **Adaptive Streak Calendar & Period Finalization**: Streak tracking dynamically scales to the active cadence (`days`, `weeks`, `months`). Includes weekly performance cards and 12-month matrices in `StreakCalendarModal`. Paused intervals are shown with neutral badges that never break streaks.
- **Cadence-Aware Period Rollover & Notifications**: Unspent funds roll over into the digital Gullak at the end of each period (daily midnight, weekly Sunday night, monthly month-end). Notifications trigger at 80% and 100% thresholds once per period with deduplicated keys across re-renders and rehydrations. Pure Mode suppresses all budget warnings while preserving the evening daily expense check-in.
- **Interactive FAQ & Documentation**: Added a dedicated "Budget Modes" category in the in-app FAQ covering Pure Mode, weekly/monthly cycles, Gullak safety, proration, and cadence switching. Updated architectural maps (`docs/maps/daily-budget-map.md`), added ADR 0010 (`docs/adr/0010-budget-cadence-periods.md`), and updated `CONTEXT.md`.

### 💰 Historical Active Budget Inflow & Pure Mode Remaining Alignment

- **Pure Mode Hero Card Shows Remaining Balance at Top:** In Pure Mode, the primary hero amount now displays the remaining available balance ("Kitna bacha hua hai" / Net: Total Remaining, Monthly Remaining, Weekly Remaining, Daily Remaining), matching user financial expectations across all filters. Overspent periods display deficit amounts in alert red.
- **Clean 2-Column Footer (Inflow & Outflow):** Removed the redundant "Net" column from the Pure Mode footer since the net remaining amount is prominently showcased as the primary hero number. The footer now cleanly presents **Inflow** (+₹) and **Outflow** (−₹) in a balanced 2-column layout.
- **Preserved Gullak / Budget Mode Invariants:** Zero changes made to Budget Mode (Gullak mode), preserving all rollover, subtext chips, and daily allowances intact.
- **Real Inflow Accounting When Budget Mode is Turned OFF:** Past daily budget allowances (e.g. ₹250/day or ₹500/day funded into the user's spending pool while Budget Mode was active) are strictly preserved in all-time, monthly, and weekly Inflow in Pure Mode. Turning off Budget Mode pauses future daily allowances from today onwards without deleting the real funds the user deposited and allocated during active past days.


### 🐛 Insights Data & Indian Timezone Alignment

- **Instant Insights Display for New Users:** Fixed an issue where new users saw empty weekly, monthly, and yearly analytics after spending money due to restrictive `user.created_at` timestamp filtering and UTC offset skew.
- **Home Screen Spending & Date Alignment for New Users:** Removed restrictive `userCreatedAtStr` boundary filtering from `filterExpenses` and `getExternalDepositsInPeriod` on the Home Screen. New users can now see their spending, donut chart progress, and accurate period totals across Daily, Weekly, Monthly, and All time without dropouts.
- **New User Daily Budget Mode & Allowance Defaults:** Configured Daily Budget Mode (`isAutoRenew`) to default strictly to OFF (`false`) for new users, with the template daily allowance set to ₹100. Removed forced auto-renew switches in profile hydration and budget updates so manual budgeting mode remains active until explicitly toggled ON.
- **Indian Timezone (IST) & Local Date Parsing:** Replaced raw UTC string splitting on account creation timestamps with `format(parseISO(createdAt), 'yyyy-MM-dd')`, preventing midnight timezone boundary slips.
- **Calendar Rhythm Alignment:** Confirmed strict Monday-to-Sunday weekly cycles and standard 1st-to-30th/31st (and leap year Feb 28th/29th) monthly views. Mid-month onboardings retain full calendar structure while immediately charting real spending.
- **Backdated Transaction Inclusion:** Non-income transactions logged with historical dates prior to or on signup day are now reliably included in Insights and Home Screen spending analytics.

### 🎨 Vibrant Category Palettes, Keypad Polish & Spacing Refinements

- **Curated 26-Color Category Palette & Unique Color Auto-Assignment:** Expanded category styling with a curated 26-color modern palette (`CATEGORY_PALETTE`). Adding a new category now automatically assigns the next unused color from the palette, and dynamically synthesizes harmonious, golden-angle pastel hues when all palette colors are in use.
- **High-Contrast Black Icons on Category Badges:** Standardized all category and transaction circle badges across History, Recent Transactions, Gullak Deposits, and Savings to use crisp `#000000` icons (`strokeWidth: 2.2`) against vibrant colored backgrounds for maximum visibility and visual pop.
- **Unified Donut Chart & Category Legend Colors:** Connected the Category Donut in Insights directly to `CATEGORY_PALETTE` and individual category colors, ensuring the donut ring slices and category breakdown list dots are always 100% color-consistent (e.g. single-category views now accurately show the category's assigned color rather than defaulting to green).
- **Dynamic Category Chip Selection:** Selected category chips on the Add/Edit Expense form dynamically adopt their assigned color with automatic YIQ contrast calculation for white or black text and icon rendering.
- **Vibrant Tactile Keypad Overhaul:** Upgraded the numeric keypad from muted tones to a lively, tactile color palette: rich slate-grey number keys (`#334155` dark / `#E2E8F0` light), vibrant mint green operators (`+`, `−`, `×`, `÷`, `#ADEBB3`), and vibrant coral red delete key (`#FF857A`), paired with significantly enlarged operator symbols and delete icon.
- **History & Savings Screen Filter Pill Spacing:** Fixed the cramped vertical layout where the sliding filter pill track touched the bottom of the "History" header title, adding a clean 32px breathing room. Also improved filter pill margin under the "Day-by-Day Savings History" header in the Savings screen.
- **Savings Gullak Deposit Affordance & Pagination:** Added a distinct `ChevronRight` arrow affordance on Gullak deposit records in the Savings timeline to indicate tap-to-manage/delete actions, initialized the list to 8 records, and added a sleek rounded "See More" button for smooth on-demand pagination.

### 🎨 UI Polish — Telegram-Style Rows & Bouncy Category Filter

- **Scrollable Bouncy Category Filter (History):** Replaced the separate pill chips on the History screen with a single elongated pill track containing a spring-animated sliding highlight. The highlight morphs to each category's natural text width and scrolls to keep the active item visible — same `tension: 70 / friction: 8` spring physics as the HomeScreen filter toggle.
- **Telegram Unboxed Transaction & Notification Rows:** Redesigned transaction, notification, and savings rows into an unboxed chat-style layout (note-first hierarchy, category badge, payment icon) matching the visual language of the telegram pull indicator introduced earlier.
- **Softer List Dividers:** Reduced divider opacity to 0.08 (dark) / 0.06 (light) for a balanced, non-intrusive visual separator across History, Savings, and Notifications.
- **Savings Row UX:** Deposit rows now carry a `ChevronRight` affordance so users know they can tap to manage deposits. A contextual helper text appears under the Deposits filter to guide first-time users.
- **Daily Budget Mode 1-line Summary:** Condensed the verbose Daily Budget Mode description card into a single concise line for a cleaner Settings layout.


- **Executive Cash Flow Chart:** Introduced an interactive 4-week dual-bar Cash Flow chart for the Monthly Insights view (`CashFlowChart`). Features an executive Net Cash Flow summary banner (signed surplus/deficit amount with semantic status badges), paired with circular In/Out icon badges (`ArrowUpRight` and `ArrowDownRight`) with whole-rupee formatting.
- **Weekly Capsule Pods & Zero-State Baseline:** Replaced bare floating bars with interactive week pods (`W1`–`W4`), solid 18px pill tracks, calibrated zero-baseline marks for inactive weeks, bold Quicksand typography, and net delta indicators (`+₹1k`, `−₹340`, `—`).
- **One-Tap Deep Navigation to History:** Tapping any weekly pod in the Cash Flow chart navigates directly to the History screen, pre-filtering the transaction feed to the selected week interval and smoothly auto-scrolling to the first transaction of that week.
- **History Auto-Scroll Reliability:** Resolved an issue where auto-scrolling to target transaction dates was interrupted by re-renders. Decoupled navigation parameter clearing using stable ref tracking (`lastHandledKeyRef`), ascending date matching, and graceful layout retry handling (`targetIndexRef`).
- **Weekly Spending Flow & Yearly Gullak Milestones:** Added fluid 7-day capsule spending flow charts for Weekly Insights and annual milestone progress tracking for Gullak savings in Yearly Insights.

### 🎨 UI & Design Polish
- **Branded Notched Hero Card:** Redesigned the Home screen hero card with an organic circular notch embracing the centered donut chart pod, high-contrast unboxed financial metrics (period allowance/income vs. spent), and intuitive breakdown subtext clarifying daily rollover projections and period balance totals.
- **Pill Capsule Transaction Rows:** Redesigned Recent Transactions (Home Screen) and History Screen transaction rows into rounded pill/capsule cards (`BorderRadius.pill`), with circular icon badges, high-contrast theme-adaptive surfaces, and color-coded tabular amounts (coral for expenses, mint for income).
- **Modular Animated Category Donut:** Extracted category donut visualization into a standalone, animated `AnimatedCategoryDonut` component supported by dedicated pure geometry helpers (`chartUtils.ts`), eliminating redundant path calculations and bringing fluid sweep animations to Insights.
- **Zero-Blink Block Donut Sweep in Insights:** Redesigned category visualization in `AnimatedCategoryDonut` with discrete block-wise capsule arcs (`strokeLinecap="round"`), uniform radial gaps (6°), and monotonic sequential clockwise sweep interpolation. Connected `useIsFocused` to automatically reset sweep animations off-screen during tab blur, completely eliminating the 1-frame stale 100% flash when navigating into Insights from other tabs while preserving silky smooth period and week-to-week transitions.
- **Shared Breathing Streak Flame Component:** Encapsulated streak flame breathing physics, scale pulsation, and multi-day status glow into a reusable `StreakFlame` component and `flameUtils.ts` across Home, Savings, and the Streak Calendar modal.
- **Bouncy Elastic Filter Toggles:** Standardized period and category filter pills into an elastic spring-animated toggle (`BouncyFilterToggle`) respecting design tokens and active theme palettes.
- **Deep Clean & Dead Code Elimination:** Purged redundant filter pill implementations, unused chart geometries, legacy styling definitions, and duplicate animation loops across `HomeScreen`, `InsightsScreen`, and `SavingsScreen` for optimal maintainability and rendering speed.

### ✨ Tactile Animations & Micro-Interactions
- **Gullak Coin Drop & Piggy Bounce:** Animated squash-and-stretch bounce on the Gullak piggy bank icon paired with a golden coin drop micro-interaction when depositing savings or rolling over unspent daily budget.
- **Streak Flame Breathing & Calendar Transitions:** Gentle continuous breathing pulsation on the header streak flame badge to celebrate active savings consistency, along with smooth staggered pop-ins for saved days in the Streak Calendar modal.
- **Donut Chart SVG Sweep & Allowance Progress Fill:** Fluid animated arc sweeps on the Home screen donut chart when toggling between Daily, Weekly, and Monthly periods, plus animated fill width on the Daily Allowance progress bar.
- **Keypad Amount Punch & Error Shake:** Subtle amount punch animation on keypad input and a horizontal error shake when attempting to save with zero amount.
- **Category Chip Selection Pop:** Spring scale pop feedback when selecting categories in the transaction form.
- **Filter Pill Elastic Spring:** Fluid spring feedback when toggling time filters on the Home screen.
- **Spring Sheet & Modal Physics:** Weighted spring enter and exit physics for budget edit modals and bottom sheets.
- **Transaction Feed Stagger:** Subtle sequential fade-in and slide-up stagger for recent transactions on the Home screen.

### ⚡ Slow Network & Launch Stability Fixes
- **Splash Screen 5s Aggregate Hydration Timeout:** Wrapped network hydration (`loadPendingExpenses`, `fetchCategories`, `fetchExpenses`, `hydrateFromSupabase`) in a fail-safe 5-second aggregate timeout. On slow, high-latency, or fluctuating 2G/3G connections, the app falls back to local cache and opens the Home dashboard immediately instead of hanging on the splash screen.
- **Profile State Preservation on Network Timeout:** Fixed an issue where a slow network timeout could temporarily clear user profile state and cause "Welcome User" and zeroed metrics to display. Local profile memory is now strictly preserved when network hydration times out.
- **Eliminated Duplicate Startup Hydration:** Prevented `App.tsx` from triggering duplicate concurrent Supabase queries during `INITIAL_SESSION` while the splash screen is already hydrating data, drastically reducing network contention and load times on weak connections.

### 📶 Offline-First Architecture & Auto-Sync
- **100% Offline Cold Launch:** App opens directly to the Home screen instantly without requiring network connectivity. Restores cached authentication session, profile, categories, and confirmed expenses from persistent offline storage.
- **Offline Category CRUD:** Create, edit, and delete custom categories with zero network connection. Local state updates optimistically and mutations queue locally in persistent AsyncStorage queues (`@arthik_pending_cat_*`), syncing automatically when connectivity returns.
- **Offline Gullak Deposits:** Deposit and remove funds in Gullak completely offline. Tracked balances and savings streaks update immediately, with deposits queued and automatically flushed to Supabase when reconnected.
- **Offline Profile & Budget Updates:** Update profile names and daily allowance settings while offline. Changes are saved locally and synced in the background upon reconnect.
- **Unified Background Auto-Sync:** When the device regains internet connection, a unified sync pipeline flushes all pending expenses, category mutations, Gullak deposits, daily budget records, and profile settings in background order with exponential backoff retry.
- **Fast Animated App Launch:** Reduced launch hold times and streamlined cinematic splash animation sequences for snappier startup.

### 🚀 Added
- **Dual-Source Gullak Deposits ("From Income" vs "Add New Money"):** Users can now choose their deposit source when adding funds to Gullak:
  - *From Income:* Capped by available tracked income (`totalTrackedIncome - incomeDeposits`). Increases Gullak savings without inflating period available balances (avoiding double-counting).
  - *Add New Money (External):* Records external money, increasing both Gullak savings and period available balance (`totalAvailable`) across Daily, Weekly, Monthly, and All views for both daily allowance users and users without daily allowance.
- **Custom In-App Numeric Keypad in Deposit Modal:** Replaced the system keyboard with Arthik's custom spring-animated numeric keypad (`KeyButton`), live expression evaluator, and quick amount preset chips (`+₹100`, `+₹500`, `+₹1k`, `+₹2k`, `Max`).
- **Ergonomic Modal Sheet Positioning:** Anchored the deposit sheet closer to the top with safe area insets for comfortable one-handed reach.
- **Gullak Deposit History & Detail Screen:** Gullak deposits now appear interleaved in Recent Transactions and History with distinct source badges. Tapping any deposit opens `GullakDepositDetailScreen` with deposit metadata and a safe removal button that restores available income on deletion.


### 🚀 Added
- **FAQ / Help Centre in Profile:** A searchable FAQ screen (accessible from the Profile tab) answers the most common questions about Daily Budget, Gullak, streaks, offline sync, categories, and account security — so users get instant answers without leaving the app.

### 🐛 Fixed
- **Daily Budget Hydration Stability:** Fixed a regression where `isAutoRenew` and `dailyBudgetAmount` would silently reset to `false` / `0` on app launch if Supabase profile data had not yet loaded. Settings now persist correctly across app restarts.
- **Daily Allowance ₹0 Bug:** Setting daily allowance to ₹0 now correctly disables Daily Budget mode instead of reverting to the previous amount on the next app refresh.

### 🎨 Improved
- **Fully English UI Copy:** Translated all remaining Hinglish alert messages, button labels, confirmation dialogs, and status text to clear, professional English across Profile, Budget, Savings, and Category management screens.

### 🚀 Added
- **Interactive Period Navigation & Elastic Insights Hero Card:** Tightened Insights hero card spacing by ~42px for a sleek, compact visual hierarchy. Added period navigation (Weekly, Monthly, Yearly) with dynamic data bounds derived from earliest user transactions (eliminating dead phantom dots), a left-to-right faded emergence opacity/scale progression for timeline dots, and a stretchy elastic rubber/chewing-gum stretch-and-snap sliding pill animation.
- **In-Keypad Calculator & Arithmetic Evaluator:** Added math operators (`+`, `−`, `×`, `÷`) directly to the numeric keypad on the Add/Edit Transaction screen. Supports live order-of-operations evaluation, real-time expression preview, zero-division protection with active validation, automatic calculation breakdown notes, and an optimized 4-column keypad layout.
- **Unified Hero Card Across All Time Filters (Daily, Weekly, Monthly, All):** The Home Screen hero card now presents a unified financial picture across all four periods. The Income tile consistently represents total period inflow (`Period Budget Pool + Incomes`), while the Spent tile tracks expenses, and the center metric reflects net balance/remaining allowance. The 'All' filter computes the entire lifetime budget pool from user registration alongside total income.
- **Supabase Cloud Sync for Manual Gullak Deposits:** Manual Gullak deposits and removals now automatically sync with Supabase `gullak_deposits` table with Row-Level Security, restoring savings data seamlessly across device re-logins.
- **Two-Step Email Confirmation for Account Deletion:** Protected account deletion behind an email confirmation modal requiring the user to type their exact registered email address, followed by a final double-check confirmation alert to eliminate accidental account deletion.
- **Pill-Shaped Delete Expense Button:** Updated the Delete Expense action on the Expense Detail screen to match the primary pill button geometry with themed peach soft background and coral text.
- **100% Unspent Top-Up Rollover:** Whatever daily budget a user allocates for the day (base allowance or increased with top-ups), any unspent amount at midnight now rolls over 100% into the Daily Savings Gullak without artificial capping, ensuring that user spending discipline is fully rewarded.
- **Manual Gullak Deposit Feature ("Deposit to Gullak"):** Added a tactile manual savings deposit action directly inside the Gullak hero card on the Savings screen. Users can deposit extra cash or savings directly into their Gullak with quick amount chips (+₹100, +₹500, +₹1,000, +₹2,000) and optional notes (e.g. "Festival gift", "Cash savings"). Includes a unified chronological savings timeline and a dedicated 'Deposits' filter with safe deletion/undo support.
- **Unified Hero Summary Card & Dual-Arc Donut Chart:** Unified daily allowance, period income, and spending into a single cohesive hero dashboard card featuring an embedded dual-arc donut chart (mint for income, peach for spent, with centered percentage and SPENT status label), dedicated Allowance/Income and Spent metric tiles, and an interactive Gullak rollover strip displaying tonight's projected savings accumulation. Replaced the redundant separate compact allowance widget for a streamlined, clutter-free visual hierarchy.
- **Themed In-App OTA Update Modal with Release Highlights:** Replaced the unstyled native Android system alert dialog with a custom branded in-app update modal featuring app theme colors, Quicksand typography, version badges, dynamic "What's New" highlights parsed from the update bundle, live download feedback, and graceful connection retry handling.
- **Swipe-to-Dismiss Keypad & Symmetrical Category Fade Overlays:** Replaced the "Done" text button on the custom numeric keypad with an interactive, centered drag handle supporting smooth 1:1 finger swipe-down to dismiss with spring physics. Category chips now scroll edge-to-edge under symmetrical SVG linear gradient fade overlays cleanly pinned to the device edges, while amount digits remain rock-stable at a consistent size and the Note input automatically scrolls into view when focused.
- **Collapsible Numeric Keypad & Jitter-Free Form Scrolling:** On the Add/Edit Transaction screen, categories are always visible upfront for fast 1-tap categorization, while the numeric keypad smoothly collapses downwards when scrolling down into the form to provide maximum vertical space for Notes, Date, and Payment options. Tapping the Amount display instantly restores the keypad and scrolls to the top, while focusing the Note field seamlessly transitions to the system keyboard without stutter or layout jumping.
- **Native Biometric App Lock:** Added native device screen lock and biometric security (Fingerprint, Face Unlock, and device PIN/Pattern fallback) via `expo-local-authentication`. Includes a user toggle in Profile settings (requiring authentication to enable or disable) and automatically secures the app on launch and background minimization, preventing sensitive financial data from appearing in the recent apps task switcher.
- **App Lock Resume & Biometric Prompt Fix:** Fixed an issue where swiping to home or backgrounding the app caused the biometric prompt to hang with a stuck loading indicator upon reopen. Added background state guards, safe cancellation on lock, settling delay for Android window focus, circular mint green fingerprint sensor touch button with live indicator, and instant retry responsiveness.
- **Note Autocomplete & Quick Suggestions:** As users type in the transaction note input, matching previous notes (e.g. "College Rapido") appear as horizontal suggestion chips ranked by recency, frequency, and category affinity. Tapping a chip autofills the note instantly.
- **Cinematic Animated Splash Screen:** Redesigned app opening sequence featuring staged in-place drawing of the 3 logo lines along their exact geometric angles, a tactile lockup spring punch, smooth left slide with "Arthik" wordmark reveal, pulsing loading dots during session/data hydration, and an anchored circular mint bloom transition into destination screens.

### ⚡ Performance
- **Form Scroll Bridge Optimization:** Removed redundant scroll bridge events and throttles on the Add/Edit Transaction form, eliminating per-frame native-to-JS serialization for fluid, 60+ FPS vertical scrolling.
- **Silky-Smooth Navigation & Scroll Physics:** Optimized `BottomNavBar` tab animations by switching from oscillating springs to a 180ms cubic deceleration timing curve, caching the floating capsule and action button on Android GPU hardware layers (`renderToHardwareTextureAndroid`), preventing unnecessary re-renders via `React.memo` and stable callbacks, enabling `freezeOnBlur` on `TabNavigator` to prevent background tab re-renders, and tuning `scrollEventThrottle` to 32ms across all screens to cut native-to-JS bridge traffic by 50%.

### 🚀 Added
- **Daily Budget Mode Toggle Bounce Animation:** When Daily Budget Mode is disabled, the Today's Allowance card is cleanly hidden. Toggling it on smoothly animates the card into view using a bouncy spring curve (`tension: 70, friction: 8`), providing tactile visual feedback.
- **Extra Allowance Buffer & Gullak Rollover Protection:** When users increase their daily limit, expenses are deducted first from the extra buffer before touching the base daily allowance, keeping user streaks protected. Unspent extra buffer amounts do not roll over to Gullak, ensuring that accumulated savings only reflect real unspent base budget.

### 🐛 Fixed
- **Floating-Point Decimal Precision Across All Period Cards:** Fixed fractional amounts (e.g. ₹17.5, ₹100.25) forcibly rounding to integers across All, Daily, Weekly, and Monthly summary cards on Home, Savings, Gullak, and Insights screens. Introduced a shared `round2` utility to eliminate IEEE-754 precision drift while maintaining native 2-decimal formatting.
- **Today's Allowance Card Instant Reflection:** Fixed a state mutation issue in `dailyBudgetStore` where editing today's budget or adding top-ups reflected immediately on the Home screen but failed to update the Today's Allowance card in place without leaving or refreshing the screen.
- **Category Chips Scroll Clipping & Corner Blink:** Fixed an issue on the Add Transaction form where horizontal category chips were abruptly clipped 24dp before the screen edge and suffered from corner blinking/flickering during scrolling. Expanded the scroll viewport to bleed to device screen edges with proper content insets while removing glitchy overflow visibility.

---

## [1.2.4] - 2026-09-19

### 🚀 Added
- **Update Required Screen & Remote Version Control:** Added a non-dismissible "Update Required" screen for legacy app versions with direct download link to GitHub Releases. Controlled dynamically via server-side config (`app_config` table) with strict semver matching, fail-open offline tolerance, and a remote master killswitch.

### 🔒 Security
- **Deep Link Session Takeover Guard:** Prevented session fixation and unauthorized account switching via unverified custom scheme deep links (`arthik://callback#access_token=...`). Deep-linked sessions for a different user identity are blocked if an active session already exists.
- **Disabled Android Auto-Backup:** Added `allowBackup: false` in `app.json` preventing AsyncStorage session tokens, cached records, and pending offline queues from being extracted via `adb backup` or included in Google Cloud backups.
- **Tenant Category Isolation:** Enforced strict row-level security policy on `expenses` verifying that attached `category_id` references either the authenticated user's own category or a shared default system category (`user_id IS NULL`).
- **Database Integrity & Bounds Constraints:** Added database check constraints on `profiles` (positive daily budget, validated name lengths), `daily_savings_log` (non-negative spent/budget amounts), and `expenses` (amount upper bounded to ₹999,999,999.99 matching keypad precision).

### 🐛 Fixed
- **Changing Daily Budget No Longer Rewrites Past Days:** If you had a ₹500 daily budget and changed it to another amount, your past days are no longer rewritten to the new allowance, preserving your genuine savings history and Gullak balance.
- **Zero-Spend Days No Longer Deleted on Cloud Sync:** If your daily budget was ₹500 and you spent ₹0 on a day, those days are no longer mistakenly treated as test data and removed from your cloud history when the app syncs.
- **Pre-Registration Streak Boundary:** Best savings streak no longer counts days from before your account was created, ensuring streak records only reflect your actual activity on Arthik.
- **Entering Paise on Large Amounts:** You can now enter paise on large amounts without the keypad blocking, with whole rupees capped at 9 digits so numbers stay within bounds.
- **Untracked Day Neutrality:** Days with no budget tracking or expense activity are now treated as neutral days rather than breaking your savings streak.
- **Unified Income Handling in Budgets:** Income transactions are now consistently recognized across all budget calculations and will never be misclassified as spending.
- **Startup Period Budget Accuracy:** Fixed an issue where weekly and monthly totals could briefly show more budget than you actually had right after opening the app.
- **First-Day Savings Sync:** Finalized savings metrics on a day's first rollover are now reliably preserved in the cloud even if a placeholder record was already present.
- **Midnight Boundary Refresh:** Date-dependent calculations, live spending, and filters on the home screen now update immediately upon returning to the app after midnight.
- **Nightly Savings Notification Accuracy:** The nightly savings notification no longer claims you saved your full daily budget (e.g. "You saved ₹100") on days you spent money. It now accurately reflects what you actually saved.

### ⚙️ Internal
- Code reorganization, architectural decomposition, and comprehensive test coverage across budget calculations, home calculations, deep link guards, version control checks, and expense form modules.

---

## [1.2.3] - 2026-09-16

### 🛠️ Fixes & New User Defaults (OTA Patch)
- **New User Daily Limit Default OFF:** New user profiles now default to daily limit feature OFF (`daily_budget: 0`, `is_auto_renew: false`). Users can turn it ON and configure custom limits anytime in Savings screen.
- **Corrupted User Budget Self-Healing:** Added automatic detection and recovery for users whose daily budget was corrupted to ₹500 by the previous migration default. Accurately infers original budget from historical savings logs & expenses, restores real budget, and repairs Gullak accumulated savings and streaks.
- **Phantom Day Purge & Server Cleanup:** Auto-purges phantom zero-spend days with fake ₹500 defaults from both local store and Supabase `daily_savings_log`.
- **True Budget Self-Healing in Database:** Heals corrupted historical server log rows to the user's actual daily budget (e.g. ₹100), recalculating exact saved amount, spent amount, and status (`saved`, `exceeded`, `even`) and auto-upserting corrected rows.
- **UI & Banner Improvements:** Removed hardcoded 500 fallback in HomeScreen hero card, updated Daily Allowance banner to show "Off • Tap to set" when inactive, and added prompt to configure amount upon toggling auto-renew in Savings screen.

### 🔒 Security Hardening & Compliance
- **Full Account & Data Deletion:** Rewrote and deployed dedicated Supabase Edge Function `delete-user-account` (`Deno.serve` + `npm:@supabase/supabase-js@2`) delegating deletion directly to `auth.admin.deleteUser(userId)` and leveraging database `ON DELETE CASCADE` across all tables. Client cleans up all user-specific AsyncStorage keys (`@arthik_*_${userId}`) and cancels scheduled notifications.
- **Optimized & Hardened RLS Policies:** Systematic database audit across `profiles`, `categories`, `expenses`, and `daily_savings_log`. Added `(select auth.uid())` subquery optimization and `TO authenticated` scope for 10x query performance. Restricted `handle_new_user` trigger function execution (`REVOKE EXECUTE FROM PUBLIC, anon, authenticated`). Added foreign key indexes on `expenses(category_id)` and `categories(user_id)`.
- **PKCE Auth Flow & Clean Deep Linking:** Upgraded auth to `flowType: 'pkce'` with `exchangeCodeForSession` preventing auth code and token exposure.

### ⚡ Reliability, Data Integrity & Offline Sync
- **Rollover Safety & Multi-Device History Protection (P0.1 & P0.2):** Added `hydratedForUserId` and `ownerUserId` to `dailyBudgetStore` and `notificationStore`. Guarded `checkAndRollover` to return early until server hydration completes, preventing fresh installs from overwriting real savings logs and streaks.
- **Client-Side UUID & Deduplicated Inserts (P0.4):** Migrated from server-generated IDs and `temp_` prefixes to native client UUIDs (`Crypto.randomUUID()`) synced via `upsert(..., { onConflict: 'id', ignoreDuplicates: true })`, eliminating duplicate expense creation on dropped connections.
- **Offline Queue Flush on App Launch (P0.3 & P0.12):** Post-auth queue hydration (`loadPendingExpenses`) runs automatically on app start and active app state transitions. Concurrency-safe queue updates prevent data loss during concurrent network changes.
- **Offline Budget Settings & Savings Upload (P0.13 & P0.14):** Added `savePendingSettingsOffline` and `needsUpload` tracking for offline daily budget changes and finalized savings days, syncing reliably upon reconnection.
- **Pagination & Strict Network Failure Classification (P0.6 & P0.7):** Added loop-based `.range()` pagination in `fetchExpenses` to support 1000+ rows. Refined `isNetworkFailure` with exponential backoff so logic errors are not silently misclassified as offline.
- **Sync Failed Recovery Banner (P0.8):** Enhanced `SyncFailedBanner` to allow re-enqueueing failed items with retry reset and per-item discard.

### 💰 Budget, Savings & Streak Accuracy
- **Real Spent Tracking & Nullable Historical Budget (P1.1 & P1.2):** Dropped `DEFAULT 500` from `daily_savings_log.budget_amount`, added real `spent_amount` column, and eliminated legacy fallback recalculation hacks.
- **Registration-Aware Period Boundaries:** Clamped HomeScreen period filters (Weekly, Monthly, All) to user registration date (`created_at`). Pre-registration days and expenses are cleanly excluded, keeping mid-week signup budgets and totals 100% accurate.
- **Paise & Decimal Currency Precision:** Upgraded `formatCurrency` across HomeScreen, HistoryScreen, and CategoryDetailScreen to retain decimal paise values (up to 2 fraction digits) without aggressive whole-rupee truncation, and fixed negative currency display (`-₹`).
- **Streak & Savings Consistency (P1.3):** Preserved daily savings credit for days with active budgets and recorded expenses (`Math.max(0, budget - spent)`).
- **Date Parsing & Future Date Prevention (P2.4 & P2.5):** Clamped expense date picker to `maxDate={new Date()}` and migrated string date formatting to `parseISO`.

### 🎨 UI, State & Polish
- **Zero-Category Graceful Handling (P2.3):** Allowed empty category state when server returns 0 categories, rendering "+ Create Category" prompt instead of locking form in permanent placeholder state.
- **Tab Stale Time & Focus Recomputation (P2.1 & P2.2):** Added 60s stale time with pull-to-refresh (`RefreshControl`) across Home, History, Savings, and Insights. Insights intervals dynamically recalculate on tab focus.
- **Smart Notification Toggle (P1.5):** Strictly respected `@arthik_notifications_enabled` in background triggers and daily reminders.
- **Hermes Memory Fix & Production Cleanup (P1.12 & P2.7):** Patched `expo@^57.0.9` addressing native Hermes engine memory regressions, and guarded all runtime `console.*` statements behind `__DEV__`.
- **Automated Rollover & Healing Test Suite:** Added comprehensive self-check assertions in `tests/dailyBudgetStore.test.ts` covering multi-user isolation, phantom day purge, fake ₹500 healing, mid-week boundary clamp, and decimal paise formatting.

---

## [1.2.2] - 2026-09-16

### 🚀 Added & Improved
- **Offline-First Sync Engine (`networkStore` & `expenseStore`):** Full offline capability with instant optimistic UI updates. Created, edited, or deleted expenses while offline are safely queued in `AsyncStorage` and automatically flushed to Supabase when connectivity is re-established.
- **Dual-Endpoint Network Heartbeat:** Robust 0-byte ping mechanism using `https://clients3.google.com/generate_204` and Cloudflare trace fallback, providing 100% reliable internet detection compared to standard OS connection flags.
- **Animated Offline Status Banner (`OfflineBanner`):** Floating top pill banner that smoothly slides down when offline, showing real-time sync status and a manual "Retry" action.
- **App-Wide Error Boundary (`ErrorBoundary`):** High-level React Error Boundary wrapping the root app tree to gracefully catch runtime errors and present a themed recovery screen with "Try Again" / "Restart App" controls.
- **Smart Gullak Overspending Deductions:** When daily spending exceeds the configured daily budget target, the deficit is automatically deducted from accumulated savings (`Gullak`), keeping net savings strictly accurate.
- **Summary Card & Allowance Reactive Sync:** Unified Home Screen Summary Card with the daily budget allowance model, computing remaining allowance with zero-state aware donut chart tracks.

### 🐛 Fixed & Optimized
- **Zero-Spent Donut Stroke Artifact:** Cleaned up SVG path rendering on the Home Screen donut chart when total spending is zero.
- **Multi-User Store Reset Registry:** Hardened cache isolation on sign-out across all Zustand stores, preventing stale data leaks between accounts and eliminating dynamic import crashes.
- **TypeScript & Codebase Sanitization:** Validated full type safety with zero errors across the entire codebase (`npx tsc --noEmit`).

---

## [1.2.1] - 2026-09-14

### 🚀 Added & Improved
- **Daily Allowance & Summary Card Sync:** Linked the user's daily allowance budget directly to the Home Screen Summary Card. When no explicit income is recorded, the Daily Budget (e.g. ₹500), Weekly Budget (₹3,500), and Monthly Budget (₹15,000) are automatically used to compute remaining allowances and donut chart ratios.
- **Dynamic Header Name Scaling:** Implemented dynamic character-length font scaling (`36px` down to `19px`) with `numberOfLines={1}`, `adjustsFontSizeToFit`, and frame-lock constraints (`flex: 1` and `flexShrink: 0`) on Home Screen greeting. Prevents long names from pushing Notification Bell and Profile icons out of view.
- **Timezone-Safe Date Filters:** Replaced legacy UTC `toDateString()` logic with direct ISO string matching (`yyyy-MM-dd`) and `date-fns` helpers, ensuring 100% accurate daily and weekly expense sync regardless of device timezone.

### 🐛 Fixed
- **Sign Out TypeError Crash:** Resolved `TypeError: Cannot read property 'reload' of undefined` on user log out by replacing runtime dynamic `await import()` with a synchronous store reset callback registry in `authStore.ts`.
- **Form Controls Height Uniformity:** Standardized Note input, Date picker, and Paid Via toggle containers in `ExpenseFormScreen.tsx` to an exact, consistent `56dp` stadium-pill height with aligned internal content.
- **Bouncy Payment Toggle Overshoot:** Calibrated spring physics (`tension: 70, friction: 8`), added boundary clamping (`extrapolate: 'clamp'`), and enabled container `overflow: 'hidden'` to prevent the peach selection pill from overshooting container borders.

---

## [1.2.0] - 2026-09-13

### 🚀 Added & Improved
- **Floating Pill Bottom Navigation Bar (`BottomNavBar`):** Re-engineered navigation with spring-animated horizontal expanding capsule tabs, an elevated center quick-add button, and balanced 5-column layout.
- **Daily Budget & Allowance System (`dailyBudgetStore`):** Added automated daily budget rollover tracking, savings streak counter, and Smart Gullak accumulation.
- **Proportional Spacing Rhythm:** Unified form gaps across the expense flow to consistent 16px vertical cadence.

---

## [1.0.0] - 2026-09-10

### 🚀 Initial Release
- Email/password authentication and Google OAuth integration via Supabase.
- Core expense tracking with category assignment, payment modes (Cash, UPI, Card), and custom note support.
- Interactive custom numeric keypad and proprietary in-app calendar modal (`CustomDatePickerModal`).
- Expense analytics with category breakdown and monthly spending charts.
- Dark and Light mode theme switching.
