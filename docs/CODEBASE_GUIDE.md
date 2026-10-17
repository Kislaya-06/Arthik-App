# Arthik — Codebase Guide (kahan kya hai, kaun si file kya karti hai)

Ye guide **ab ki state** par hai: pehla package + Pure Mode + CAR-001 Mode B + last fixes sab apply hone ke baad. Isme 204 source files, 89 test entries, native Android module aur docs ka naksha hai.

**Kaise bani:** maine har file ka header comment, exports, aur core money files (waterfall, budget periods, home calculations, notification policy, stores, AutoLog) seedha padhe hain. UI components (buttons, charts, modals) ke baare mein likha hai wo unke naam aur exports se hai, unki andar ki logic maine line-by-line nahi padhi. Jahan ye farak matter karta hai wahan likh diya hai.

---

## 0. Is guide ko kaise padhein
1. Pehle **section 1 aur 2** padho. Ye app ka dimaag hai. Baaki sab isi par tika hai.
2. Phir **section 3** (layers) aur **section 4** (folder map).
3. Kuch dhundhna ho to **section 14** (kya badalna hai to kahan jao) dekho.
4. Rules ke liye asli authority `docs/ARTHIK_CANONICAL_RULES.md` hai. Ye guide us file ki jagah nahi leti.

---

## 1. App ek paragraph mein
Arthik ek **expense aur savings tracker** hai (React Native + Expo, sirf Android, Supabase backend). User income aur kharch likhta hai. Chahe to **budget** (daily, weekly ya monthly) set karta hai, aur bacha hua budget **Gullak** (savings box) mein jaata hai. App offline bhi chalta hai. Bank SMS aur bank emails se kharch **apne aap** bhi log ho sakte hain (AutoLog).

### Shabdkosh (ye sab jagah milenge)
| Shabd | Matlab |
|---|---|
| **Budget Mode** (Gullak mode) | Budget + Gullak + spending guard on. `isBudgetModeEnabled = true` |
| **Pure Mode** | Sirf tracking. Koi limit nahi, Gullak screen par nahi dikhta. Par paise ka hisaab **wahi** rehta hai (sirf screen badalti hai) |
| **Cadence** | Budget kitne din ka: `daily`, `weekly` (Monday se), `monthly` |
| **Allowance / budget pool** | Ek din/hafte/mahine ke liye alag rakha hua kharch ka paisa |
| **Income** | User ne jo income likhi (`type = 'income'`) |
| **Gullak** | Bachat. Sirf do raaste se paisa aata hai: period ke end mein bacha budget, aur manual deposit |
| **Waterfall** | Kharch kahan se kata, uska hisaab: pehle budget, phir income, phir Gullak |
| **Remaining (All)** | Poore account mein kitna bacha: allowance + income + external deposits − kharch. Minus bhi ho sakta hai |
| **Carry** | Cadence badalte waqt bacha hua paisa naye plan mein le jaana (Mode A ya B) |
| **Self-transfer** | Apne hi accounts ke beech paisa. Na income, na expense |
| **Missed / Saved / Even** | Ek din ya period ka status: budget se zyada kharch / bacha / bilkul barabar |

---

## 2. Paise ka dimaag (derive karke)

Ye hissa sabse zaroori hai. Har rule ek **asli samasya** se nikla hai.

### Samasya 1: "Ye ₹500 kharch kahan se hua?"
User ne ₹800 kharch kiya, par aaj ka budget ₹500 tha. Baaki ₹300 kahan se gaya?
- Agar app kuch na bataye, to Home, Gullak aur detail screen alag-alag number dikhayenge.
- **Hal:** ek hi jagah ka hisaab, `src/lib/moneyWaterfall.ts`. Rule: **pehle budget, phir income, phir Gullak.**
- Samay ka dhyan: har din pehle income aur deposits lagte hain, phir kharch (WAT-002). Isliye aaj aayi income, kal ke overspend ko "kha" nahi sakti.
- Home chips, Gullak total aur expense-detail ka funding card, **sab isi ek function se** padhte hain. Isliye kabhi alag number nahi dikhte.

### Samasya 2: "Income Gullak mein chali gayi to?"
Agar income Gullak mein jaati, to user ka "bachat" jhoota hota (income to kharch ke liye thi).
- **Hal:** Income **kabhi apne aap Gullak mein nahi jaati** (BUD-003). Gullak mein sirf (a) period ka bacha **budget**, (b) manual deposit jaata hai.

### Samasya 3: "Gullak mein asli paise se zyada dikh gaya"
- **Hal:** Gullak = `min(accumulated savings, Total Remaining ≥ 0)` (GUL-001). Gullak kabhi minus ya asli paise se zyada nahi.

### Samasya 4: "Beech mahine mein cadence badal di, bacha paisa kahan jaaye?"
Maan lo Monthly mein ₹13,000 bacha tha. Ab user Weekly ₹5,000 karta hai.
- Gullak mein bhej do? Ye galat hoga, kyunki mahina khatam nahi hua (CAR-001 kehta hai switch ki raat kuch Gullak mein nahi jaata).
- **Hal: Carry** (`src/lib/cadenceSwitch.ts`, `budgetPeriods.ts`). Do mode:
  - **Mode A (Additive):** bacha paisa naye budget ke upar jud jaata hai.
  - **Mode B (Allocation):** bacha paisa aane wale periods ko fund karta hai. Daily/Weekly/Monthly teeno target par chalta hai. Example: ₹13,000 carry, weekly ₹5,000 to hafta 1 aur 2 poore carry se fund, hafta 3 mein ₹3,000 carry se aur ₹2,000 ka gap user ka.
- **All-pill:** sirf carry se fund hua hissa All se bahar rehta hai; gap normal budget ki tarah judta hai. Home All pill aur andar ka total **hamesha same number** hone chahiye.
- Jab carry khatam ho jata hai, ek notification aati hai: "Carried money has run out… Add ₹X".

### Samasya 5: "Pure Mode mein user ko budget wali soch nahi chahiye"
- **Hal (PUR rules):**
  - Pure Mode mein kharch kabhi block nahi hota, minus bhi ja sakta hai (SEC-001).
  - Pure Mode mein period khatam ho to bacha paisa **income nahi banta**, koi message nahi aata. Wo chhupa "pureLeftover" rehta hai (PUR-002). Pure mein kharch hone par pehle leftover, phir income, phir Gullak.
  - Pure se Budget Mode mein aate waqt agar Remaining minus hai, to utni **auto-income** jud jaati hai (note: `Auto-balance (Pure Mode deficit)`), aur ek notification aati hai (PUR-001). Ye income Home ke budget-chip wale income mein nahi dikhti, par Total Income mein dikhti hai.

### Samasya 6: "Ek hi cheez 'income' ya 'expense' kaise tay ho?"
- **Hal:** `type` field hi sab kuch tay karta hai (TXN-001). Category ke naam se andaza nahi lagta (keyword fallback sirf purani rows ke liye, jo ab practically use nahi hoti, TXN-002).
- Apne accounts ke beech paisa: `transaction_class = 'self_transfer'`. Ye kabhi income ya expense nahi gina jaata (TXN-003).
- Dost ka paisa wapas aana ya refund: sirf **Income** (TXN-004). Split/Shares feature ab app mein nahi hai (REF-001).

### Samasya 7: "Paisa nahi hai to kharch kaise?" (Budget Mode)
- **Hal:** Spending guard (`vaultSpendingGuard.ts`): agar poore account ka paisa 0 ya kam hai to naya kharch block, aur message: "Account balance exhausted. Please add money first." Ye sirf Budget Mode mein hai.

---

## 3. App ki layers (kaun kisse baat karta hai)

```
 Screens (src/screens)  ─ user dekhta hai
     │ use karte hain
 Components (src/components) + Hooks (src/hooks)
     │ padhte / likhte hain
 Stores (src/store)  ─ zustand, state + Supabase + offline queue
     │ calculation ke liye bulate hain
 Lib (src/lib)  ─ PURE functions (React, store, network kuch nahi)
     │
 Supabase (schema.sql)   AsyncStorage (offline cache)   SQLite (AutoLog, encrypted)
```

**Do pakke niyam:**
1. **`src/lib` ke engines pure hain.** Input do, number lo. Inhe test karna aasan hai, aur yahi paise ka hisaab karte hain.
2. **Stores aapas mein seedha import nahi karte.** Wo ek doosre ko "registration callbacks" se jaante hain (ADR 0005). Jaise `registerExpenseGetter`, `registerAddExpense`, `registerStoreResetCallback`. Isse circular import nahi banta.

---

## 4. Folder map

| Path | Kya hai |
|---|---|
| `App.tsx`, `index.ts` | App ki shuruaat. `index.ts` AutoLog ka background task import karta hai |
| `src/screens/` | Poori screens (Home, History, Savings, Insights, Profile, form, AutoLog...) |
| `src/components/` | Reusable UI: cards, modals, charts, buttons |
| `src/hooks/` | Screens ke liye logic hooks |
| `src/store/` | Zustand stores (data + sync) |
| `src/lib/` | Pure calculation engines + helpers |
| `src/features/autoLog/` | Automatic logging ka poora system |
| `src/navigation/` | Tabs aur stack |
| `src/config/` | Supabase client, theme (colors, spacing, fonts) |
| `src/types/` | Shared TypeScript types |
| `modules/arthik-autolog/` | Android (Kotlin) native module |
| `supabase/` | SQL migrations aur `delete-user-account` edge function |
| `schema.sql` | Database ka poora structure (source of truth) |
| `tests/` | Vitest tests (`npm test`) |
| `docs/` | Documentation (section 12) |
| `AGENTS.md` | AI agent ke liye rules (canonical supremacy, doc-sync checklist) |
| `CONTEXT.md` | Domain ki shabdawali |
| `CHANGELOG.md` | Har badlav ka record |
| `app.json`, `eas.json` | Expo config, OTA highlights, build config |

Commands: `npm test` (vitest), `npm run typecheck` (tsc), `npm start`.

---

## 5. App kaise shuru hota hai

**`App.tsx`** (maine seedha padha):
1. Version check (`versionCheck.ts`): agar app purana ho to `UpdateRequiredScreen`.
2. OTA update check (`otaStore`).
3. Notification sync start (`startNotificationSync`), notification tap handler.
4. Login hone par: pending offline kharch load, categories fetch, kharch fetch, `dailyBudgetStore.hydrateFromSupabase(userId)`, phir internet ho to pending sync.
5. App foreground aane par: pending sync, pending daily records upload, app lock check.

**Navigation (`src/navigation/index.tsx`):**
- Tabs: **Home, History, Savings, Insights**.
- Stack screens: Splash, Onboarding, Auth, ResetPassword, ProfileSetup, AppTabs, AddExpense/EditExpense (dono `ExpenseFormScreen`), ExpenseDetail, GullakDepositDetail, CategoryDetail, ManageCategories, AddEditCategory, Notifications, Savings, Profile, Faq, aur AutoLog ki 8 screens.
- Savings tab Pure Mode mein guard hota hai (`GuardedSavings...`).

---

## 6. Database (`schema.sql`)

| Table | Kya rakhti hai |
|---|---|
| `profiles` | User profile + budget settings (budget mode, cadence, amounts) |
| `categories` | Categories (system defaults + user ki apni) |
| `expenses` | **Har transaction** (expense + income). Key columns: `amount`, `type`, `category_id`, `payment_mode` (cash/upi/card), `expense_date`, `transaction_class` (`normal`/`self_transfer`), `note` |
| `daily_savings_log` | Daily records: budget, spent, saved, `status` (`saved`/`missed`/`even`/`unknown`) |
| `gullak_deposits` | Manual deposits (source: income ya external) |
| `budget_plan_changes` | Cadence/amount ka itihaas (kab se kaunsa plan, carry mode, carried amount) |
| `budget_periods` | Weekly/monthly periods ke finalized records |
| `app_config` | App ke remote flags (jaise AutoLog rollout, version) |
| `autolog_profiles` | AutoLog ki settings (message ka content nahi) |
| `self_transfer_rules` | "Is note ko apna transfer maano" wale yaad rakhe hue rules |
| `expense_shares` | **Retired** (Split feature hata diya). Table rakhi hai, app use nahi karti, data delete nahi hua |

- `handle_new_user()` function naye user ke liye profile aur default categories banata hai.
- **Migrations** (`supabase/migrations/`): budget modes (Oct), autolog profiles, release v2 flags, aur `20261017_retire_shares_reimbursements.sql` (purane reimbursement rows ko normal income banata hai).
- Row-level security: har user sirf apna data dekhta hai (ADR 0004).

---

## 7. Money engine: `src/lib/` file by file

### Transaction ki pehchaan
| File | Kya karti hai |
|---|---|
| `transactionUtils.ts` | `isCountedIncome` / `isCountedExpense` / `isExcludedFromTotals` / `getTransactionClass`. Tay karti hai ki ek row income hai, expense hai ya self-transfer. Yahan `PURE_DEFICIT_NOTE` bhi hai (Pure Mode ki auto-income ka fixed note) |
| `incomeClassifier.ts` | Upar wale functions ko category ke saath jodkar "classifier" banata hai jo poori list par chalta hai |
| `transferRules.ts` | Self-transfer rules ka pure logic: note ko normalize karna aur match karna. Sirf note se, kabhi amount se nahi |
| `paymentUtils.ts` | Payment mode ke icon aur label |

### Budget aur periods
| File | Kya karti hai |
|---|---|
| `budgetCalculations.ts` | Core hisaab: `calculateCycleFinancials` (ek period ka spendable/remaining/status), `evaluateDayStatus` (din saved/missed/even), `computeSpentByDate`, `computeIncomeByDate`, streak aur savings metrics, `DailyRecord` type |
| `budgetPeriods.ts` (1114 lines, sabse bada engine) | Cadences, period ki seemayen (Monday week), kis date ka maalik kaun (`getDateOwner`: daily/weekly/monthly/paused), **budget pools** (`buildBudgetPools`), carry (`dailyCarryForDate`, `dailyCarryRemaining`, `carryForPeriod`, `periodCarryForPeriod`, `periodCarryRemaining`), period finalize, streaks. Pure, `new Date()` nahi |
| `cadenceSwitch.ts` | Cadence badalte waqt: kya bacha hai, carry kitna, validation (`checkCadenceCapacity`), `buildCadenceSwitchPlan`, aur Mode B ka summary (`computeAllocationSummary`) jo modal ka text banata hai |
| `budgetUtils.ts` | Phantom ₹500 rows pehchanna, hydrate ke waqt budget resolve karna, rollover budget |
| `budgetModeUtils.ts` | Mode ke hisaab se kaunse tabs dikhein, subtitle/labels, streak cards |
| `dateFilters.ts` | Date kisi period (day/week/month/all) mein hai ya nahi |

### Kharch ka funding aur display
| File | Kya karti hai |
|---|---|
| **`moneyWaterfall.ts`** | **"Paisa kahan se aaya" ka ek hi sach.** Samay ke kram mein chalta hai. Output: har kharch ka `fromBudget / fromLeftover / fromIncome / fromGullak`, din-wise hisaab, income bacha, Gullak kitna kata, `pureLeftover` (added/used/remaining) |
| `transactionFunding.ts` | Ek kharch ke detail screen ka funding breakdown (waterfall se) |
| `homeCalculations.ts` | **Home ke hero card ka dimaag.** `calculatePeriodSummary` 4 filters (All/Daily/Weekly/Monthly) ka primary amount, label, subtext banata hai. Display ka copy bhi yahin se aata hai (jaan-boojhkar, taaki sab filters ek hi logic use karein). `PURE_DEFICIT_NOTE` wali auto-income budget chip ke income se bahar rakhta hai |
| `vaultSpendingGuard.ts` | Spending guard ka hisaab: `canAddExpense` + `VAULT_GUARD_MESSAGE`. Pure Mode mein hamesha allowed |

### Insights (sab pure)
`weeklyInsightsUtils.ts`, `monthlyInsightsUtils.ts`, `yearlyInsightsUtils.ts` (weekly/monthly/yearly spend, budget health, safe daily pace, day-matched comparisons, takeaways), `insightsCommon.ts` (shared types).

### Notifications
| File | Kya karti hai |
|---|---|
| `notificationPolicy.ts` | **Notification ka rulebook** (pure). Kab, kya, kitna bolna hai: log nudge, gullak reward, weekly/monthly recap, carry cover, carry-ended notice. Channels, copy, priorities |
| `notificationSync.ts` | App ke data se `PlanContext` banata hai (`buildPlanContext`, `buildCarryDays/Periods/Ends`) aur plan lagata hai; jab data badle to dobara plan |
| `notificationService.ts` | `expo-notifications` ke saath asli kaam: permission, schedule, cancel |
| `budgetAlerts.ts` | Real-time alerts: limit cross hui, rollover hua, budget update/resume. (Alert kind `exceeded` yahan hai, ye budget status nahi) |

### Auth, update, network
`authLinkHandler.ts` + `deepLinkGuard.ts` (email deep links aur session fixation se bachav), `versionCheck.ts` (kam se kam version), `apkInstaller.ts` (APK download/install), `networkUtils.ts` (network failure pehchanna, timeout), `asyncStorageList.ts` (list save/load).

### UI helpers (paise ka hisaab nahi)
`formatters.ts` (`round2`, currency), `amountKeypad.ts` (calculator keypad: `2+3*4` jaisa expression), `chartUtils.ts` (charts ke paths/segments/data), `colorUtils.ts`, `iconUtils.ts`, `flameUtils.ts`, `rollingText.ts` + `quicksandMetrics.ts` (digits ka rolling animation), `pullToHistoryPhysics.ts` (Home se pull karke History kholne ki physics), `ambientBackground.ts` + `ambientGrain.ts` + `ambientWind.ts` (screen ka halka glow background), `animationUtils.ts`, `streakCalendarData.ts`, `expenseFilters.ts`, `noteSuggestions.ts`, `moneyExplainerContent.ts` (help popups ka text).

---

## 8. Stores: `src/store/` file by file

### `dailyBudgetStore.ts` (874 lines) + `src/store/dailyBudget/`
Budget ka poora dimaag. Persist key: `arthik-daily-budget-storage-v2` (version 4, `exceeded`→`missed` migration).

State: `dailyRecords`, `gullakDeposits`, `totalAccumulatedSavings`, `savingsStreak`, `isBudgetModeEnabled`, `budgetCadence`, weekly/monthly amounts, `planChanges`, `budgetPeriods`, notification dedupe keys.

Is store ko chhote modules mein toda gaya hai (ADR 0013):
| File | Kaam |
|---|---|
| `types.ts` | `DailyBudgetState` aur saari actions ke types |
| `metrics.ts` | **Balance selectors.** `runWaterfall`, `computeAllTimeBudget`, `computeTotalAccountRemaining` (minus bhi ho sakta hai), `computeAvailableIncomeBalance`, `computeCarryableAmount`, `computeMetrics` (Gullak total + cap) |
| `planActions.ts` | Budget set karna, cadence badalna (`handleSetBudgetCadence`), mode on/off (`handleSetBudgetModeEnabled`, yahin **Pure deficit auto-income** `balancePureDeficitIfNeeded` hai), scheduled next-day budget, pending plan sync |
| `rollover.ts` | Din/period ka finalize: `finalizeDailyRecords`, `finalizePeriods`, `groupSpentByDate` |
| `hydrate.ts` | Supabase se data laana (`runHydrateFromSupabase`) aur offline start |
| `selfHealing.ts` | Purani galat rows ko theek karna (₹500 default, galat daily rows) |
| `pendingStorage.ts` | Offline queue ke AsyncStorage keys (settings, plan changes, periods, gullak adds/deletes) |
| `expenseBridge.ts` | Expense store tak pahunchne ka "bridge" (`getCurrentExpenses`, `addExpenseFromBridge`) |
| `classifiers.ts` | Category/income classifier banane ke helpers |
| `legacyStatus.ts` | Purane `'exceeded'` status ko `'missed'` banata hai |

Mukhya actions: `syncWithExpenses` (har kharch ke baad), `checkAndRollover` (din badalne par), `setBudgetCadence`, `setBudgetModeEnabled`, `addGullakDeposit`, `hydrateFromSupabase`.

### `expenseStore.ts` (685 lines) + `src/store/expense/`
Saare transactions. **Offline-first** (ADR 0001): kharch pehle **turant screen par** aata hai (optimistic), phir Supabase ko jaata hai; internet na ho to AsyncStorage ki queue mein rukta hai.
| File | Kaam |
|---|---|
| `types.ts` | `Expense`, pending types |
| `pendingQueues.ts` | Queue ke keys, retry/backoff, UUID check, failed items |
| `syncPending.ts` | Pending adds/updates/deletes ko server par bhejna. Purani `reimbursement` class ko normal bana deta hai |

### Baaki stores
| Store | Kaam |
|---|---|
| `authStore.ts` | Login session, profile, sign out, account delete. `registerStoreResetCallback` se sab stores ko reset karta hai |
| `categoryStore.ts` | Categories (7 built-in default + user ki), add/update/delete (default delete nahi hoti), offline sync |
| `transferRulesStore.ts` | Remembered self-transfer rules (`self_transfer_rules` table) |
| `networkStore.ts` | Online/offline, banner, jab internet aaye to sync callback |
| `notificationStore.ts` | In-app notification inbox (bell). Persist: `arthik-notifications-storage-v2` |
| `appLockStore.ts` | App lock (phone ka biometric / screen lock se unlock) |
| `otaStore.ts` | Expo OTA update check + modal |
| `themeStore.ts` | Light/Dark/AMOLED theme (`useTheme`) |
| `ambientStore.ts` | Ambient background on/off preference |
| `navBarStore.ts` | Bottom nav bar dikhana/chhupana |

---

## 9. Screens

| Screen | Kya karti hai |
|---|---|
| `HomeScreen.tsx` | Hero card (All/Daily/Weekly/Monthly), chips, recent transactions. `calculatePeriodSummary` aur waterfall use karti hai |
| `ExpenseFormScreen.tsx` (1152 lines) | Kharch/income add aur edit. Logic `useExpenseForm.ts` mein. Spending guard yahin se chalta hai |
| `ExpenseDetailScreen.tsx` | Ek transaction ki detail + funding card |
| `HistoryScreen.tsx` | Transactions ki list aur filters |
| `SavingsScreen.tsx` (+ `.styles.ts`) | Budget hub, Gullak, streaks, deposits. Components `components/savings/*` |
| `InsightsScreen.tsx` + `screens/insights/` | Weekly/Monthly/Yearly insights. Data `useInsightsData.ts` (929 lines) |
| `ProfileScreen.tsx` | Profile, settings, budget pause, app lock, AutoLog entry |
| `AuthScreen`, `ResetPasswordScreen`, `ProfileSetupScreen`, `OnboardingScreen`, `SplashScreen` | Login, password reset, shuruaati flow |
| `NotificationsScreen.tsx` | In-app notification inbox |
| `ManageCategoriesScreen`, `AddEditCategoryScreen`, `CategoryDetailScreen` | Categories ka kaam |
| `GullakDepositDetailScreen.tsx` | Ek Gullak deposit ki detail |
| `FaqScreen.tsx`, `UpdateRequiredScreen.tsx` | FAQ, zaroori update |
| `screens/autolog/*` | AutoLog: Center, Setup, Review (pending), Accounts, Email, Info/Privacy, Intro, WelcomeBack |

---

## 10. Components (naam se, andar ki logic maine line-by-line nahi padhi)

- **Home/Hero:** `BrandedHeroCard` (bada hero card), `RollingText` (digits ka animation), `ExpenseFundingCard`, `TransactionRow`, `PullToHistoryList` + `PullToHistoryIndicator`.
- **Budget/Savings:** `BudgetEditModal`, `CadenceSwitchModal` (cadence switch + carry mode chunna), `PeriodRenewalModal`, `DepositGullakModal`, `StreakCalendarModal`, `StreakFlame`, `SavingsRecordRow`, `GullakDepositRow`, `VaultSpendingGuardModal`, `MoneyExplainerModal`, `components/savings/*`, `components/profile/PauseBudgetModal`.
- **Charts:** `CashFlowChart`, `YearlyCashFlowChart`, `SpendingFlowChart`, `DonutChart`, `DualRingChart`, `AnimatedCategoryDonut`, `BreathingStripShell` + Weekly/Monthly/Yearly strips, `YearlySavingsMilestoneCard`, `BehavioralInsightRow`.
- **Form:** `BouncyTypeToggle`, `BouncyPaymentToggle`, `BouncyCategoryFilter`, `KeyButton`, `ui/KeypadGrid`, `CustomDatePickerModal`, `transfer/TransferExtras` (self-transfer switch), `transfer/TransferDetailCard`.
- **App-wide:** `BottomNavBar`, `AmbientBackground`, `AppLockOverlay`, `OfflineBanner`, `SyncFailedBanner`, `OtaUpdateModal`, `ErrorBoundary`, `AppRefreshControl`, `RefreshScrollShell`.
- **`components/ui/`:** design-system ke chhote tukde: `AppButton`, `AppInput`, `AmountText`, `SegmentedControl`, `BottomSheetModal`, `StatusBadge`, `ItemRowShell`, `AuthFormField`, `AuthMessageBanner`.
- **`components/autolog/`:** `ReviewSheet` (pending review ka sawal-jawab), `WhyLoggedCard`, `AutoLogHomeBanner`, `AutoLogGate`, `EmailSourceInfo`, `AutoLogUi`.
- **Config:** `src/config/theme.ts` (colors, spacing, fonts, `CATEGORY_PALETTE`), `src/config/supabase.ts`.

## 11. Hooks (`src/hooks/`)
| Hook | Kaam |
|---|---|
| `useExpenseForm.ts` | Form ka poora logic: amount keypad, validation, spending guard, self-transfer, save |
| `useMoneyWaterfall.ts` | Component ke liye waterfall result (expenses + categories se) |
| `useSavingsDashboard.ts` | Savings screen ka data |
| `useFormKeyboard.ts`, `useFocusEntry.ts`, `useScrollDirection.ts` | Keyboard, screen focus, scroll ki disha |

---

## 12. AutoLog (bank SMS/email se apne aap kharch log)

**Flow (docs/AUTO_LOGGING.md se):**
```
Bank SMS → SmsReceiver.kt ─┐   native gate: FinancialFilter.kt
Bank email (notification) ─┤   (personal sender, OTP, bina paise wale message yahin drop)
                           ▼
              EventQueue (app-private file)
                           │ AutoLogHeadlessService JS ko jagata hai
                           ▼
             service.processQueue → engine.processSms / processEmail
   parse → noise filter → user rules → tracked account → dedupe
   → card bill / own transfer → SMS↔Email match → confidence
                           ▼
        logged | pending review | ignored / transfer / merged
                           ▼
        ledger.createTransaction → expenseStore (ya Supabase)
```
**Teen modes:** Discovery (purane SMS se banks/accounts seekhna, kuch **create nahi** karta), Recovery (gap wale din dobara dekhna), Live (naye message).

**Native (`modules/arthik-autolog/android/.../`):** `SmsReceiver.kt` (SMS), `PaymentNotificationListener.kt` (supported email apps ke notifications), `FinancialFilter.kt` (privacy gate), `EventQueue.kt` (append-only queue), `AutoLogHeadlessService.kt` (app band ho to JS jagana), `ArthikAutoLogModule.kt` (JS ko functions: permissions, SMS padhna, settings).

**JS (`src/features/autoLog/`):**
| File | Kaam |
|---|---|
| `parser.ts` | SMS/email se amount, merchant, bank, account nikalna, balance ko amount na samajhna, future/failed message ko txn na maanna |
| `matching.ts` | Same payment pehchanna: reference/UTR, identity score, windows (SMS↔Email 15 min, same source kabhi fuzzy merge nahi) |
| `engine.ts` | Faisla karne wali pipeline |
| `reviews.ts` | User ke faisle: classify, category, duplicate, ignore, transfer |
| `service.ts` | Setup, discovery, recovery, pause, sign-out, queue process |
| `ledger.ts` | Transaction banana/badalna; `isExceedingVaultLiquidity` (sirf Budget Mode mein review) |
| `db.ts` | Encrypted SQLite (SQLCipher), user ke hisaab se, key SecureStore mein |
| `store.ts`, `types.ts`, `copy.ts`, `notify.ts`, `permissions.ts`, `background.ts`, `remote.ts`, `rollout.ts` | UI snapshot, types, text, notifications, permissions, background task, remote profile (message ka content nahi), beta rollout |

Privacy: message ka content sirf phone mein rehta hai; payment apps (GPay, PhonePe...) ke notifications padhe hi nahi jaate.

---

## 13. Ek kharch ka poora safar (example)

User Budget Mode mein, Daily ₹500, ₹300 kharch add karta hai:
1. `ExpenseFormScreen` → `useExpenseForm`: amount validate, `calculateVaultLiquidity` se guard check (paisa hai to aage).
2. `expenseStore.addExpense`: row turant list mein (optimistic), `dailyBudgetStore.syncWithExpenses` bulaya jaata hai.
3. Internet ho to Supabase `expenses` mein insert; na ho to AsyncStorage queue mein, baad mein `syncPending`.
4. `metrics.ts` → `runWaterfall`: ₹300 aaj ke budget se kata (₹200 bacha).
5. Home dobara hisaab karta hai (`calculatePeriodSummary`), numbers rolling animation se badalte hain.
6. `notificationSync` plan dobara banata hai (jaise raat ka nudge cancel, kyunki aaj kuch log ho gaya).
7. Raat 12 ke baad `checkAndRollover` → `finalizeDailyRecords`: din `saved` (₹200 Gullak mein) ya `missed`/`even` banta hai.

---

## 14. Kuch badalna ho to kahan jao

| Kaam | Kahan |
|---|---|
| Income/expense ki pehchaan | `transactionUtils.ts`, `incomeClassifier.ts` |
| Kharch kahan se kata | `moneyWaterfall.ts` (aur `transactionFunding.ts` display ke liye) |
| Home ke numbers/text | `homeCalculations.ts` |
| Total remaining / Gullak total | `store/dailyBudget/metrics.ts` |
| Spending guard | `vaultSpendingGuard.ts`, `VaultSpendingGuardModal.tsx` |
| Cadence badalna / carry | `cadenceSwitch.ts`, `budgetPeriods.ts`, `planActions.ts`, `CadenceSwitchModal.tsx` |
| Din/period ka status aur Gullak jama hona | `budgetCalculations.ts`, `store/dailyBudget/rollover.ts` |
| Pure Mode rules | `moneyWaterfall.ts` (leftover), `planActions.ts` (deficit), `vaultSpendingGuard.ts` |
| Notification kab/kya | `notificationPolicy.ts` (rule), `notificationSync.ts` (data), `notificationService.ts` (device) |
| Offline sync | `expenseStore.ts`, `store/expense/*`, `store/dailyBudget/pendingStorage.ts` |
| Naya table/column | `schema.sql` + naya `supabase/migrations/*.sql` + `docs` |
| AutoLog parsing | `features/autoLog/parser.ts` |
| AutoLog duplicate rules | `features/autoLog/matching.ts` |
| Colors/spacing | `config/theme.ts` |
| Insights ka hisaab | `*InsightsUtils.ts`, `screens/insights/useInsightsData.ts` |

---

## 15. Tests (`tests/`, `npm test`)
Har major file ka apna test hota hai (jaise `moneyWaterfall.test.ts`, `budgetPeriods.test.ts`). Khaas groups:
- **Paise ke core:** `moneyWaterfall`, `moneyWaterfallStore`, `budgetCalculations`, `budgetPeriods`, `homeCalculations`, `transactionFunding`, `transactionUtils`, `incomeClassifier`, `financialCorrectnessMatrix`, `part2Consistency`, `moneyFixesFour`, `gullakReconciliationHardCap`, `realTimeIncomeGullakDeduction`, `monthlyCardConsistency`.
- **Canonical rules:** `selfTransfersAndIncome` (TXN), `canonicalStatusAndGuard` (BUD-008, SEC-001), `pureModeRules` (PUR-001/002), `carryAllocationWeeklyMonthly` (CAR-001, Home vs total, daily regression, carry-ended notice), `vaultSpendingGuard`.
- **Cadence:** `cadenceSwitch`, `cadenceFixes`, `budgetModesStore`, `dailyBudget*` (hydrate, planActions, rollover, store, syncWithExpenses).
- **Offline/sync:** `expenseStore`, `expenseSyncPending`, `offlineStartup`.
- **Notifications:** `notificationPolicy`, `notificationSync`, `notificationStore`, `budgetAlerts`.
- **AutoLog:** `autoLogParser`, `autoLogFlows`, `autoLogEmail`, `autoLogFixes`, `autoLogRollout`.
- **Insights:** `insightsData`, `weeklyInsightsData`, `monthlyInsightsData`, `yearlyInsightsData`, `useInsightsData`.
- **UI/helpers:** formatters, chartUtils, amountKeypad, rollingText, themeStore, etc.
- `tests/helpers/` aur `tests/mocks/`: common test setup (fake store, AutoLog test env).

---

## 16. Docs (`docs/`) aur canonical rule IDs

| File | Kya hai |
|---|---|
| **`ARTHIK_CANONICAL_RULES.md`** | **Supreme rules.** Code, tests aur baaki docs isse milne chahiye. Sirf aapki approval se badalti hai |
| `AGENTS.md` (root) | AI agent ke niyam: canonical supremacy, contradiction par ruko, doc-sync checklist, git/release niyam |
| `CONTEXT.md` (root) | Shabdawali (Gullak, Waterfall, Missed, Period Carry Funding...) |
| `docs/prd.md` | Product features ki list |
| `docs/architecture.md` | Technical architecture, store wiring, ADR table |
| `docs/design-system.md` | UI design rules |
| `docs/AUTO_LOGGING.md` | AutoLog ka poora design |
| `docs/specs/EMAIL_AUTO_LOGGING_SPEC.md` | Email auto-log ki spec |
| `docs/notifications.md` | Har notification ka table |
| `docs/maps/daily-budget-map.md` | Budget code ka naksha (functions aur call sites) |
| `docs/RELEASE_PROCESS.md` | Release aur smoke-test checklist |
| `docs/adr/0001…0014` | Faisle: offline-first, zustand-only, RLS, store wiring, OTA vs version, vitest, cadence periods, zero-proration + vault guard, one budget per period, store split, canonical rules + implementation status |

**Canonical rule IDs ek line mein:**
`TXN-001` direction `type` se · `TXN-002` keyword fallback inert · `TXN-003` self-transfer totals se bahar · `TXN-004` repayment = income · `REF-001` koi split nahi · `WAT-001/002` kharch ka kram, din mein income pehle · `BUD-001` cycle engine · `BUD-003` income Gullak mein nahi jaati · `BUD-008` status `missed` · `BAL-001/002` total remaining, available income · `GUL-001` Gullak cap · `GUL-002` Pure mein Gullak nahi dikhta · `GUL-004` deposit sources · `GUL-008` overspend apne aap Gullak se · `BPR-001/002` cadences, kal se effective · `CAR-001` carry (Mode A/B) · `PUR-001/002` Pure Mode deficit aur leftover · `SEC-001` spending guard · `NOT-001` notifications · `ROL-001/002/003` rollover · `HEA-001/002` self-healing · `RND-001` `round2` · `DAT-001/003/004` date aur Monday week · `INS-001…006` insights · `AUT-001…004` AutoLog · `CAT-001…003` categories · `UX-001…003` form rules.

---

## 17. Badlav karte waqt safe rehne ka tareeka
1. Pehle dekho badlav kisi canonical rule se takrata hai ya nahi. Takraye to **ruko, rule ID ke saath batao** (AGENTS.md ka niyam).
2. Paise ka hisaab sirf `src/lib` ke engines mein badlo, UI mein nahi. Taaki sab jagah ek number rahe.
3. Naya hisaab likho to ek **test** likho jisme canonical rule ka ID naam mein ho.
4. Home ka number aur `getTotalAccountRemaining` hamesha **same** hone chahiye. Do alag formula mat banao.
5. `npm run typecheck` aur `npm test` dono green ho, tab hi release.
6. Badlav ke saath CHANGELOG, canonical (agar rule badla), aur jo docs touch hote hain sab usi commit mein update karo.
7. DB badla to `schema.sql` aur migration dono, aur migration pehle chalao.

---

## 18. Is guide ki seema (honest)
- Core money engines (`moneyWaterfall`, `budgetPeriods`, `homeCalculations`, `notificationPolicy`, store modules, AutoLog flow) maine headers aur code se padhe.
- Screens aur components ka description zyadatar naam, exports aur docs se hai; unki visual logic maine line-by-line nahi padhi.
- Repository location: `docs/CODEBASE_GUIDE.md` (cataloged in `docs/README.md` and linked in `README.md`).
