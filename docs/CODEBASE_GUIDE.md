# Arthik — Codebase Guide (kahan kya hai, kaun si file kya karti hai)

Ye guide **ab ki state** par hai: pehla package + Pure Mode + CAR-001 Mode B + Split Expenses & Money Back + Home Card Details + AutoLog single-page review sab apply hone ke baad. Isme 204+ source files, 97 test suites (1567 tests), native Android module aur docs ka naksha hai.

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
  - Pure aur Budget Mode switch kal 12:00 AM se schedule hota hai taaki aaj ka running budget aur midnight Gullak rollover safely conclude hon (PUR-003). Par naye account ya 0 expense waale account ke liye Budget Mode pehli baar on karte hi aaj se turant activate ho jaata hai (BPR-002 #3). Agar usi din toggle wapas kar dein, to switch aur notification cancel ho jaate hain aur app bina glitch ke chalte rehta hai (same-day reversal protection).

### Samasya 6: "Ek hi cheez 'income' ya 'expense' kaise tay ho?"
- **Hal:** `type` field hi sab kuch tay karta hai (TXN-001). Category ke naam se andaza nahi lagta (keyword fallback sirf purani rows ke liye, jo ab practically use nahi hoti, TXN-002).
- Apne accounts ke beech paisa: `transaction_class = 'self_transfer'`. Ye kabhi income ya expense nahi gina jaata (TXN-003).
- Dost ka paisa wapas aana ya refund: ye **Income nahi hai**. Ye `transaction_class = 'recovery'` wali "money back" row hai jo purane expense ko ghata deti hai (TXN-004, SPL-003). Ek expense ek ya zyada doston ke saath split ho sakta hai (SPL-001).

### Samasya 6b: "Dost ke paise wapas aaye to wo income kyun bane?"
- **Hal:** Expense poora amount rakhta hai (`split_allocations`, backward-compatible `split_person`, `split_amount`). Paise wapas aane par ek money-back row banti hai jisme `recovery_allocations` likha hota hai ki paise kin expenses ko gaye. Store ke andar `recoveryMiddleware.ts` har baar expense ka **counted amount** = `paid − wapas aaya` nikaal deta hai (`gross_amount` me paid amount rehta hai). Baaki engine (waterfall, rollover) pehle se har change par dobara chalta hai, isliye paisa wahin wapas jaata hai jahan se gaya tha: budget ka paisa us din ke budget (aur Gullak) me, income ka paisa income pool me, Gullak ka paisa Gullak me (SPL-003).
- Kaun kitna dega, ye kabhi store nahi hota; hamesha rows se nikala jaata hai (SPL-002, `src/lib/splitLedger.ts`).
- Zyada paise aaye to extra normal income banta hai (SPL-004). Bank message se naam + amount match hone par sirf poochha jaata hai (SPL-005). Refund ek expense se jud ke aata hai, aur multi-person split par user interactive recipient chip se choose karta hai ki refund sabme baanta jaye ya kisi specific person/apne share me credit ho (SPL-006, Solution 2).

### Samasya 7: "Paisa nahi hai to kharch kaise?" (Budget Mode)
- **Hal:** Spending guard (`vaultSpendingGuard.ts`): weekly/monthly allowance cross hone par kharch unspent Income aur Gullak reserves se absorb hota hai; naya kharch sirf tab block hota hai jab poore account ka kul paisa (`accountRemaining`) 0 ya kam ho (`SEC-001`). Agar ₹0 ho, toh `VaultSpendingGuardModal` me bina form chhodhe turant paise add karke expense save karne ka in-sheet option milta hai (bina paise add kiye save nahi hoga, par form ka data barkarar rehta hai). Pure Mode mein kharch kabhi block nahi hota.

### Samasya 8: "Aaj ka Budget Aaj hi Change kyun nahi ho sakta?"
- **Hal:** Agar aaj abhi tak ₹0 kharch hua hai (`todaySpent === 0` for Daily, `currentWeekSpent === 0` for Weekly, `currentMonthSpent === 0` for Monthly), toh budget update kal raat 12 AM ka wait karne ke bajaye **aaj hi turant** active period me apply ho jata hai (`BPR-002`). Agar ₹1 bhi kharch ho chuka hai, tabhi safe rollover ke liye agle cycle par schedule hota hai. Category chip tap karne par keypad bhi band nahi hota taaki editing frictionless rahe.

### Samasya 9: "Slow internet connection par jhootha 'You are offline' banner dikhna"
- **Hal (`FIN-05`, `expenseStore.ts`):** Pehle poore pagination loop ko ek hi 5s hard timeout mein daala gaya tha, jisse hazaaron transactions ya slow network par time out hokar app jhoothi offline banner dikha deta tha. Ab har 1000-row page ka apna 10s timeout aur automatic retries hain, aur offline status sirf tab set hota hai jab `NetInfo` sach mein disconnected confirm kare. Kisi page par failure ho to partial data state ya cache mein save nahi hota, aur puraani cache sahi salamat load ho jaati hai. Pages ab keyset se aate hain (`expense_date DESC, created_at DESC, id DESC`, "aakhri row ke baad wali rows"), offset se nahi, isliye beech me row add/delete hone par bhi koi row do baar nahi gini jaati (OPT-66, ADR 0021).

### Samasya 10: "Puraane bina budget waale din ka kharch daalne par Gullak aur solvency clarity" (FIN-01)
- **Hal (`FIN-01`, `budgetUtils.ts`, `ExpenseFormScreen.tsx`, `VaultSpendingGuardModal.tsx`):** Agar user kisi puraani date (jaise Sunday, jab budget ya income nahi thi) ka expense log karta hai, toh `ExpenseFormScreen` par date picker ke neeche live contextual notice chip aati hai: agar Gullak mein paise hain toh bata deta hai ki ye kharch Gullak se katega (`GUL-001`); agar Gullak/vault mein paise kam hain, toh alert chip shortfall batati hai aur save dabane par `VaultSpendingGuardModal` seedha shortfall amount pre-fill karke open hota hai (`SEC-001`) taaki user bina form data khoe 1-tap me "Add Money & Save" kar sake. Gullak balance ko bhi hard-capped rakha gaya hai taaki wo kisi bhi mode mein kul account cash se zyada na ho sake (`GUL-001`).

### Samasya 11: "Kai din app na kholne par scheduled plan change drop hona" (FIN-02)
- **Hal (`FIN-02`, `rollover.ts`, Rules `CAD-001`, `ROL-001`):** Pehle `applyScheduledPlanChanges` sirf `effectiveFrom === todayStr || effectiveFrom === yesterdayStr` check karta tha. Agar user ne 2 ya zyada din app nahi kholi (jaise Friday se Monday), toh scheduled cadence switch ya budget change drop ho jata tha. Ab canonical `resolvePlanForDate(planChanges, todayStr)` helper ka use hota hai, jisse multi-day gap hone par bhi mature ho chuka plan app khulte hi 100% reliably activate ho jata hai.

### Samasya 12: "Income delete ya kam karne par Gullak mein bina backing ke paise reh jana" (FIN-06)
- **Hal (`FIN-06`, `gullakReconciliation.ts`, `dailyBudgetStore.ts`, `ExpenseDetailScreen.tsx`, `useExpenseForm.ts`, Rules `GUL-001`, `GUL-004`):** Agar user ne income ke din Gullak me deposit kiya tha (jaise ₹10,000 income me se ₹4,000 Gullak me daale) aur baad me user wo income delete karta hai ya ghata kar ₹3,000 karta hai, toh Gullak ke paas ₹1,000 ki backing khatam ho jaati hai. System user ko clear confirmation alert deta hai aur unbacked deficit ko Gullak se adjust kar deta hai (`adjustGullakIncomeDeposits`), taaki fake ya phantom savings balance na bache.

### Samasya 13: "Split equally mein paise fractional hone par form save na hona" (FIN-07)
- **Hal (`FIN-07`, `useExpenseForm.ts`, Rule `SPL-001`):** Odd split amounts (jaise ₹10 teen logon mein baantna) par floating-point division `3.333333...` se sum `10.00` se match nahi karta tha aur validation error aa jati thi. Ab exact integer paise distribution aur remainder absorption se ek-ek paise ka hisaab 100% exact match hota hai bina kisi save lockout ke.

### Samasya 14: "Splash screen par unnecessary 2.2s delay" (FIN-08)
- **Hal (`FIN-08`, `SplashScreen.tsx`):** Hardcoded minimum delay hata diya gaya. Ab splash do UI-thread clocks par chalta hai (entrance 0.9s, exit 0.58s); exit tabhi shuru hota hai jab entrance poora ho chuka ho AUR agla screen pata ho. Bloom apni alag full-screen layer mein screen ke centre se khulta hai. Splash mint par khatam hota hai, `SplashCover` (`splashCoverStore.ts`) turant mint cover laga deta hai, route uske neeche badalta hai, aur Home layout hone ke baad cover dissolve hota hai.

### Samasya 15: "Daily aur Weekly pill ke beech amount same hone par rollover animation na aana" (FIN-09)
- **Hal (`FIN-09`, `HomeScreen.tsx`, `BrandedHeroCard.tsx`, `RollingText.tsx`, `rollingText.ts`):** Mondays ko Daily aur Weekly balance numerical roop se same hota hai. Pehle identical amounts par animation skip ho jaata tha. Ab `rollTrigger` aur `forceSpin` se har pill switch par crisp digit roll animation trigger hota hai, aur waterfall calculation ko active filter se decouple karke instantaneous response diya gaya hai.

### Samasya 16: "History screen mein Category se All pill par aane par UI lag" (FIN-12)
- **Hal (`FIN-12`, `HistoryScreen.tsx`):** User scroll karke kai sections khol chuka hota tha, aur Category se "All" par aate hi saare sections ek saath re-render hote the aur saari dates baar-baar parse hoti thi jisse pill animation jitter karti thi. Ab initial mount par 4 dinon ki transactions render hoti hain, category switch par pagination turant 4 par reset hoti hai, aur extra days ke liye "See More" button (4-day increments) provide kiya gaya hai, bilkul SavingsScreen ki tarah buttery smooth performance ke saath.

### Samasya 17: "Home Screen par All se Monthly switch par pill jitter aur rapid sequential tap par number roll distortion" (FIN-13)
- **Hal (`FIN-13`, `SegmentedControl.tsx`, `RollingText.tsx`, `rollingText.ts`, `HomeScreen.tsx`, `homeCalculations.ts`):** 
  1. **Modulo Discontinuity Fix**: Pehle `Animated.modulo(position, 10)` use hota tha, jisse decrease hone par 0 se 10 ka instantaneous jump native Android driver par glyphs ko chop/distort kar deta tha. Ab `getWheelGlyphs` monotonic sequence banata hai (`travel + 1` digits) aur `translateY` strictly monotonic travel karta hai bina modulo ke.
  2. **240 Paint Invalidations/sec Elimination**: `SegmentedControl` ke har tab par chalne wala per-frame `interpolateColor` worklet har second ~240 baar Android `TextView.setTextColor()` call kar raha tha, jisse Choreographer starve hota tha aur 3-slot travel (All se Monthly) par pill jitter hoti thi. Ise static color aur memoized options se replace kiya gaya.
  3. **220ms Micro-Choreography & Debounce** *(FIN-14 ne replace kiya, neeche dekho)*: Frame 0 par pill spring native UI thread par launch hoti thi, aur card recalculation 220ms delay ke baad aati thi.

### Samasya 18: "Home ki All/Daily/Weekly/Monthly pill abhi bhi jitter karti hai, pills premium nahi lagti" (FIN-14)
- **Root cause**: 220ms timer pill ke glide (~350ms) khatam hone se PEHLE fire hota tha. Usi waqt pura Home re-render, hero card ka relayout aur saare digit wheels mount hote the, to pill ka aakhri hissa atak jaata tha. Saath hi Frame 0 par bhi `setSelectedFilter` pura Home re-render karta tha, aur label ka colour React re-render par badalta tha, pill ke saath nahi.
- **Hal (`SegmentedControl.tsx`, `segmentedMotion.ts`, `HomeScreen.tsx`, `InsightsScreen.tsx`, `SavingsHistorySection.tsx`, `BouncyFilterToggle.tsx`)**:
  1. **`commitOnSettle`**: pill khud batati hai jab wo land ho jaaye (`PILL_SETTLE_MS` = 320ms, aakhri tap se). Tab tak parent re-render hi nahi hota. Home ab pill + numbers ek hi render mein badalta hai, alag timer nahi.
  2. **Liquid pill**: left aur right edge alag springs par. Aage wala edge jaldi nikalta hai, peeche wala thoda baad, to pill chalte waqt stretch hoti hai aur exact width par land karti hai. Corners kabhi squash nahi hote (scale nahi, width).
  3. **Label colour pill ke saath**: label do baar draw hota hai, upar wali copy ki opacity pill ki position se chalti hai (setTextColor nahi, isliye FIN-13 wali problem wapas nahi aati).
  4. **Haptics**: sirf tab selection tick jab selection sach mein badle (re-tap par nahi). iOS par land par soft tick bhi; Android par sirf ek tick (do baar buzz nahi).
  5. **Review fixes (FIN-14b)**: (a) pill ki width border ginti nahi thi, isliye last option par pill labels se ~1.5px khisak jaati thi (`optionWidthFor` se theek). (b) Ek fixed trailing spring se All->Monthly par pill 1.56x chaudi ho jaati thi; ab trailing spring distance ke hisaab se kasti hai (`trailingSpringFor`), stretch ~19/28/29% rehta hai aur har jump ~285ms mein land karti hai. (c) [Oct 2026, ADR 0020 ne badla] Pehle heavy screens 200ms par commit hoti thi; tab pill 6-12px (History mein 80px tak) door hoti thi aur React commit Reanimated ko freeze kar deta tha. Ab screen ko tab bataya jaata hai jab pill sach mein land ho chuki ho (`pillLandingMs`, 1px). Pill transform-only banti hai (caps + scaled beech wala piece), `width` animate nahi hoti. Touch fence (`selectionCommitFence.ts`) Save jaisa koi bhi doosra touch aane se pehle pending value de deta hai. (d) Inactive label copy active ke neeche fade-out hoti hai (grey kinaar nahi dikhta). (e) Pehle layout par pill ek frame ke liye galat jagah/dot dikh sakti thi; ab layout par hi place hoti hai aur jab tak place na ho invisible rehti hai. (f) OS reduce-motion maana jaata hai. (g) `RollingText` zero-flash planning: text change hote hi render phase mein hi wheels mount ho jaati hain, jisse new number static 1 frame ke liye bhi screen par leak nahi hota.
- **Rolling text (`rollingText.ts`, `RollingText.tsx`)**: 240ms soft-landing ease, 10ms digit ripple. Unchanged digits remain rock-solid static. Zero-flash synchronous render planning aur screen focus par zero delay.

### Samasya 19: "Toggles (on/off) ka animation premium nahi tha, aur colour JS thread par chal raha tha" (FIN-15)
- **Hal (`AnimatedToggle.tsx`, `toggleMotion.ts`)**: App ke saare on/off ek hi component `AnimatedToggle` se bante hain, isliye ek jagah badalne se sab (Profile ke 4, Budget Hub, Split, Self-transfer, AutoLog accounts) badal gaye. Press par thumb sirf subtle cushion (0.25 stretch factor) leta hai taaki pehle alag se na khinche; jaise hi switch hota hai, slide spring (`SLIDE_SPRING` 720 stiffness, 44 damping) tez aur snappy glide karti hai. Slide ke beech mein thumb lamba hota hai (aage ka edge aage, peeche ka edge peeche), aur landing par ~1px squash ke baad rest. Thumb kabhi track se bahar nahi jaata (slide spring clamped hai). Colour change opacity wali do layers se hota hai (200ms), `interpolateColor` se nahi (FIN-13 wali Android paint problem na aaye). Har change par haptic tick, aur OS ka reduce-motion maane to bina animation seedha change. Resting look (size, padding, travel) bilkul purana hai.

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
- Stack screens: Splash, Onboarding, Auth, ResetPassword, ProfileSetup, AppTabs, AddExpense/EditExpense (dono `ExpenseFormScreen`), ExpenseDetail, Ledger (`LedgerScreen`), GullakDepositDetail, CategoryDetail, ManageCategories, AddEditCategory, Notifications, Savings, Profile, Faq, aur AutoLog ki 8 screens.
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
- **Migrations** (`supabase/migrations/`): budget modes (Oct), autolog profiles, release v2 flags, `20261017083146_retire_shares_reimbursements.sql` (purane reimbursement rows ko normal income banata hai), aur `20261018_split_and_money_back.sql` (split + money-back columns, class `recovery`).
- Row-level security: har user sirf apna data dekhta hai (ADR 0004).

---

## 7a. `src/money/`: ek sawaal, ek jawab

Pehle har screen khud poochti thi "ye row kharcha hai?", "date kya hai?", "kitna bacha?". Ab ek hi jagah hai. Screen sirf padhti hai.

| File | Kaam |
|---|---|
| `dateKeys.ts` | 'yyyy-MM-dd' naam ka ek tareeka. `toDateKey`, `todayDateKey`, din gine, mahine ke din |
| `ledger.ts` | Row ek baar saaf. `amountPaid` (bank se gaya) aur `amountCountedAfterMoneyBack` (totals me ginta hai). Din-wise totals |
| `budgetAllowance.ts` | Budget ka per-day rate (BUD-009). Monthly = monthly / us mahine ke asli din |
| `budgetStatus.ts` | Bacha / over / bar kitna bhara. `calculateCycleFinancials` ke upar |
| `overspendFunding.ts` | Overspend income ne bhara ya Gullak ne. Waterfall se |

Rule: naya money logic yahin jayega, test ke saath (MNY-001).

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
| `gapFiller.ts` | Inactive zero-activity days pehchanna (7-day lookback cap), dismissed dates save karna (`ROL-004`) |

### Kharch ka funding aur display
| File | Kya karti hai |
|---|---|
| **`moneyWaterfall.ts`** | **"Paisa kahan se aaya" ka ek hi sach.** Samay ke kram mein chalta hai. Output: har kharch ka `fromBudget / fromLeftover / fromIncome / fromGullak`, din-wise hisaab, income bacha, Gullak kitna kata, `pureLeftover` (added/used/remaining) |
| `transactionFunding.ts` | Ek kharch ke detail screen ka funding breakdown (waterfall se) |
| `heroDetails.ts` | Home card tap details sheet (`HeroDetailsSheet`) ka breakdown: Budget pool, Money in / unspent, Gullak movement, Money back alag line par |
| `splitLedger.ts` | Split expenses, repayments, multi-person debt & merchant refund attribution engine: `buildPeopleLedger`, `buildPersonSummaries`, settlements, `planRefund` (Solution 2 interactive recipient attribution: everyone / me / specific member with live balance preview), debt validation |
| `settleReview.ts` | Review sheet "Paid back by someone?": settle ka hisaab (`summarizeSettle`), chhota button text aur note (`settleButtonLabel`, `settleNote`, `shortPersonName`) |
| `homeCalculations.ts` | **Home ke hero card ka dimaag.** `calculatePeriodSummary` 4 filters (All/Daily/Weekly/Monthly) ka primary amount, label, subtext banata hai. Display ka copy bhi yahin se aata hai (jaan-boojhkar, taaki sab filters ek hi logic use karein). `PURE_DEFICIT_NOTE` wali auto-income budget chip ke income se bahar rakhta hai |
| `vaultSpendingGuard.ts` | Spending guard ka hisaab: `canAddExpense` + `VAULT_GUARD_MESSAGE`. Pure Mode mein hamesha allowed |

### Insights (sab pure)
`weeklyInsightsUtils.ts`, `monthlyInsightsUtils.ts`, `yearlyInsightsUtils.ts` (weekly/monthly/yearly spend, budget health, safe daily pace, day-matched comparisons, multi-cadence period savings aggregation, Option 2 `computeWeeklyShareOfMonthlyBudget` for monthly savers on weekly tab, cadence-aware discipline takeaways), `insightsCommon.ts` (shared types).

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
`formatters.ts` (`round2`, currency), `profileUtils.ts` (user display name resolution, 15-character guardrail matching "Kislaya Agarwal", input clamping aur validation), `amountKeypad.ts` (calculator keypad: `2+3*4` jaisa expression), `chartUtils.ts` (charts ke paths/segments/data), `colorUtils.ts`, `iconUtils.ts`, `flameUtils.ts`, `rollingText.ts` + `quicksandMetrics.ts` (digits ka rolling animation), `pullToHistoryPhysics.ts` (Home se pull karke History kholne ki physics), `ambientBackground.ts` + `ambientGrain.ts` + `ambientWind.ts` (screen ka halka glow background), `animationUtils.ts`, `streakCalendarData.ts`, `expenseFilters.ts`, `noteSuggestions.ts`, `moneyExplainerContent.ts` (help popups ka text).

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
| `planActions.ts` | Budget set karna, cadence badalna (`handleSetBudgetCadence`), mode on/off (`handleSetBudgetModeEnabled`, yahin **Pure deficit auto-income** `balancePureDeficitIfNeeded` aur next-day transition `PUR-003` hai), scheduled next-day budget, pending plan sync, scheduled reversal (`handleCancelPendingPlanChange`) |
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
| `payload.ts` | Split / money-back columns sirf tab bhejta hai jab row unhe use kare (SQL chalne se pehle bhi normal expenses chalte hain) |
| `recoveryMiddleware.ts` | Har `expenses` write par counted amount dobara nikaalta hai (SPL-003) |
| `moneyBack.ts` | Money back / refund record karna, aur logged income ko money back me badalna (SPL-003..006) |
| `serverSync.ts` | Download plumbing, koi money logic nahi (ADR 0021): app-wide "last fetch" clock `getLastExpensesFetchAt` (OPT-60), keyset page filter `expenseKeysetCursor` / `expenseKeysetFilter` (OPT-66), aur change-version probe `readExpensesVersion` + in-memory snapshot (OPT-69): server ka number same ho to pichli download ki rows reuse hoti hain |
| `hydrationHold.ts` | Memory-only hold (`ROL-005`, ADR 0022): jab Home cache se dikhta hai aur server copy abhi aa rahi hai, tab `checkAndRollover`, `uploadPendingDailyRecords`, `syncPendingGullakDeposits` kuch nahi karte. `hydrate.ts` ke end me release hota hai |
| `src/lib/expenseListEquality.ts` | `sameExpenseList(a, b)`: do lists ka content barabar ho to `true` (OPT-20). `fetchExpenses` isse same array rakhta hai jab server ka data wahi hai |
| `src/lib/expenseCacheMemo.ts` | Har cache key par last likha JSON yaad rakhta hai, taaki same JSON dobara disk par na likha jaye (OPT-20). `fetchExpenses` aur `syncPending.ts` dono isse update karte hain. Same server rows + same pending deletes/updates par `fetchExpenses` poori list ka `JSON.stringify` bhi skip karta hai (OPT-64) |
| `src/lib/batchedStorage.ts` | `dailyBudgetStore` aur `notificationStore` ka persist storage (OPT-23): state object memory me rakhta hai aur 250 ms shaanti ke baad ek hi baar serialise + disk par likhta hai. App background/inactive par `flushBatchedStorage()` (App.tsx); reset par `removeBatchedItem` pending write cancel karta hai |
| `src/lib/warmStart.ts` | OPT-07 / `ROL-005`: `canShowHomeFromCache` (kya Home cache se khul sakta hai) aur `startHomeFromCache` (caches bharo, app lock init, phir refresh peeche chalao, money writes hold par) |

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
| `navBarStore.ts` | Bottom nav bar dikhana/chhupana (geometry `lib/navBarLayout.ts` mein) |

---

## 9. Screens

| Screen | Kya karti hai |
|---|---|
| `HomeScreen.tsx` | Hero card (All/Daily/Weekly/Monthly), chips, bounded top-5 recent transactions (`selectRecentTransactions`). `calculatePeriodSummary` aur waterfall use karti hai |
| `ExpenseFormScreen.tsx` (1152 lines) | Kharch/income add aur edit. Logic `useExpenseForm.ts` mein. Spending guard yahin se chalta hai |
| `ExpenseDetailScreen.tsx` | Ek transaction ki detail + funding card + split repayments |
| `LedgerScreen.tsx` | Split expenses ledger: who owes what, multi-person settlements, person detail modal |
| `HistoryScreen.tsx` | Transactions ki list aur filters. Memoized `categoryFilterOptions`. List ab FlashList v2 hai (OPT-30): rows recycle hoti hain, din ke hisaab se header row + item rows `src/lib/historyRows.ts` banata hai. 4-din "See More" pagination wahi hai |
| `src/lib/historyRows.ts` | History ke types (`HistoryItem`, `HistorySection`, `HistoryRow`) aur `buildHistoryRows`, `buildHeaderRowIndexes` (date jump ke liye header row ka index) |
| `SavingsScreen.tsx` (+ `.styles.ts`) | Budget hub, Gullak, streaks, deposits. Components `components/savings/*` |
| `InsightsScreen.tsx` + `screens/insights/` | Weekly/Monthly/Yearly insights. Data `useInsightsData.ts` with memoized $O(1)$ category lookup map (`buildCategoryMap`) |
| `ProfileScreen.tsx` | Profile, settings, budget pause, app lock, AutoLog entry |
| `AuthScreen`, `ResetPasswordScreen`, `ProfileSetupScreen`, `OnboardingScreen`, `SplashScreen` | Login, password reset, shuruaati flow |
| `NotificationsScreen.tsx` | In-app notification inbox |
| `ManageCategoriesScreen`, `AddEditCategoryScreen`, `CategoryDetailScreen` | Categories ka kaam. Fine-grained Zustand selectors se unrelated store churn isolation. `CategoryDetailScreen` ki list FlashList hai (OPT-31) |
| `GullakDepositDetailScreen.tsx` | Ek Gullak deposit ki detail |
| `FaqScreen.tsx`, `UpdateRequiredScreen.tsx` | FAQ, zaroori update |
| `screens/autolog/*` | AutoLog: Center (reset learned rules), Setup, Review (pending - swipe to delete & bulk clear), Accounts, Email, Info/Privacy, Intro, WelcomeBack |

---

## 10. Components (naam se, andar ki logic maine line-by-line nahi padhi)

- **Home/Hero:** `BrandedHeroCard` (bada hero card), `HeroDetailsSheet` (tap card breakdown), `RollingText` (digits ka animation), `ExpenseFundingCard`, `TransactionRow`, `PullToHistoryList` + `PullToHistoryIndicator`.
- **Budget/Savings:** `BudgetEditModal`, `CadenceSwitchModal` (cadence switch + carry mode chunna), `PeriodRenewalModal`, `DepositGullakModal`, `StreakCalendarModal`, `StreakFlame`, `SavingsRecordRow`, `GullakDepositRow`, `VaultSpendingGuardModal`, `MoneyExplainerModal`, `components/savings/*`, `components/profile/PauseBudgetModal`.
- **Split & Money Back:** `components/split/SplitExtras`, `components/split/MoneyBackExtras`, `components/split/MoneyBackSheet`, `components/split/SplitDetailCard`.
- **Charts:** `CashFlowChart`, `YearlyCashFlowChart`, `SpendingFlowChart`, `DonutChart` (Home ring in both modes), `AnimatedCategoryDonut`, `BreathingStripShell` + Weekly/Monthly/Yearly strips, `YearlySavingsMilestoneCard`, `BehavioralInsightRow`.
- **Form:** `BouncyTypeToggle`, `BouncyPaymentToggle`, `BouncyCategoryFilter` (Reanimated UI-thread worklet slider, touch dispatch, zero-shift typography), `KeyButton`, `ui/KeypadGrid`, `CustomDatePickerModal`, `transfer/TransferExtras` (self-transfer switch), `transfer/TransferDetailCard`.
- **App-wide:** `BottomNavBar`, `AmbientBackground`, `AppLockOverlay`, `OfflineBanner`, `SyncFailedBanner`, `OtaUpdateModal`, `ErrorBoundary`, `AppRefreshControl`, `RefreshScrollShell` (dono ek hi `usePullRefresh` handler ke saath chalte hain, refresh circle ek baar neeche aata hai aur ek baar upar jaata hai).
- **`components/ui/`:** design-system ke chhote tukde: `AppButton`, `AmountText`, `SegmentedControl`, `BottomSheetModal`, `StatusBadge`, `ItemRowShell`, `AuthFormField`, `AuthMessageBanner`, `Skeleton` (grey placeholder jahan content load ho raha hai, OPT-41). Chhote fixed shapes (badge, pill, keypad key, calendar day) ka text `maxFontSizeMultiplier={FIXED_SHAPE_MAX_FONT_SCALE}` (`src/lib/fontScale.ts`, 1.3) se bandha hai (OPT-42).
- **`components/autolog/`:** `ReviewSheet` (pending review ka sawal-jawab), `WhyLoggedCard`, `AutoLogHomeBanner`, `AutoLogGate`, `EmailSourceInfo`, `AutoLogUi`.
- **Config:** `src/config/theme.ts` (colors, spacing, fonts, `CATEGORY_PALETTE`), `src/config/supabase.ts`.

## 11. Hooks (`src/hooks/`)
| Hook | Kaam |
|---|---|
| `useExpenseForm.ts` | Form ka poora logic: amount keypad, validation, spending guard, self-transfer, save |
| `useSavingsDashboard.ts` | Savings screen ka data |
| `useFormKeyboard.ts`, `useFocusEntry.ts`, `useScrollDirection.ts` | Keyboard, screen focus (`useFocusEntryCount`, `useScreenBlurListener`), scroll ki disha |
| `useReduceMotion.ts` | App ka ek hi "reduce motion" hook (OPT-43): OS setting live follow karta hai, ek shared subscription (`src/lib/reduceMotionStore.ts`), `AmbientBackground`, `RollingText` aur `Skeleton` yahi use karte hain |
| `useNavBarMetrics.ts` | Phone ke hisaab se nav bar ki spacing (`useNavBarMetrics`) aur screens ki bottom padding (`useNavBarContentInset`) |
| `usePullRefresh.ts` | Home, History, Savings, Insights ka ek shared pull-to-refresh handler: circle pehle on, kam se kam 700 ms tak on, doosra pull ignore, error par bhi circle band (blink fix) |
| `useRingSweep.ts` | (focus-entry + `focus` event, dono se trigger) Home ring (`DonutChart`) ka blink-free sweep: blur ke baad UI thread par 0, wapas aane par seedha sweep up |

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
| `reviews.ts` | User ke faisle: classify, category, duplicate, ignore, transfer, single/bulk review discard (`discardEvent`, `discardAllPending`) |
| `service.ts` | Setup, discovery, recovery, pause, sign-out, queue process, review clearing (`clearAllPendingReviews`), learned rules reset (`resetLearnedRules`) |
| `ledger.ts` | Transaction banana/badalna; `isExceedingVaultLiquidity` (sirf Budget Mode mein review); `owingPersonMatchFor` / `moneyBackQuestionFor` (kaun paisa dena hai) |
| `paybackGuard.ts` | Remembered "income" wale sender se aaya credit, agar wo insaan abhi paisa dena hai, to seedha income nahi banta, review mein jaata hai (SPL-005 point 7) |
| `db.ts` | Encrypted SQLite (SQLCipher), user ke hisaab se, key SecureStore mein, review dismissal (`dismissPendingEvent`, `clearAllPending`), learned rules reset (`resetLearnedRules`) |
| `notificationActions.ts` | Notification ke category button ka tap padhta hai aur sirf category save karta hai, phir notification hata deta hai (app band ho ya khula, dono mein chalta hai) |
| `store.ts`, `types.ts`, `copy.ts`, `notify.ts` (logged notification par top 3 category buttons), `permissions.ts`, `background.ts`, `remote.ts`, `rollout.ts` | UI snapshot, types, text, notifications, permissions, background task, remote profile (message ka content nahi), beta rollout |

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
- **Paise ke core:** `moneyWaterfall`, `moneyWaterfallStore`, `budgetCalculations`, `budgetPeriods`, `homeCalculations`, `heroDetails`, `splitLedger`, `splitMoneyBackStore`, `splitMultiPerson`, `splitPureModeTransitions`, `transactionFunding`, `transactionUtils`, `incomeClassifier`, `financialCorrectnessMatrix`, `part2Consistency`, `moneyFixesFour`, `gullakReconciliationHardCap`, `realTimeIncomeGullakDeduction`, `monthlyCardConsistency`.
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
| `docs/adr/0001…0016` | Faisle: offline-first, zustand-only, RLS, store wiring, OTA vs version, vitest, cadence periods, zero-proration + vault guard, one budget per period, store split, canonical rules, UI-thread worklets, split expenses & money back |

**Canonical rule IDs ek line mein:**
`TXN-001` direction `type` se · `TXN-002` keyword fallback inert · `TXN-003` self-transfer totals se bahar · `TXN-004` money back income nahi · `SPL-001..006` split, money back, refund · `WAT-001/002` kharch ka kram, din mein income pehle · `BUD-001` cycle engine · `BUD-003` income Gullak mein nahi jaati · `BUD-008` status `missed` · `BAL-001/002` total remaining, available income · `GUL-001` Gullak cap · `GUL-002` Pure mein Gullak nahi dikhta · `GUL-004` deposit sources · `GUL-008` overspend apne aap Gullak se · `BPR-001/002` cadences, kal se effective · `CAR-001` carry (Mode A/B) · `PUR-001/002/003` Pure Mode deficit, leftover aur next-day transition · `SEC-001` spending guard · `NOT-001` notifications · `ROL-001/002/003` rollover · `HEA-001/002` self-healing · `RND-001` `round2` · `DAT-001/003/004` date aur Monday week · `INS-001…006` insights · `AUT-001…004` AutoLog · `CAT-001…003` categories · `UX-001…003` form rules.

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
