# Arthik — Product Requirements Document (PRD)

> **Version:** v2.1.0
> **Platform:** Android (primary). iOS config exists but is untested and unsupported.
> **Status:** Living document — updated atomically with every feature and architecture addition.

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
| Pure Mode vs Budget Mode | Pure Mode provides unconstrained expense tracking without spending blocks; Budget Mode activates multi-cadence spending limits, solvency guard, Gullak savings rollovers, and a 5th navigation tab (`Savings`). Mode switching schedules for tomorrow at midnight with same-day reversal protection (`PUR-003`); switching from Pure to Budget Mode with negative balance automatically balances the deficit into Total Income (`PUR-001`); pools ending in Pure retain unspent funds as `pureLeftover` without converting to income (`PUR-002`). |
| Multi-Cadence Budgets | User can configure spending allowances across three native cadences: **Daily**, **Weekly** (Mon–Sun), or **Monthly** (1st to month-end). |
| Zero-Proration Policy | Budgets configured mid-period are 100% active immediately without fractional day slicing (`isProrated: false`). |
| Dynamic Pace Guidance | Non-binding guidance: suggested daily pace (`remaining / remainingDays`), suggested weekly pace, and projected monthly spend based on actual 28, 29, 30, or 31 month days. |
| Next-Day Cadence Switch | Cadence switches schedule for tomorrow at 12:00 AM (00:00:00) so today's budget concludes cleanly under the active plan. |
| Carry-Forward Engine | Unspent funds carry forward on mid-cycle switch via **Additive** (added to first period's target budget) or **Allocation** (multi-period drawdown across Daily, Weekly, and Monthly targets: $\text{funded}_k = \min(B, \text{remaining}_{k-1})$, user adds only the gap, zero double counting in All-pill, and crisp lifecycle notifications). |
| Gullak Rollover Protection | Unspent allowance rolls into Gullak **strictly upon natural cycle completion** (Daily at 23:59:59, Weekly on Sunday at 23:59:59, Monthly at month-end). Mid-cycle switches carry forward with zero Gullak dumps. |
| Deficit Isolation | Overspending is settled from available income/Gullak reserves; carried forward deficit is clamped to 0 so new cadences start clean. |
| Digital Vault Spending Guard | Expense creation blocked in Budget Mode if total available liquidity (allowance + income + reserves) equals zero (`SEC-001`). Pure Mode allows spending into negative balance without blocking. |
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
| Budget progress alerts | Live in-app 80% threshold and silent over-budget banner alerts. |
| Concentric Bottom Navigation | Floating pill bar calibrated with exact 13px concentric padding parity ($R - r = 34 - 21 = 13\text{px}$) and balanced 5-tab spacing without FAB crowding. |

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
| Default categories | 7 expense + 5 income (Salary, Freelance, Interest, Gift, Other Income) system-seeded categories per user on signup (`CAT-001`). |
| Income categories | Income needs a category too. Pickers show only the side being saved; Manage Categories has an Expense \| Income toggle (`CAT-004`). |
| Custom categories | User-created with icon + color. |
| Category deletion | Blocked if transactions are attached (orphan prevention, `CAT-002`). |
| Offline category cache | Available on cold start without network. |
| Clean Canvas & Tactile List | Category management screen renders directly on the screen canvas with subtle dividers, full-height scroll clearance, and spring-scale press states. |

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
| Smart Push Policy | Scheduled notifications are delivered when their domain trigger is met (morning Gullak reward / carry cover, evening recaps, or evening nudge) without being artificially dropped or capped to 1 per day (`notificationPolicy.ts`). |
| Evening Nudge | Scheduled for 20:30 only on days with nothing logged. Automatically silences after 3 unopened evenings; logging an expense (manually or via AutoLog) cancels tonight's nudge immediately. |
| Gullak Morning Reward | Scheduled for 08:30 next morning for daily cadence users when yesterday was logged and ended with savings. |
| Periodic Recaps | Sunday 19:00 weekly recap (≥ 3 expenses) and month-end 21:00 monthly recap (≥ 6 expenses). |
| In-App Bell & Alerts | In-app notification center capped at 50 items with read/unread tracking. User-triggered events (80% used, daily rollover applied, budget plan updated) stay in-app; over-budget shows a silent banner. |
| Android Channels | 4 distinct channels (`Budget alerts`, `Reminders`, `Gullak updates`, `Weekly & monthly recaps`), each individually mutable in system settings. Toggleable in Profile. |
| Contextual Explainer Guides | In-app modal guides explaining pacing preview, rollover mechanics, and carry-forward rules (`MoneyExplainerModal`). |
| Help Centre (FAQ) | Complete Help Centre screen (`FaqScreen`) answering common budget and savings questions in clear English. |

### 4.11 Themes, In-App APK Updates & Versioning ✅ Shipped

| Feature | Detail |
|---|---|
| 3-Theme System | Light, Dark, and battery-saving AMOLED Pure Black (`DarkColors.amoled`) with 3-theme picker on Profile. |
| In-App Mandatory Updates | In-app APK downloading with progress bar and automatic package installer trigger (`REQUEST_INSTALL_PACKAGES` via `apkInstaller.ts` + `UpdateRequiredScreen`). |
| OTA updates | Branded in-app update modal with What's New highlights (`OtaUpdateModal`). |
| Force-Update Gate | Non-dismissible screen for legacy app versions (controlled via Supabase `app_config` and `version_control` tables). |
| EAS Build | APK via `preview` profile, AAB via `production`. |

### 4.12 Automatic Logging Engine (v2.0 & v2.1) ✅ Shipped

| Feature | Detail |
|---|---|
| Native Android Integration | Local Kotlin module (`modules/arthik-autolog`): `SmsReceiver` (broadcast receiver), `PaymentNotificationListener` (allow-listed email apps), `EventQueue`, and `AutoLogHeadlessService`. |
| Exclusive Authoritative Sources (Option A) | **Bank SMS** and **Bank Transaction Emails** (Gmail, Outlook, Samsung Email, Yahoo Mail, Proton Mail) are the exclusive inputs. Third-party payment app notifications (GPay, PhonePe, Paytm) are excluded to prevent duplicate review noise. |
| 100% On-Device Privacy | Raw SMS and email alert bodies are parsed strictly on-device using regex tokenizers and template hashing; zero raw communication text ever touches the network or cloud. |
| On-Device Encrypted Storage | High-security local SQLite database using **SQLCipher** via `expo-sqlite`, secured with a 256-bit encryption key in `expo-secure-store`. |
| Cross-Source Reconciliation | Unifies bank SMS and email alerts into a single transaction when both describe the same payment within a 15-minute window (`src/features/autoLog/matching.ts`). |
| Human-in-the-Loop Review | Confirmed bank transactions on tracked accounts auto-log immediately; new accounts, untracked accounts, transfers, or ambiguous merchants route to `Pending Review` (`AutoLogReviewSheet`). Arthik never guesses. |
| Swipe-to-Delete & Bulk Clear | `AutoLogReviewScreen` supports fluid swipe-to-reveal item deletion with spring physics and layout transitions, 1-tap "Clear All" bulk dismiss with confirmation, and direct discard inside `ReviewSheet` — always preserving deduplication hashes while pruning unneeded ledger rows. |
| Reset Learned Rules | `AutoLogCenterScreen` allows 1-tap factory reset of learned merchant categories and custom ignore rules (`merchant_prefs` and `rules`) without touching tracked bank accounts or past ledger transactions. |
| Historical Discovery Scanner | Scans past SMS on-device up to 90 days to discover bank accounts and formats before turning live tracking ON. |
| AutoLog UI Suite | Comprehensive screens: `AutoLogCenterScreen`, `AutoLogSetupScreen`, `AutoLogReviewScreen`, `AutoLogIntroScreen`, `AutoLogInfoScreen`, `AutoLogAccountsScreen`, `AutoLogEmailScreen`. |

### 4.12b Home Card Details

The Home card keeps Remaining, Total Income / Total Expense and ONE chip (`pickPrimaryChip`: Gullak drawn → over limit → budget used up → budget left → income). Tapping the card opens `HeroDetailsSheet` with Budget, Money in (including "Money back", never income) and Gullak for the selected period (`buildHeroDetails`). A running week / month shows "till today" / "till <date>". Display only: no money rule is involved.

### 4.13 Split Expenses, Money Back, Refunds & Self-Transfers

Canonical rules `SPL-001..SPL-006`, `TXN-004`, `TXN-003`:

| Topic | Behaviour |
|---|---|
| Expense shared with one or more people | A "Split" switch on the expense form (and a "Split this expense" button on logged expenses, including AutoLog ones). The user can add one or more participants with custom shares or equal split shortcut, with live calculation breakdown ("Your share ₹X · Total split ₹Y"). The expense keeps the full amount paid (`SPL-001`). |
| A friend paying you back | Add Money → "Friend paid back", or answer "Is this their payment?" on a notification, on the review screen, or on the income's detail screen. Money goes to the oldest unpaid expenses first. It reduces the original expenses (from their original days) and is **never income**. If more arrives than was owed, the extra is ordinary income. |
| A refund from a shop or company | Add Money → "Refund": who sent it and which expense it is for. Same effect as above. |
| Where the money returns | Budget goes back to that day's budget (and Gullak if that day was saved), income back to the Available Income pool, Gullak back to Gullak. Total Income never changes. |
| Ledger | A Ledger button on the Home header opens `LedgerScreen`: total to get back, each person's owed / shared / paid-back amounts, every shared expense (settled or what is left) and every payment back with dates. |
| History / detail | Money-back rows show as "Money back". An expense shows "Split with Name" and what came back; the detail screen shows what is still owed. Deleting a money-back row restores everything. |
| Transfer between your own accounts | Marked as a self-transfer (`transaction_class = 'self_transfer'`): never income, never expense, never touches budget or Gullak (`TXN-003`). The user can ask Arthik to remember a transfer note (`src/store/transferRulesStore.ts`). |

---

## 5. Non-Goals (Current Version)

The following are **explicitly out of scope** for v2.x:

- **Shared household ledgers**: Arthik is single-user authenticated. A split only records what named people owe you; other participants have no account, and shared multi-user ledger sync is out of scope.
- **Bank aggregator credentials sync**: No cloud bank aggregator APIs, NetBanking credentials, or screen-scraping (all automated detection is strictly 100% on-device via Bank SMS and Bank Email alerts).
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
| Dual-storage architecture | **Supabase Postgres** for authenticated user transactions, categories, and Gullak logs; on-device **SQLCipher encrypted SQLite** (`expo-sqlite`) for AutoLog events and review queues; **AsyncStorage** for local preferences and pending offline sync queues. |
| No backend application server | Supabase handles auth, storage, and edge functions. No custom Express/FastAPI server. |
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
| P3 | **Goal-based savings** | Park Gullak funds toward named goals (e.g. "Laptop ₹60,000") |

---

## 10. Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Offline queue corruption on crash mid-write | Low | High | AsyncStorage writes are atomic per key; rollback on app restart reads queue state |
| Rollover fires before hydration (budget miscalculation) | Low | High | `registerExpensesLoadedGetter` guard in `checkAndRollover`; tested in `dailyBudgetStore.test.ts` |
| Income misclassification after category rename | Medium | Medium | `isIncomeTransaction` prioritizes explicit `type` field; keywords are an inert legacy fallback only (`TXN-002`) |
| OTA to wrong runtime version | Low | High | `runtimeVersion.policy: "appVersion"` prevents mismatched bundle delivery |
| AsyncStorage key collision across users | Low | Critical | All keys are scoped per `userId`; `resetExpenses`/`resetCategories` clear on sign-out |
| Category orphan after delete | Eliminated | N/A | DB `ON DELETE SET NULL` + UI block if expenses attached |
