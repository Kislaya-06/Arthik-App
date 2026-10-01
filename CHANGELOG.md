# Changelog

All notable changes to the **Arthik** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

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
- **Automated Rollover & Healing Test Suite:** Added comprehensive self-check assertions in `test_rollover_safety.ts` covering multi-user isolation, phantom day purge, fake ₹500 healing, mid-week boundary clamp, and decimal paise formatting.

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
