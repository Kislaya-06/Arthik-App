# Changelog

All notable changes to the **Arthik** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [OPTIMISED CODE] - 2026-09-16

### 🔒 Security Hardening & Compliance
- **Full Account & Data Deletion (Fix #1):** Built and deployed dedicated Supabase Edge Function `delete-user-account` executing under service-role privileges to permanently delete user auth accounts (`auth.users`) along with complete database CASCADE deletes across all user tables (`profiles`, `categories`, `expenses`, `daily_savings_log`). Added client fallback and UI confirmation alerts.
- **End-to-End RLS Security Hardening (Fix #7):** Systematic security audit across all 4 database tables. Added `WITH CHECK` constraints to all UPDATE policies (`profiles`, `categories`, `expenses`, `daily_savings_log`) preventing identity and ownership spoofing. Hardened `categories` against modifying system defaults, secured trigger `search_path`, and restricted `delete_user_account` RPC execution strictly to authenticated users.

### ⚡ Reliability, Data Integrity & Offline Sync
- **Optimistic Rollback on API Failures (Fix #2):** Hardened `updateExpense` and `deleteExpense` in `expenseStore.ts` to snapshot previous state and automatically rollback local Zustand state if genuine non-network API calls fail, preventing permanent desync between local state and database.
- **Category ID Sanitization & Queue Drop Protection (Fix #3 & #4):** Replaced non-UUID placeholder IDs ('1'-'7') with disabled selection state in form UI until real categories load. Added UUID validation guard in `expenseStore.ts`, capped offline retry queue attempts to 5 with automatic poison-pill drop, and implemented persistent error handling with animated `SyncFailedBanner` to notify users.
- **Native OS Network Connectivity (Fix #6):** Replaced 45-second manual ping polling (`generate_204`/Cloudflare) with native `@react-native-community/netinfo` (v12.0.1) event listener (`NetInfo.addEventListener`). Uses `isConnected && isInternetReachable` as single source of truth to instantly detect real internet access without false positives on captive portals and without battery drain.

### 💰 Budget, Savings & Streak Accuracy
- **Budget-at-the-Time Persistence & Historical Fix (Fix #5):** Added `budget_amount` column to `daily_savings_log` so historical days are locked to the budget actually active then, rather than retroactively recomputing against today's setting.
- **Untracked Historical Dates & Streak Protection:** Untracked historical days finalized without prior records are marked `'unknown'` rather than using today's current budget. Excluded `'unknown'` days from streak and bestStreak calculations so they neither extend nor break streaks.
- **Neutral Streak Calendar Rendering:** Updated `StreakCalendarModal.tsx` and `SavingsScreen.tsx` to render `'unknown'` status days as neutral without green or red miss indicators.

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
