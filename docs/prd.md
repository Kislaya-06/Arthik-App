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

### 4.2 Multi-Cadence Budgeting & Smart Gullak ✅ Shipped

| Feature | Detail |
|---|---|
| Pure Mode vs Budget Mode | Pure Mode provides unconstrained expense tracking; Budget Mode activates multi-cadence spending limits, Gullak savings rollovers, and a 5th navigation tab (`Savings`). |
| Multi-Cadence Budgets | User can configure spending allowances across three native cadences: **Daily**, **Weekly** (Mon–Sun), or **Monthly** (1st to month-end). |
| Zero-Proration Policy | Budgets configured mid-period are 100% active immediately without fractional day slicing (`isProrated: false`). |
| Dynamic Pace Guidance | Non-binding guidance: suggested daily pace (`remaining / remainingDays`), suggested weekly pace, and projected monthly spend based on actual 28, 29, 30, or 31 month days. |
| Next-Day Cadence Switch | Cadence switches schedule for tomorrow at 12:00 AM (00:00:00) so today's budget concludes cleanly under the active plan. |
| Carry-Forward Engine | Unspent funds carry forward on mid-cycle switch via **Additive** (added to target budget) or **Allocation** (headstart towards target budget) modes. |
| Gullak Rollover Protection | Unspent allowance rolls into Gullak **strictly upon natural cycle completion** (Daily at 23:59:59, Weekly on Sunday at 23:59:59, Monthly at month-end). Mid-cycle switches carry forward with zero Gullak dumps. |
| Deficit Isolation | Overspending is settled from available income/Gullak reserves; carried forward deficit is clamped to 0 so new cadences start clean. |
| Digital Vault Spending Guard | Expense creation blocked at input boundary if total available liquidity (allowance + income + reserves) equals zero. |
| Gullak (accumulated savings) | Lifetime sum of all natural cycle savings + manual deposits − uncovered overspending. |
| Manual Gullak Deposit | Add savings directly into Gullak from tracked income or fresh external windfalls. |
| Cadence-Native Streak | Tracks consecutive saved periods in units matching active cadence (days, weeks, months). Paused intervals act as neutral bridges. |

### 4.3 Home Screen ✅ Shipped

| Feature | Detail |
|---|---|
| Dynamic Hero Mode | **Pure Mode**: Concentric Dual Ring chart (Inflow vs. Outflow) with 1-tap cashflow/percentage toggle. **Budget Mode**: Branded Hero Card with dynamic pace suggestions. |
| Cadence-Default Tab | App opens directly on the tab matching user's active cadence (`Daily` $\to$ Daily, `Weekly` $\to$ Weekly, `Monthly` $\to$ Monthly). |
| Period filters | Daily, Weekly, Monthly, All — unified income, spent, and balance across all time horizons. |
| Live today's spent | Updates instantly on every transaction without refresh. |
| Budget progress alerts | Live 80% and 100% threshold notifications. |

### 4.4 Savings Screen ✅ Shipped

| Feature | Detail |
|---|---|
| Gullak balance | Total accumulated savings headline with PiggyBank badge. |
| Dynamic Allowance Card | Displays active cadence bounds (e.g. *"29 Sep – 5 Oct"*), unspent balance, paused auto-renew hints, and luminous warm coral over-budget alerts. |
| Scheduled Switch Banner | Unboxed, luminous banner displaying countdown to 12:00 AM, target amount, and 1-tap cancel. |
| Savings timeline | Chronological list of past saved days + weekly/monthly periods + manual deposits. |
| Filter | All / This Week / This Month / Deposits. |
| Streak Calendar | Visual calendar (StreakCalendarModal) showing saved/missed/neutral days and monthly matrices. |
| Deposit management | Add and remove manual Gullak deposits. |

### 4.5 History Screen ✅ Shipped

| Feature | Detail |
|---|---|
| Transaction list | All transactions grouped by date, descending. |
| Search & filter | Filter by date range, category, payment mode. |
| Inline edit | Tap any transaction to open ExpenseDetail → Edit. |

### 4.6 Insights Screen ✅ Shipped

| Feature | Detail |
|---|---|
| Period navigation | Weekly / Monthly / Yearly with tactile bouncy filter pills. |
| Category breakdown | Spending split by category with dynamic palettes. |
| Spending flow chart | Consistent green gradient flow bars with peak clarity. |
| Timeline dots | Dynamic bounds derived from earliest transaction (no phantom dots). |

### 4.7 Categories ✅ Shipped

| Feature | Detail |
|---|---|
| Default categories | 7 system-seeded categories per user on signup. |
| Custom categories | User-created with icon + color. |
| Category deletion | Blocked if expenses are attached (orphan prevention). |
| Offline category cache | Available on cold start without network. |

### 4.8 Auth & Account ✅ Shipped

| Feature | Detail |
|---|---|
| Email magic link | Passwordless sign-in. |
| Google OAuth | One-tap sign-in. |
| Password reset | Deep-link flow with ResetPassword screen. |
| Profile setup | Name + budget setup on first login. |
| Account deletion | Two-step: email confirmation + final alert. |

### 4.9 Security & Privacy ✅ Shipped

| Feature | Detail |
|---|---|
| Digital Vault Spending Guard | Enforces real-money discipline; blocks expense creation when net liquidity is zero. |
| Biometric App Lock | Fingerprint / Face / Device PIN gate on launch and background resume. |
| RLS enforcement | All Supabase tables scoped to `auth.uid()`. |
| Deep link guard | Session fixation prevention on auth callbacks. |
| Android backup disabled | `allowBackup: false` prevents ADB extraction. |
| Category tenant isolation | `category_id` FK checked against user's own categories or system defaults. |

### 4.10 Notifications & Explainer Guides ✅ Shipped

| Feature | Detail |
|---|---|
| 80% & 100% budget alerts | Push notifications when spending reaches threshold. |
| In-app notification list | Notification screen with read/unread state, timestamps. |
| Contextual Explainer Guides | In-app modal guides explaining pacing preview, rollover mechanics, and carry-forward rules. |
| Help Centre (FAQ) | Complete Help Centre screen (`FaqScreen`) answering common budget and savings questions in clear English. |

### 4.11 Themes, OTA & Versioning ✅ Shipped

| Feature | Detail |
|---|---|
| 3-Theme System | Light, Dark, and battery-saving AMOLED Pure Black (`DarkColors.amoled`) with 3-theme picker on Profile. |
| OTA updates | Branded in-app update modal with What's New highlights (`OtaUpdateModal`). |
| Update Required screen | Non-dismissible screen for legacy app versions (controlled via `app_config` table). |
| EAS Build | APK via `preview` profile, AAB via `production`. |

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
