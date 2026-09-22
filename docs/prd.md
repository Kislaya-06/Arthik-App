# Arthik — Product Requirements Document (PRD)

> **Version:** v1.2.4
> **Platform:** Android (primary). iOS config exists but is untested and unsupported.
> **Status:** Living document — update on every significant feature addition.

---

## 1. Problem Statement

Most personal finance apps are either too complex (multi-bank sync, investment portfolios, tax reports) or too passive (spending graphs with no actionable daily feedback). Indian users, who largely transact in cash and UPI, need a simple, fast, daily-habit loop:

> *"How much can I spend today? Did I save anything yesterday? How is my Gullak growing?"*

Existing apps fail on three counts:
1. They require constant internet connectivity — useless at a roadside stall with spotty data.
2. They focus on historical reporting, not live daily decision-making.
3. They feel foreign — designed for Western banking, not the Indian UPI + cash reality.

---

## 2. Target User

**Primary persona**: Salaried Indian professional or student, aged 18–32, with a monthly income between ₹15,000–₹80,000. Pays via cash, UPI (PhonePe/GPay/BHIM), and occasionally debit/credit card. Has tried budgeting apps before but abandoned them because manual entry felt tedious.

**Core habits Arthik supports:**
- Logging a chai at ₹20 in 3 seconds
- Checking "how much is left for today" at a glance
- Feeling motivated by a growing Gullak savings number

---

## 3. Core Value Proposition

> **Arthik turns unspent daily budget into real, visible savings — automatically.**

Every rupee you don't spend today becomes a rupee in your Gullak tonight. No manual transfers. No round-up tricks. Just discipline, rewarded instantly.

---

## 4. Feature Inventory

### 4.1 Transaction Logging ✅ Shipped

| Feature | Detail |
|---|---|
| Add transaction | Amount (with in-keypad calculator), category, note, payment mode (Cash / UPI / Card), date |
| Transaction types | Expense (deducts from daily allowance) and Income (tracked separately, does not affect allowance) |
| Edit transaction | All fields editable |
| Delete transaction | Confirm dialog, immediate removal with Supabase sync |
| Payment modes | Cash, UPI, Card |
| Note suggestions | Autocomplete from recent notes, ranked by recency + frequency + category affinity |
| Offline logging | Fully functional offline; syncs on reconnect |

### 4.2 Daily Budget & Gullak ✅ Shipped

| Feature | Detail |
|---|---|
| Recurring Allowance | User sets a daily budget (₹/day). Auto-applies each morning when Auto-Renew is on. |
| Day's Allowance override | Override today's budget without changing the profile baseline |
| Top-up | Add extra budget to today without changing the profile baseline |
| Daily Savings auto-rollover | 100% of unspent allowance rolls into the Gullak at midnight |
| Gullak (accumulated savings) | Lifetime sum of all daily savings + manual deposits − overspending |
| Manual Gullak Deposit | User can manually deposit extra funds (salary, gifts) directly into the Gullak |
| Savings streak | Consecutive past days with `saved > 0`; resets on exceeded or even days |
| Day status | Active / Saved / Exceeded / Even / Unknown |

### 4.3 Home Screen ✅ Shipped

| Feature | Detail |
|---|---|
| Hero card | Dual-arc donut chart: today's income pool vs. spent. Remaining allowance centered. |
| Period filters | Daily, Weekly, Monthly, All — all show unified income/spent/balance |
| Live today's spent | Updates instantly on every transaction without refresh |
| Gullak rollover strip | Shows tonight's projected savings accumulation |
| Budget progress | Live 80% and 100% threshold notifications |

### 4.4 Savings Screen ✅ Shipped

| Feature | Detail |
|---|---|
| Gullak balance | Total accumulated savings headline |
| Savings timeline | Chronological list of past saved days + manual deposits |
| Filter | All / This Week / This Month / Deposits |
| Streak Calendar | Visual calendar (StreakCalendarModal) showing saved/missed/neutral days |
| Deposit management | Add and remove manual Gullak deposits |

### 4.5 History Screen ✅ Shipped

| Feature | Detail |
|---|---|
| Transaction list | All transactions grouped by date, descending |
| Search & filter | Filter by date range, category, payment mode |
| Inline edit | Tap any transaction to open ExpenseDetail → Edit |

### 4.6 Insights Screen ✅ Shipped

| Feature | Detail |
|---|---|
| Period navigation | Weekly / Monthly / Yearly with elastic hero card |
| Category breakdown | Spending split by category |
| Timeline dots | Dynamic bounds derived from earliest transaction (no phantom dots) |

### 4.7 Categories ✅ Shipped

| Feature | Detail |
|---|---|
| Default categories | 7 system-seeded categories per user on signup |
| Custom categories | User-created with icon + color |
| Category deletion | Blocked if expenses are attached (orphan prevention) |
| Offline category cache | Available on cold start without network |

### 4.8 Auth & Account ✅ Shipped

| Feature | Detail |
|---|---|
| Email magic link | Passwordless sign-in |
| Google OAuth | One-tap sign-in |
| Password reset | Deep-link flow with ResetPassword screen |
| Profile setup | Name + daily budget on first login |
| Account deletion | Two-step: email confirmation + final alert |

### 4.9 Security & Privacy ✅ Shipped

| Feature | Detail |
|---|---|
| Biometric App Lock | Fingerprint / Face / Device PIN gate on launch and background resume |
| RLS enforcement | All Supabase tables scoped to `auth.uid()` |
| Deep link guard | Session fixation prevention on auth callbacks |
| Android backup disabled | `allowBackup: false` prevents ADB extraction |
| Category tenant isolation | `category_id` FK checked against user's own categories or system defaults |

### 4.10 Notifications ✅ Shipped

| Feature | Detail |
|---|---|
| 80% budget alert | Push notification when today's spending hits 80% of allowance |
| 100% budget alert | Push notification when today's spending hits or exceeds allowance |
| In-app notification list | Notification screen with read/unread state, timestamps |

### 4.11 OTA & Versioning ✅ Shipped

| Feature | Detail |
|---|---|
| OTA updates | Branded in-app update modal with What's New highlights |
| Update Required screen | Non-dismissible screen for legacy app versions (controlled via `app_config` table) |
| EAS Build | APK via `preview` profile, AAB via `production` |

---

## 5. Non-Goals (Current Version)

The following are **explicitly out of scope** for v1.x:

- **Multi-user / shared households**: Arthik is single-user only. No family budgets, shared expenses, or split bills.
- **Bank account sync**: No API integration with banks, UPI providers, or credit card statements.
- **Investment tracking**: No mutual funds, SIPs, or stock portfolio.
- **Recurring expense automation**: No auto-detected or rule-based recurring entries.
- **iOS support**: iOS config exists in `app.json` but is untested and unsupported.
- **Web app**: React Native only.
- **Multi-currency**: INR (₹) only.

---

## 6. Constraints

| Constraint | Detail |
|---|---|
| Offline-first | App must be fully functional without internet (ADR 0001) |
| Single database | Supabase Postgres. No local SQLite. No WatermelonDB. |
| No backend server | Supabase handles auth, storage, and edge functions. No custom Express/FastAPI server. |
| Indian number format | All amounts displayed in Indian grouping (`₹1,00,000`) via `formatCurrency` |
| Date = local day | "Today" always means the device's local date. UTC is never used for date boundaries. |
| 60 FPS on mid-range Android | Target devices: 4 GB RAM, Android 11–14, mid-range Snapdragon/MediaTek |

---

## 7. UX Principles

1. **Speed above all**: Logging a transaction must take ≤ 3 taps and < 5 seconds.
2. **No friction for common flows**: The add-expense screen opens ready to type an amount — no modal chains.
3. **Instant feedback**: Balance, streak, and Gullak update immediately on every add/delete.
4. **Tactile delight**: Spring animations, swipe gestures, haptic-style micro-interactions. The app should feel premium.
5. **Honest errors**: Never silently fail. If a sync fails, the user is shown a SyncFailedBanner with retry.
6. **Dark by default**: Both light and dark themes are first-class. Brand: mint green + peach coral on navy.

---

## 8. Success Metrics

| Metric | Target |
|---|---|
| Daily active retention (D7) | > 40% |
| Avg. transactions logged per DAU per day | ≥ 2 |
| Crash-free session rate | > 99.5% |
| Offline logging success rate | 100% (nothing lost while offline) |
| Sync conflict rate (failed sync items) | < 1% of all writes |
| Savings streak ≥ 3 days (among DAUs) | > 30% of DAUs |

---

## 9. Roadmap (Candidate Features)

These are **not committed**. They are tracked here to inform architectural decisions.

| Priority | Feature | Notes |
|---|---|---|
| P1 | **Recurring expense templates** | One-tap log for fixed monthly bills (rent, EMI). No auto-creation — user always confirms. |
| P1 | **Budget categories (spending caps per category)** | Alert when Food & Drinks exceeds ₹5,000/month |
| P2 | **Export to CSV / PDF** | Monthly statement for tax or personal records |
| P2 | **iOS TestFlight release** | Requires testing all native modules on iOS |
| P2 | **Widget (Android home screen)** | Today's remaining allowance + Gullak balance |
| P3 | **Split bill** | Between Arthik users only — no external integrations |
| P3 | **Goal-based savings** | Park Gullak funds toward named goals (e.g. "Laptop ₹60,000") |

---

## 10. Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Offline queue corruption on crash mid-write | Low | High | AsyncStorage writes are atomic per key; rollback on app restart reads queue state |
| Rollover fires before hydration (budget miscalculation) | Low | High | `registerExpensesLoadedGetter` guard in `checkAndRollover`; tested in `dailyBudgetStore.test.ts` |
| Income misclassification after category rename | Medium | Medium | `isIncomeTransaction` prioritizes explicit `type` field; keywords are fallback only |
| OTA to wrong runtime version | Low | High | `runtimeVersion.policy: "appVersion"` prevents mismatched bundle delivery |
| AsyncStorage key collision across users | Low | Critical | All keys are scoped per `userId`; `resetExpenses`/`resetCategories` clear on sign-out |
| Category orphan after delete | Eliminated | N/A | DB `ON DELETE SET NULL` + UI block if expenses attached |
