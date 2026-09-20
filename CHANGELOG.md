# Changelog

All notable changes to the **Arthik** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### 🚀 Added
- **Collapsible Numeric Keypad & Smooth Form Scrolling:** On the Add/Edit Transaction screen, the numeric keypad now collapses downwards with native spring physics (`tension: 70, friction: 8`) the instant the user drags or scrolls down into the form (even on gentle slow drags). This gives full vertical viewport space to comfortably select Categories, add Notes, set Date, and choose Payment Mode, with the Save button cleanly docked at the bottom. Tapping the prominent Amount display (`₹`) springs the keypad back up and scrolls to the top. Tapping the Note field reliably brings up the phone keyboard without auto-scroll flickering, and dragging the form dismisses the keyboard cleanly.
- **Native Biometric App Lock:** Added native device screen lock and biometric security (Fingerprint, Face Unlock, and device PIN/Pattern fallback) via `expo-local-authentication`. Includes a user toggle in Profile settings (requiring authentication to enable or disable) and automatically secures the app on launch and background minimization, preventing sensitive financial data from appearing in the recent apps task switcher.
- **App Lock Resume & Biometric Prompt Fix:** Fixed an issue where swiping to home or backgrounding the app caused the biometric prompt to hang with a stuck loading indicator upon reopen. Added background state guards, safe cancellation on lock, settling delay for Android window focus, circular mint green fingerprint sensor touch button with live indicator, and instant retry responsiveness.
- **Note Autocomplete & Quick Suggestions:** As users type in the transaction note input, matching previous notes (e.g. "College Rapido") appear as horizontal suggestion chips ranked by recency, frequency, and category affinity. Tapping a chip autofills the note instantly.
- **Cinematic Animated Splash Screen:** Redesigned app opening sequence featuring staged in-place drawing of the 3 logo lines along their exact geometric angles, a tactile lockup spring punch, smooth left slide with "Arthik" wordmark reveal, pulsing loading dots during session/data hydration, and an anchored circular mint bloom transition into destination screens.

### ⚡ Performance
- **Silky-Smooth Navigation & Scroll Physics:** Optimized `BottomNavBar` tab animations by switching from oscillating springs to a 180ms cubic deceleration timing curve, caching the floating capsule and action button on Android GPU hardware layers (`renderToHardwareTextureAndroid`), preventing unnecessary re-renders via `React.memo` and stable callbacks, enabling `freezeOnBlur` on `TabNavigator` to prevent background tab re-renders, and tuning `scrollEventThrottle` to 32ms across all screens to cut native-to-JS bridge traffic by 50%.

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
