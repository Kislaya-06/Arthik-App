# Changelog

All notable changes to the **Arthik** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
