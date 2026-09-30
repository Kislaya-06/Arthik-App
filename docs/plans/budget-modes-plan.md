# 🚀 Arthik — Budget Modes: End-to-End Implementation Plan (OTA-only)

**Base code:** `Arthik-App-main` (app version `1.2.4`, `runtimeVersion.policy = appVersion`)
**Goal:** Pure Expense Tracker (default) + Smart Budget & Gullak (daily / weekly / monthly), shipped **only via OTA** (`eas update`), with **no new APK**.
**Language:** Explanations are in Hinglish. The prompts are in English, because coding agents follow English specs more precisely. Tell the agent to reply to you in Hinglish (AGENTS.md already says this).

---

## 0. Isko kaise use karna hai (Workflow)

1. Is file ko repo me `docs/plans/budget-modes-plan.md` par rakh do. Prompt 0 ye kaam karwata hai.
2. Har prompt **copy-paste as-is** karo, ek time par ek hi prompt.
3. Har prompt ke baad, uske niche wala **"Kya check karna hai"** section khud verify karo. Sab green ho tabhi commit karo.
4. Branch flow (har phase ke liye same):

```
main
 └── integration/budget-modes          ← saari feature branches yahan merge hongi
      ├── feat/budget-schema           (Prompt 1)
      ├── feat/budget-period-engine    (Prompt 2)
      ├── feat/budget-store-cadence    (Prompt 3)
      ├── feat/pure-mode-shell         (Prompt 4)
      ├── feat/dual-ring-hero          (Prompt 5)
      ├── feat/cadence-ui              (Prompt 6)
      └── feat/budget-notifs-docs      (Prompt 7)
Prompt 8 → final QA → integration merges into main → push → OTA (preview first, then production)
```

**Har phase ke end par same commands (sirf naam badlo):**
```bash
npm test && npx tsc --noEmit
git add -A
git commit -m "feat(<scope>): <message from the phase>"
git checkout integration/budget-modes
git merge --no-ff feat/<branch-name> -m "merge: feat/<branch-name>"
git checkout -b feat/<next-branch-name>      # agli phase ki branch
```

Har branch me **ek hi commit** ho (thoda fix karna pade toh `git commit --amend`). Isse history saaf rahegi.

---

## 1. 🔒 OTA Hard Rules (har prompt me lagu)

Ye rules todoge toh OTA users ka app crash hoga ya update pahunchega hi nahi.

- **No new native dependency.** Koi naya npm package nahi aayega jisme native code ho. Allowed sirf wahi hai jo already installed hai: `react-native-svg`, core `Animated` API, `date-fns`, `zustand`, `lucide-react-native`, `expo-notifications`. Pure-JS helper bhi naya add mat karo, kyunki zarurat nahi hai.
- **`app.json` ka `expo.version` aur `package.json` ka `version` bump MAT karna** (dono `1.2.4` rahenge). Koi naya plugin, permission ya `app.json` native config change bhi nahi hoga.
- **DB changes sirf additive honge.** Sirf nayi tables aur nayi nullable/defaulted columns aayengi. Koi column rename, drop ya type change nahi. Purana bundle (jin users tak OTA nahi pahuncha) isi DB par chalta rahega aur toot na jaye.
- **AsyncStorage / persisted store shape change hoga** toh zustand `persist` ka `version` + `migrate` likhna zaroori hai. Purane payload par app crash nahi hona chahiye (AGENTS.md §9).
- **Sign-out reset path** mein har naya state field reset hona chahiye.

---

## 2. ✅ Locked Product Decisions (review ke points 1–8 ka final fix)

Ye decisions original `FEATURE_SPEC_BUDGET_AND_EXPENSE_MODES.md` ko **override** karte hain jahan conflict ho. Baaki spec (Pure Mode UI, Dual Ring visuals, 4/5 tab, Gullak safety popup, Insights guard) waisa hi rahega.

### D1. "Timer" nahi, lazy finalization + do nayi tables
Rollover abhi bhi app-open par `checkAndRollover` mein lazy hi hoga (koi background timer nahi hoga).
- **Daily cadence** → existing `daily_savings_log` (bilkul unchanged).
- **Weekly / Monthly cadence** → nayi table **`budget_periods`**. Har period ki ek row hogi (start, end, budget, spent, saved, status).
- **Rules ka timeline** → nayi table **`budget_plan_changes`**. Isme likha rahega ki kis date se kaunsa mode, cadence aur amount lagu hua. Isi se pata chalta hai ki kisi bhi purani date par kaunsa rule tha, isliye history kabhi galat recalculate nahi hogi.
- **Gullak total** = daily saved (existing) + `budget_periods.amount_saved` ka sum + manual deposits.

### D2. Double-counting fix: har din ka owner sirf ek
Har calendar date ka **exactly ek owner** hoga: `daily` ya `weekly` ya `monthly` ya `paused` (mode OFF). Ek date kabhi do jagah count nahi hogi.
- Daily cadence wale din → `daily_savings_log` record.
- Weekly/monthly wale din → sirf us period ke `spent` mein count honge. Unke liye koi daily record nahi banega.
- Paused din → kahin count nahi honge.

### D3. Cadence switch ya amount change hamesha **kal se** lagu
- **Cadence switch** → effective **next local day**. Aaj ka din purane cadence ka hi rahega. Scenario 2 aur 4 wali "aaj vs kal" inconsistency khatam.
- **Weekly amount change** → **next Monday** se. **Monthly amount change** → **next 1st** se. **Daily amount change** → existing behaviour same rahega (`scheduleNextDailyBudget`, yaani kal se).
- **Pending change ek hi rahega.** Midnight se pehle user dobara badle toh pending replace ho jayega (same `effective_from` par upsert).
- **Exception:** Mode **pehli baar ON** ho (ya aaj paused tha), tab cadence **aaj se** lagu hoga. Paused din ka koi record nahi hai, isliye double count nahi hoga.
- **Mode OFF** → **turant** lagu. Aaj ka din bhi paused ho jayega aur aaj ka koi rollover nahi hoga.

### D4. Partial period = prorated budget (anti-gaming + fair)
Jab period beech mein shuru ya khatam ho (switch, mode ON/OFF, account creation), tab:
`budget = round2(fullBudget × activeDays / totalDaysInPeriod)`, aur `spent` sirf active days ka count hoga.
- Example 1: Weekly ₹7,000, Friday ko Daily par switch kiya. Mon–Fri wala week 5/7 × 7000 = ₹5,000 ka hoga. Friday raat ke baad finalize hoga. Saturday se daily lagu.
- Example 2: Monthly se Weekly, 15 Jan (Thu) ko choose kiya. Month period 1–15 Jan tak prorated. Weekly 16 Jan (Fri) se shuru, pehla week Fri–Sun = 3/7 prorated.
- Is proration ki wajah se baar-baar switch karke Gullak bharne ka koi fayda nahi. Isliye alag "switch limit" ki zarurat nahi hai.

### D5. Existing users ka migration (SQL backfill, server side)
`is_budget_mode_enabled = true` sirf tab hoga jab `is_auto_renew = true` ho, **ya** user ke paas koi `gullak_deposits` ho, **ya** `daily_savings_log` mein `status = 'saved' AND amount_saved > 0` row ho.
`daily_budget > 0` ko signal ki tarah use **nahi** karna hai, kyunki purana default 100 tha.
Har existing user ke liye `budget_plan_changes` mein ek seed row banegi: `effective_from = profile created date`, cadence `daily`, amount = `daily_budget`, enabled = upar wala result.

### D6. Streak rules
- Streak ki **unit = current cadence ka period** hogi: din, hafta ya mahina. UI label: "5 days", "3 weeks", "2 months".
- **Cadence switch par current streak 0** se shuru hogi, kyunki alag units mix nahi ho sakti. **Best streak har cadence ki alag** store hogi (`bestStreakByCadence`).
- **Mode OFF (paused) range streak ko bridge karegi.** Wo range na streak todegi, na count hogi. Isliye popup ka "streak wahin se resume" wala promise sach rahega.
- Existing daily streak rules (unknown days etc.) bilkul same rahenge.

### D7. Period boundaries
- **Week = Monday 00:00 se Sunday 23:59 (local).** Codebase already `weekStartsOn: 1` use karta hai. Finalize tab hoga jab local date Monday ho jaye. UI copy: *"Sunday ke baad Gullak mein jayega"*.
- **Month = calendar month.** Finalize next month ki 1 tareekh ko hoga.
- Saari dates `yyyy-MM-dd` strings mein rahengi aur `parseISO` se parse hongi (AGENTS.md rule).

### D8. Mode 2 Hero card
- **Primary number** = current cadence period mein **kitna bacha** (e.g. "₹2,300 left this week").
- **Strip:** "₹2,300 Sunday ke baad Gullak mein" ya "Over by ₹400 this week".
- Filter chips (Daily/Weekly/Monthly/All) ka kaam sirf Inflow/Outflow numbers aur ring ke liye rahega. Budget card hamesha cadence period follow karega.

### D9. Dual Ring edge cases
| Income | Spent | Outer (green) | Inner | Center text |
|---|---|---|---|---|
| 0 | 0 | faint track | faint track | `₹0` |
| 0 | >0 | faint track | 100% coral | `₹X spent` (koi % nahi, kyunki divide-by-zero) |
| >0 | ≤ income | 100% | spent/income % coral | `45% spent` |
| >0 | > income | 100% | 100% **red** `#EF4444` | `125% spent`, cap `999%+` |

"All" filter bhi same math use karega, bas all-time data par.

### D10. Notifications
- **Mode OFF:** budget warning, exceeded aur rollover notifications band. `daily_reminder` ("aaj ka kharcha likho") chalta rahega, par tap karne par **Home** khulega, Savings nahi.
- **Weekly/Monthly:** 80% aur 100% warnings **period mein ek baar** jayengi (dedupe key = `period_start`). Period close hone par ek notification: "₹X Gullak mein gaya 🎉".

### D11. Navigation guard
`Savings` Tab + Stack dono jagah registered hai. Pure mode mein **route-level guard** lagega: Savings par koi bhi navigation (notification tap, deep link, purani notification list) Home par redirect hoga. Sirf tab button hide karna kaafi nahi hai.

---

## 3. 🧭 Prompts (Phase-wise)

---

### PROMPT 0 — Setup + Context Load (no code change)

**🔀 Prompt se PEHLE (integration branch banao + plan commit karo):**
```bash
git checkout main && git pull
git checkout -b integration/budget-modes
mkdir -p docs/plans
# is file ko docs/plans/budget-modes-plan.md par copy karo
git add docs/plans/budget-modes-plan.md
git commit -m "docs(plans): add budget modes implementation plan"
```

```text
You are working on Arthik (Expo/React Native + Supabase + Zustand). Reply to me in Hinglish; code, comments and commits in English.

This is a READ-ONLY context-loading step. Do NOT modify any file.

Read fully, in this order:
1. docs/plans/budget-modes-plan.md  (THE source of truth for this whole feature. Sections 1 "OTA Hard Rules" and 2 "Locked Product Decisions" override anything else, including FEATURE_SPEC_BUDGET_AND_EXPENSE_MODES.md if present)
2. AGENTS.md, CONTEXT.md, docs/architecture.md, docs/maps/daily-budget-map.md, docs/adr/*.md
3. src/store/dailyBudgetStore.ts (entire file), src/lib/budgetCalculations.ts, src/lib/budgetUtils.ts, src/lib/homeCalculations.ts, src/lib/notificationService.ts
4. src/navigation/index.tsx, src/components/BottomNavBar.tsx, src/components/BrandedHeroCard.tsx, src/components/StreakCalendarModal.tsx, src/components/BudgetEditModal.tsx, src/screens/HomeScreen.tsx, src/screens/InsightsScreen.tsx, src/screens/ProfileScreen.tsx, src/screens/SavingsScreen.tsx, src/screens/NotificationsScreen.tsx
5. schema.sql, App.tsx (startup hydration order), tests/ folder listing

Then run `npm test` and `npx tsc --noEmit` and report the baseline results.

Output (Hinglish, concise):
A) Baseline: test pass/fail count, tsc errors (if any, list them — do not fix).
B) A map of EVERY place that currently: (1) navigates to 'Savings', (2) reads dailyBudgetAmount / isAutoRenew, (3) creates or finalizes DailyRecords, (4) triggers budget/rollover notifications, (5) computes Gullak total or streak. File + line numbers.
C) Anything in the plan's Locked Decisions (D1–D11) that conflicts with existing code behaviour you found, with your recommended resolution. If nothing conflicts, say so.
D) Confirm you understand the OTA hard rules.
Do not start implementation.
```

**Kya change hoga:** Kuch nahi. Sirf agent ko context milega.
**Kya check karna hai:**
- Baseline tests pass ho rahe hain? Jo fail ho rahe hain unki list note kar lo, taaki baad mein pata rahe ki woh pehle se fail the.
- Section B ki list mein Savings navigation ke kam se kam ye jagah hon: `HomeScreen` (2 jagah), `InsightsScreen`, `NotificationsScreen`, notification `screen: 'Savings'` payloads (dailyBudgetStore + notificationService).
- Section C mein agar agent koi real conflict bataye toh pehle mujhse (Claude se) confirm kar lo, phir aage badho.

**✅ Prompt ke BAAD:** Koi commit nahi, kyunki code change nahi hua. Confirm karo: `git status` clean hona chahiye. Agar agent ne galti se kuch change kiya hai toh `git checkout .` chalao.

---

### PROMPT 1 — Supabase Schema + Backfill

**🔀 Prompt se PEHLE (branch banao):**
```bash
git checkout integration/budget-modes
git status                      # clean hona chahiye (nothing to commit)
git checkout -b feat/budget-schema
```

```text
Follow docs/plans/budget-modes-plan.md (OTA Hard Rules + Locked Decisions D1, D5, D7). Reply in Hinglish.

TASK: Additive database migration for budget modes. No app UI/store code in this step except types.

1. Create supabase/migrations/20261001_budget_modes.sql (idempotent, re-runnable) containing:

   a) profiles — add columns (IF NOT EXISTS):
      - is_budget_mode_enabled BOOLEAN NOT NULL DEFAULT FALSE
      - budget_cadence TEXT NOT NULL DEFAULT 'daily' with CHECK (budget_cadence IN ('daily','weekly','monthly'))
      - weekly_budget NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (weekly_budget >= 0)
      - monthly_budget NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (monthly_budget >= 0)
      Use the same DROP CONSTRAINT IF EXISTS / ADD CONSTRAINT pattern already used in schema.sql.

   b) New table public.budget_plan_changes:
      id UUID PK default gen_random_uuid(), user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      effective_from DATE NOT NULL, is_enabled BOOLEAN NOT NULL, cadence TEXT NOT NULL CHECK (cadence IN ('daily','weekly','monthly')),
      amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0), created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, effective_from).
      Index on (user_id, effective_from DESC). RLS enabled with SELECT/INSERT/UPDATE/DELETE policies scoped to auth.uid() = user_id, copying the exact style of daily_savings_log policies.

   c) New table public.budget_periods:
      id UUID PK, user_id UUID NOT NULL FK auth.users ON DELETE CASCADE,
      cadence TEXT NOT NULL CHECK (cadence IN ('weekly','monthly')),
      period_start DATE NOT NULL, period_end DATE NOT NULL CHECK (period_end >= period_start),
      active_start DATE NOT NULL, active_end DATE NOT NULL   -- the prorated slice actually governed (D4)
      budget_amount NUMERIC(12,2) NOT NULL CHECK (budget_amount >= 0),
      spent_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (spent_amount >= 0),
      amount_saved NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_saved >= 0),
      status TEXT NOT NULL CHECK (status IN ('saved','missed','even','unknown')),
      is_prorated BOOLEAN NOT NULL DEFAULT FALSE, created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE (user_id, cadence, active_start).
      RLS same pattern. Index (user_id, period_start DESC).

   d) Backfill (D5) — idempotent:
      UPDATE profiles SET is_budget_mode_enabled = TRUE WHERE is_budget_mode_enabled = FALSE AND (
        is_auto_renew = TRUE
        OR EXISTS (SELECT 1 FROM gullak_deposits g WHERE g.user_id = profiles.id)
        OR EXISTS (SELECT 1 FROM daily_savings_log l WHERE l.user_id = profiles.id AND l.status = 'saved' AND l.amount_saved > 0));
      Do NOT use daily_budget > 0 as a signal.
      Seed budget_plan_changes: one row per profile that has no row yet: effective_from = profiles created date (use the profiles created_at column if it exists, otherwise auth.users.created_at, cast to date), is_enabled = profiles.is_budget_mode_enabled, cadence 'daily', amount = COALESCE(daily_budget,0). ON CONFLICT DO NOTHING.
      Guard the backfill so running the file twice changes nothing the second time.

   e) Update the handle_new_user trigger function so new users get is_budget_mode_enabled = FALSE explicitly and one seed budget_plan_changes row (effective_from = current_date, enabled false, daily, 0). Keep every existing column the trigger already inserts.

2. Mirror everything into schema.sql (append a clearly commented "Budget Modes (Oct 2026)" section) so schema.sql stays the full source of truth.

3. Add TypeScript types in src/types/index.ts (or the file where DailyRecord-like types live — follow existing convention): BudgetCadence = 'daily'|'weekly'|'monthly'; BudgetPlanChange; BudgetPeriodRecord (camelCase in app, map from snake_case).

4. BEFORE running anything on the live database: show me the full SQL, explain in Hinglish what it does and confirm it is purely additive and safe for old app bundles that don't know these columns. WAIT for my "go". Then apply it via the Supabase MCP, and afterwards run verification queries and show results:
   - count of profiles by is_budget_mode_enabled
   - count of profiles without a budget_plan_changes row (must be 0)
   - SELECT a sample of 3 rows from budget_plan_changes
   - confirm RLS enabled on both new tables

Constraints: no changes to existing columns/constraints/tables; no app.json/package.json version change; no new dependencies. Run npm test and npx tsc --noEmit at the end.
Summarize in Hinglish: files changed, SQL applied, verification output.
```

**Kya change hoga:** DB mein 4 nayi columns aur 2 nayi tables aayengi. Existing users backfill ho jayenge. `schema.sql` aur types update honge. App ka behaviour abhi bilkul same rahega.
**Kya check karna hai:**
- Supabase dashboard → `profiles` table: jin users ka daily budget auto-renew ON tha, unka `is_budget_mode_enabled = true` hona chahiye. Ek naya test account banao, uska `false` hona chahiye.
- `budget_plan_changes` mein har user ki kam se kam 1 row honi chahiye.
- **Purana app** (current installed APK) kholo: login, expense add aur savings sab normal chalna chahiye.
- Migration file dobara run karo: koi error nahi aana chahiye aur koi naya data change nahi hona chahiye.

**✅ Prompt ke BAAD (checks pass hone par commit + merge):**
```bash
npm test && npx tsc --noEmit    # dono green hone chahiye
git add -A
git status                      # dekh lo koi .env / APK / junk file na ho
git commit -m "feat(db): add budget mode columns, plan changes and budget periods tables"
git checkout integration/budget-modes
git merge --no-ff feat/budget-schema -m "merge: feat/budget-schema"
git log --oneline -3            # merge dikhna chahiye
```
> Commit ke baad chhota fix chahiye? `feat/budget-schema` par hi raho → fix → `git add -A && git commit --amend --no-edit` → phir merge karo.

---

### PROMPT 2 — Pure Budget Period Engine (logic + tests, no UI)

**🔀 Prompt se PEHLE (branch banao):**
```bash
git checkout integration/budget-modes
git status                      # clean hona chahiye (nothing to commit)
git checkout -b feat/budget-period-engine
```

```text
Follow docs/plans/budget-modes-plan.md (Locked Decisions D1–D7 are the spec). Reply in Hinglish.

TASK: Create a PURE, framework-free calculation module src/lib/budgetPeriods.ts (no React, no Zustand, no Supabase, no Date.now() inside — every function takes explicit inputs incl. todayStr) plus exhaustive vitest tests in tests/budgetPeriods.test.ts. This module is the single brain for cadence logic; the store (next phase) will only call it.

Use date-fns (already installed) with yyyy-MM-dd strings and parseISO only. Week starts Monday (weekStartsOn: 1). Money via round2 from src/lib/formatters.

Functions (names can be refined, keep them small and documented):

1. getPeriodBounds(cadence, dateStr) -> { start, end } (daily: same day; weekly: Mon–Sun; monthly: 1st–last).

2. resolvePlanForDate(changes: BudgetPlanChange[], dateStr) -> the change with the greatest effective_from <= dateStr, or null (null = paused/untracked).

3. getDateOwner(changes, dateStr) -> 'paused' | 'daily' | 'weekly' | 'monthly' (D2: every date has exactly one owner; plan with is_enabled=false => 'paused').

4. computeEffectiveFrom(kind, todayStr, context) implementing D3:
   - 'cadence_switch' -> tomorrow, EXCEPT when today's owner is 'paused' (first enable / re-enable) -> today
   - 'weekly_amount' -> next Monday (if today is Monday and the current week has no spend yet, still next Monday — keep it simple and predictable)
   - 'monthly_amount' -> next 1st
   - 'disable' -> today
   - 'enable' -> today
   Also upsertPendingChange(changes, newChange) that replaces any change with the same effective_from and drops any change with effective_from > newChange.effective_from that has become obsolete (only one pending future change may exist).

5. buildPeriodsToFinalize(changes, spentByDate, todayStr, alreadyFinalizedKeys, userCreatedAtStr) -> BudgetPeriodRecord[] for weekly/monthly only:
   - walk from the earliest non-daily/non-paused governed date to yesterday
   - group consecutive dates with the same owner AND same calendar period AND same amount into one "active slice" (activeStart..activeEnd)
   - a slice is finalizable only if todayStr > period end OR the slice ended early because ownership changed (switch/disable) and todayStr > activeEnd
   - budget = round2(amount * activeDays / totalDaysInPeriod) (D4); isProrated = activeDays < totalDays
   - spent = sum of spentByDate over active slice only (income already excluded by caller)
   - saved/status mirror evaluateDayStatus semantics from budgetCalculations.ts (saved if spent < budget, even if equal, missed if exceeded)
   - skip dates before userCreatedAtStr; skip already finalized keys (idempotent)

6. getCurrentPeriodSummary(changes, spentByDate, todayStr) -> for the hero card (D8): { cadence, periodStart, periodEnd, activeStart, budget (prorated), spent, remaining, isOver, overBy, rolloverLabelDate } or null if paused/daily.

7. isDailyGovernedDate(changes, dateStr) — helper the store will use so the existing daily finalization loop ONLY touches dates owned by 'daily' (D2).

8. computeCadenceStreak(units, currentCadence) per D6:
   - units = chronological finalized units (days or periods) each with {cadence, status, key}
   - count consecutive 'saved' units of the CURRENT cadence walking backwards from the latest; paused ranges are simply absent and must NOT break the chain; a unit of a different cadence ends the count (cadence switch resets)
   - also return bestByCadence: Record<BudgetCadence, number>
   Do NOT alter existing daily streak semantics for 'unknown' days — reuse/mirror the rules in budgetCalculations.calculateSavingsMetrics for daily units; read that function first.

Tests (must be thorough, table-driven where possible) covering at minimum:
- period bounds incl. month lengths (Feb leap 2028, 30/31 days), week crossing month/year boundary (Mon 29 Dec 2025 – Sun 4 Jan 2026)
- all 6 cadence transitions from the plan (M→W, M→D, W→M, W→D, D→W, D→M) with explicit expected owners per date, prorated budgets, spent split, and NO date counted twice (assert sum of owned dates == total dates)
- switching twice before midnight replaces pending change
- disable today -> today paused; re-enable after 10 days -> gap paused, streak bridged
- weekly amount change mid-week applies next Monday only
- user created mid-week -> first week prorated from creation date
- finalization idempotency (running twice yields nothing new)
- over-spend, even, zero-spend, zero-budget
- streak: reset on cadence switch, bridge on pause, best per cadence

Run npm test and npx tsc --noEmit — everything green. Do not touch stores, screens or components in this phase.
Summarize in Hinglish: exported API with one-line description each, and the test count.
```

**Kya change hoga:** Ek naya logic file aur uske tests aayenge. App ka UI abhi same rahega. Ye poore feature ka "dimaag" hai, isliye isko sabse strong tests ke saath banwaya hai.
**Kya check karna hai:**
- `npm test` mein naye tests dikhen aur sab pass hon. Test count 40+ ke aas-paas hona chahiye (kam ho toh agent se aur edge cases likhwao).
- Test file mein khud padh ke dekho: 6 transitions wale tests mein **"no date counted twice"** assertion hai ya nahi.
- `src/lib/budgetPeriods.ts` mein `new Date()` ya `Date.now()` directly nahi hona chahiye. `todayStr` hamesha argument se aana chahiye.

**✅ Prompt ke BAAD (checks pass hone par commit + merge):**
```bash
npm test && npx tsc --noEmit    # dono green hone chahiye
git add -A
git status                      # dekh lo koi .env / APK / junk file na ho
git commit -m "feat(budget): add pure cadence period engine with tests"
git checkout integration/budget-modes
git merge --no-ff feat/budget-period-engine -m "merge: feat/budget-period-engine"
git log --oneline -3            # merge dikhna chahiye
```
> Commit ke baad chhota fix chahiye? `feat/budget-period-engine` par hi raho → fix → `git add -A && git commit --amend --no-edit` → phir merge karo.

---

### PROMPT 3 — Store Integration (dailyBudgetStore)

**🔀 Prompt se PEHLE (branch banao):**
```bash
git checkout integration/budget-modes
git status                      # clean hona chahiye (nothing to commit)
git checkout -b feat/budget-store-cadence
```

```text
Follow docs/plans/budget-modes-plan.md (D1–D7, D10 notification gating, OTA rules). Reply in Hinglish. Read src/store/dailyBudgetStore.ts fully again and src/lib/budgetPeriods.ts before editing.

TASK: Wire the cadence engine into the existing store WITHOUT regressing current daily behaviour. Keep changes minimal and follow AGENTS.md store conventions (offline-first, registration callbacks, stores as sole data layer).

1. State (add, with defaults):
   isBudgetModeEnabled (false), budgetCadence ('daily'), weeklyBudgetAmount (0), monthlyBudgetAmount (0),
   planChanges: BudgetPlanChange[] ([]), budgetPeriods: Record<string, BudgetPeriodRecord> ({} keyed by `${cadence}_${activeStart}`),
   bestStreakByCadence ({daily:0,weekly:0,monthly:0}), lastPeriodWarningKey / lastPeriodExceededKey / lastPeriodRolloverKey (null).
   Keep isAutoRenew and dailyBudgetAmount as they are — daily cadence continues to use them exactly as today.

2. Persist: add `version` + `migrate` to the zustand persist config (name stays 'arthik-daily-budget-storage-v2'). Old persisted payload must migrate safely: missing fields -> defaults; isBudgetModeEnabled inferred locally only as a fallback (isAutoRenew true OR gullakDeposits.length > 0 OR any saved record) — the server value from hydrate always wins.

3. Actions:
   - setBudgetModeEnabled(enabled): uses computeEffectiveFrom('enable'|'disable'); upserts plan change; on disable, today becomes paused (no rollover for today). Does NOT delete any record/deposit (Gullak safety guarantee).
   - setBudgetCadence(cadence), setWeeklyBudget(amount), setMonthlyBudget(amount): create pending plan changes via the engine (D3). Expose a selector getPendingPlanChange() and getEffectiveFromLabel() for UI copy.
   - Every action: optimistic local update + Supabase write (profiles columns + budget_plan_changes upsert on (user_id, effective_from)) with the existing offline queue. Extend savePendingSettingsOffline/clearPendingSettingsOffline to support the new profile keys AND add a pending queue for plan changes (defensively parse old payloads). Never drop a queued item.

4. hydrateFromSupabase: also select the 4 new profile columns, all budget_plan_changes and budget_periods for the user (budget_periods: last 24 months is enough). Merge with pending offline items like existing code does. Keep startup order from AGENTS.md unchanged.

5. checkAndRollover:
   - Existing daily loop must only process dates where isDailyGovernedDate(...) is true (D2). Dates owned by weekly/monthly/paused must not get new daily records. Do not delete or rewrite already existing historical daily records.
   - Then call buildPeriodsToFinalize, upsert results into state + Supabase budget_periods (idempotent, offline-queued like daily records via uploadPendingDailyRecords pattern — extend or add uploadPendingBudgetPeriods).
   - Scheduled daily budget logic stays as is.
   - Notifications: if mode is OFF -> send NO warning/exceeded/rollover notifications. Weekly/monthly rollover notification once per period key (D10).

6. Gullak & streak: totalAccumulatedSavings = existing daily saved + sum of budgetPeriods.amountSaved + manual deposits (single helper, used everywhere the total is read). savingsStreak/bestStreak must reflect the current cadence via computeCadenceStreak; keep bestStreakByCadence updated. Existing daily-only users must see the exact same numbers as before (write a regression test).

7. Budget warnings (80%/100%) for weekly/monthly using getCurrentPeriodSummary, deduped per period key.

8. Sign-out reset: every new field resets (AGENTS.md §9).

Tests (tests/dailyBudgetStore.test.ts and/or a new tests/budgetModesStore.test.ts):
- persisted v-old payload migrates without crash
- daily-only user: metrics identical before/after this change (regression)
- weekly user: period finalizes on Monday, Gullak increases by saved, no daily records created for that week
- mode OFF: no notifications, no records, deposits untouched
- offline: plan change queued and flushed on reconnect

Do NOT touch UI components/screens in this phase. npm test + npx tsc --noEmit green.
Summarize in Hinglish: new state/actions, what changed in checkAndRollover, and any behaviour change existing daily users could notice (should be none).
```

**Kya change hoga:** Store mode aur cadence samajhne lagega. Weekly/monthly periods finalize honge aur Gullak total mein judenge. Mode OFF hone par budget notifications band ho jayengi. UI abhi same dikhega.
**Kya check karna hai:**
- `npx expo start` → apne existing account se login karo. **Gullak total aur streak bilkul pehle jaisa** dikhna chahiye (sabse important check).
- Airplane mode ON → app kholo → crash nahi hona chahiye.
- Logout → dusre account se login → pehle account ka koi data na dikhe.
- Supabase `budget_periods` abhi khali ho sakta hai, ye theek hai (UI se cadence abhi set nahi ho sakta).

**✅ Prompt ke BAAD (checks pass hone par commit + merge):**
```bash
npm test && npx tsc --noEmit    # dono green hone chahiye
git add -A
git status                      # dekh lo koi .env / APK / junk file na ho
git commit -m "feat(budget): integrate cadence engine into daily budget store"
git checkout integration/budget-modes
git merge --no-ff feat/budget-store-cadence -m "merge: feat/budget-store-cadence"
git log --oneline -3            # merge dikhna chahiye
```
> Commit ke baad chhota fix chahiye? `feat/budget-store-cadence` par hi raho → fix → `git add -A && git commit --amend --no-edit` → phir merge karo.

---

### PROMPT 4 — Pure Mode Shell (Profile toggle + 4/5 tabs + route guard)

**🔀 Prompt se PEHLE (branch banao):**
```bash
git checkout integration/budget-modes
git status                      # clean hona chahiye (nothing to commit)
git checkout -b feat/pure-mode-shell
```

```text
Follow docs/plans/budget-modes-plan.md (Original spec sections 3A, 6 Edge Cases 1/5/6 + Locked D10, D11). Reply in Hinglish. Follow AGENTS.md design-token rules, useSafeAreaInsets, light+dark themes, no new dependencies (core Animated only).

TASK:
1. ProfileScreen: add a "Smart Budget & Gullak" card with a switch bound to isBudgetModeEnabled.
   - Subtitle when OFF: "Sirf kharcha track karo — koi limit nahi". When ON: current cadence + amount (e.g. "Weekly · ₹7,000").
   - Turning OFF when Gullak total > 0 OR current streak > 0: show confirmation Alert exactly per original spec Edge Case 1 (title "Smart Budget & Gullak Paused", body with real formatted Gullak balance, buttons "Cancel" / "Turn Off Anyway"). Otherwise turn off directly.
   - Turning ON: enable, then open the budget setup (reuse BudgetEditModal for now; cadence selector comes in Prompt 6) if no amount is set.

2. BottomNavBar: 4-tab layout (Home, History, +, Insights) when mode OFF; 5-tab when ON. Savings tab enters/exits with a smooth fade + scale/width shrink (~220ms, Animated, useNativeDriver where the property allows). The center + button must stay perfectly centered in both layouts and the existing buffer zones must be respected. Check the current tab positioning logic (getRouteIndex etc.) so indexes don't break when Savings is hidden.

3. Route guard (D11): Savings is registered in both Tab and Stack navigators. Add a single guard so that when mode is OFF any navigation to 'Savings' (notification tap, NotificationsScreen item, deep link, HomeScreen/InsightsScreen links) lands on Home instead. Implement it in one place (e.g. a wrapper component for the Savings screen or a navigation listener) — do not sprinkle checks in every caller. Also: notification payloads with screen 'Savings' must route to Home in pure mode; daily_reminder should route to Home always.

4. Hide in pure mode (Edge Case 5/6): HomeScreen "Set daily limit ›" affordance + Gullak rollover strip; InsightsScreen YearlySavingsMilestoneCard. Hero card redesign itself is Prompt 5 — here only hide the Savings-linked affordances.

5. Tests: add/extend unit tests for any pure helper you create (e.g. getVisibleTabs(isBudgetModeEnabled), resolveSavingsRoute). npm test + npx tsc --noEmit green.

Summarize in Hinglish with a manual QA checklist for me.
```

**Kya change hoga:** Profile mein naya toggle aayega. Mode OFF par bottom bar 4 tab ka ho jayega aur Savings animation ke saath gayab hoga. Pure mode mein Savings kisi bhi raste se nahi khulega.
**Kya check karna hai:**
- Naya account → default 4 tabs, "+" button ekdum center mein.
- Toggle ON/OFF karo → Savings tab smoothly aaye aur jaye, koi jump ya flicker na ho. **Light aur dark dono** theme mein dekho.
- Gullak mein paise hon tab OFF karo → popup mein sahi amount dikhe. "Cancel" dabane par kuch na badle.
- OFF karke purani notification (Notifications screen) par tap karo → Home khule, crash na ho.
- OFF → ON → Gullak balance same rahe.

**✅ Prompt ke BAAD (checks pass hone par commit + merge):**
```bash
npm test && npx tsc --noEmit    # dono green hone chahiye
git add -A
git status                      # dekh lo koi .env / APK / junk file na ho
git commit -m "feat(nav): pure expense mode with dynamic tabs and savings route guard"
git checkout integration/budget-modes
git merge --no-ff feat/pure-mode-shell -m "merge: feat/pure-mode-shell"
git log --oneline -3            # merge dikhna chahiye
```
> Commit ke baad chhota fix chahiye? `feat/pure-mode-shell` par hi raho → fix → `git add -A && git commit --amend --no-edit` → phir merge karo.

---

### PROMPT 5 — Dual Concentric Ring + Pure Mode Hero

**🔀 Prompt se PEHLE (branch banao):**
```bash
git checkout integration/budget-modes
git status                      # clean hona chahiye (nothing to commit)
git checkout -b feat/dual-ring-hero
```

```text
Follow docs/plans/budget-modes-plan.md (original spec sections 3B and 3C for visuals + Locked D9 for edge cases). Reply in Hinglish. react-native-svg is already installed — no new deps. Follow AGENTS.md token rules; literal values from the spec (radius 42/32, stroke 6.5, colors #10B981, #E05A47, #EF4444 and their 0.15 tracks) stay literal where no token role matches.

TASK:
1. Create src/components/DualRingChart.tsx:
   - Pod ~96–100px, outer ring r≈42 stroke 6.5 (inflow, mint), inner ring r≈32 stroke 6.5 (outflow, coral / red when over), ~3.5px optical gap, round caps, start at 12 o'clock.
   - Animate arc progress on value change (Animated + strokeDashoffset, same approach as existing AnimatedCategoryDonut if it fits — read it first and reuse patterns).
   - Tap center toggles view: '% spent' <-> '+₹5.0k / −₹2.2k' (compact formatter; add one to formatters.ts only if none exists, with tests).
   - Edge cases EXACTLY per table D9 (income 0 -> "₹X spent" no %, cap "999%+", 0/0 -> "₹0").
   - Put the ring math in a pure function (computeDualRingState) in src/lib/chartUtils.ts or a new small lib file, with vitest tests covering every D9 row.
   - Accessibility: accessibilityRole="button", accessibilityLabel describing inflow, outflow and percentage.

2. BrandedHeroCard (pure mode only — when isBudgetModeEnabled is false):
   - Titles by filter: Daily "Spent Today", Weekly "This Week's Expense", Monthly "This Month's Expense", All "All-Time Expense".
   - Big number = total expense for the filter period (income excluded via existing isIncomeTransaction classification).
   - Footer row: Inflow +₹ (green), Outflow −₹ (coral), Net (sign-aware).
   - Replace the donut in the notched pocket with DualRingChart; keep the pocket geometry working with the slightly bigger pod.
   - No "Set daily limit", no rollover strip.
   - Budget-mode rendering must remain exactly as today in this phase (Mode 2 hero comes in Prompt 6).
   - Move any new calculation out of the component into homeCalculations.ts (see .scratch/home/issues/05 — don't add more accumulation inside screens) with tests; update tests/brandedHeroCard.test.ts.

npm test + npx tsc --noEmit green. Summarize in Hinglish + manual QA list (light/dark, small screen, each filter, each D9 case).
```

**Kya change hoga:** Pure mode ka Home ab kharcha-centric ho jayega aur top-right mein Dual Ring aayega. Budget mode wala Home abhi pehle jaisa rahega.
**Kya check karna hai:**
- Chaaron filters (Daily/Weekly/Monthly/All) par title aur bada number sahi hon.
- D9 ki chaaron cases test karo: (a) naya account (₹0), (b) sirf expense (₹X spent), (c) income > expense (%), (d) expense > income (inner ring red, % 100 se upar).
- Ring ke center par tap karke toggle karo. Chhote phone ya small screen par pocket kate nahi. Dark mode mein bhi dekho.

**✅ Prompt ke BAAD (checks pass hone par commit + merge):**
```bash
npm test && npx tsc --noEmit    # dono green hone chahiye
git add -A
git status                      # dekh lo koi .env / APK / junk file na ho
git commit -m "feat(home): dual concentric inflow/outflow ring and pure mode hero"
git checkout integration/budget-modes
git merge --no-ff feat/dual-ring-hero -m "merge: feat/dual-ring-hero"
git log --oneline -3            # merge dikhna chahiye
```
> Commit ke baad chhota fix chahiye? `feat/dual-ring-hero` par hi raho → fix → `git add -A && git commit --amend --no-edit` → phir merge karo.

---

### PROMPT 6 — Cadence UI (Budget setup, Mode 2 Hero, Adaptive Streak, Insights)

**🔀 Prompt se PEHLE (branch banao):**
```bash
git checkout integration/budget-modes
git status                      # clean hona chahiye (nothing to commit)
git checkout -b feat/cadence-ui
```

```text
Follow docs/plans/budget-modes-plan.md (original spec 4A/4B + Locked D3, D4, D6, D7, D8). Reply in Hinglish. No new deps, tokens + light/dark per AGENTS.md.

TASK:
1. BudgetEditModal -> cadence-aware setup:
   - 3-segment selector ☀️ Daily / 📅 Weekly / 🗓 Monthly (reuse existing Bouncy*Toggle pattern) + amount keypad/input (reuse amountKeypad lib).
   - Show "effective from" copy from the store selector: e.g. "Kal (Thu, 2 Oct) se lagu hoga", "Agle Monday (6 Oct) se", "1 Nov se", or "Aaj se" for first enable.
   - If the change creates a partial period, show a one-line proration preview: "Is hafte ke bache 3 din ka budget: ₹3,000".
   - If a pending change exists, show it with a "Cancel change" action.
   - Validation: amount > 0, sensible upper bound consistent with existing amount limits.

2. BrandedHeroCard in budget mode (D8):
   - daily cadence: keep EXACTLY today's current UI/behaviour.
   - weekly/monthly: primary = remaining in current cadence period (getCurrentPeriodSummary), label "Left this week"/"Left this month"; strip "₹X Sunday ke baad Gullak mein" / "₹X month-end ke baad Gullak mein" or "Over by ₹Y this week". Filter chips still drive inflow/outflow + ring.

3. StreakCalendarModal adaptive (spec 4B):
   - daily: existing 30-day dot grid unchanged.
   - weekly: vertical week cards (Week label + date range, "+₹X to Gullak" / "Over by ₹Y", micro progress bar, current week pulsing "● On Track" / "● Over"). Last ~8 weeks + current.
   - monthly: 12-month matrix (Jan–Dec of current year) with saved badge per finalized month, current month progress, future months muted.
   - Paused ranges shown as a subtle "Paused" label, never red.
   - Streak label unit per D6 ("5 days" / "3 weeks" / "2 months"); show best streak for current cadence.

4. StreakFlame / SavingsScreen: any copy that says "daily" or "tonight" must be cadence-aware. Gullak history list must include budget period rollovers (label "Week of 29 Sep" / "October 2026").

5. InsightsScreen: YearlySavingsMilestoneCard visible only in budget mode and its totals include period savings.

Put any new formatting/grouping logic into pure lib functions with tests. npm test + npx tsc --noEmit green.
Summarize in Hinglish + QA checklist per cadence.
```

**Kya change hoga:** User ab Daily, Weekly ya Monthly choose kar sakega. Hero card aur streak calendar cadence ke hisaab se badlenge. Gullak history mein weekly aur monthly entries bhi dikhengi.
**Kya check karna hai (sabse lamba QA yahi hai):**
- Daily user: **sab pehle jaisa** dikhna chahiye.
- Weekly set karo → "Agle Monday se" dikhe. Agar mode abhi OFF se ON kiya hai toh "Aaj se" dikhe aur proration preview sahi ho (khud calculator se check karo).
- Monthly se Weekly switch karo → "Kal se" dikhe. Midnight se pehle Daily choose karo → pending change replace ho jaye (2 pending nahi hone chahiye).
- **Date test:** phone ki date manually aage badhao (Settings → date/time, auto off). Next Monday par app kholo → week finalize ho, Gullak badhe, notification aaye. Phir date wapas auto par set karo.
- Streak modal teeno cadence mein khol ke dekho, light aur dark dono mein.

**✅ Prompt ke BAAD (checks pass hone par commit + merge):**
```bash
npm test && npx tsc --noEmit    # dono green hone chahiye
git add -A
git status                      # dekh lo koi .env / APK / junk file na ho
git commit -m "feat(budget): weekly and monthly cadence setup, hero, streak calendar"
git checkout integration/budget-modes
git merge --no-ff feat/cadence-ui -m "merge: feat/cadence-ui"
git log --oneline -3            # merge dikhna chahiye
```
> Commit ke baad chhota fix chahiye? `feat/cadence-ui` par hi raho → fix → `git add -A && git commit --amend --no-edit` → phir merge karo.

---

### PROMPT 7 — Notifications, FAQ, Docs, Changelog

**🔀 Prompt se PEHLE (branch banao):**
```bash
git checkout integration/budget-modes
git status                      # clean hona chahiye (nothing to commit)
git checkout -b feat/budget-notifs-docs
```

```text
Follow docs/plans/budget-modes-plan.md (D10 + docs rules in AGENTS.md). Reply in Hinglish.

TASK:
1. Audit every notification trigger (dailyBudgetStore, notificationService, scheduled daily_reminder). Verify and fix:
   - mode OFF: zero budget warning/exceeded/rollover notifications (local list + device); daily_reminder still allowed, routes to Home.
   - weekly/monthly: 80% + 100% warnings once per period, rollover notification once per period with the saved amount; copy in the app's existing tone.
   - no notification loop / duplicate on re-render or rehydrate (AGENTS.md §10). Add tests for dedupe keys.
2. FaqScreen: add a "Budget Modes" category (What is Pure mode? How do weekly/monthly budgets work? When does money go to Gullak? What happens when I switch cadence mid-week (proration, from tomorrow)? Is my Gullak safe if I turn it off?). Update existing "Daily Budget" answers that are now inaccurate.
3. Onboarding/empty states: if any onboarding copy assumes a daily budget, make it mode-neutral (pure mode is the default for new users).
4. Docs: update CONTEXT.md glossary (Pure mode, Budget mode, cadence, budget period, active slice, proration, paused), docs/maps/daily-budget-map.md (new flow), add docs/adr/0010-budget-cadence-periods.md (context, decision = D1–D7, consequences), README feature list, CHANGELOG.md entry for the release.
npm test + npx tsc --noEmit green. Summarize in Hinglish.
```

**Kya change hoga:** Notifications cadence ke hisaab se sahi ho jayengi. FAQ, docs aur changelog update honge.
**Kya check karna hai:**
- Pure mode mein bohot kharcha add karo → koi "limit exceeded" notification nahi aani chahiye.
- Weekly budget ka 80% cross karo → sirf **ek** notification aaye. App band karke dobara kholo → dobara nahi aani chahiye.
- FAQ screen mein naya "Budget Modes" section padh ke dekho ki sab samajh aa raha hai.

**✅ Prompt ke BAAD (checks pass hone par commit + merge):**
```bash
npm test && npx tsc --noEmit    # dono green hone chahiye
git add -A
git status                      # dekh lo koi .env / APK / junk file na ho
git commit -m "feat(budget): cadence-aware notifications, FAQ and docs"
git checkout integration/budget-modes
git merge --no-ff feat/budget-notifs-docs -m "merge: feat/budget-notifs-docs"
git log --oneline -3            # merge dikhna chahiye
```
> Commit ke baad chhota fix chahiye? `feat/budget-notifs-docs` par hi raho → fix → `git add -A && git commit --amend --no-edit` → phir merge karo.

---

### PROMPT 8 — Final QA, Merge, Push, OTA Release

**🔀 Prompt se PEHLE:**
```bash
git checkout integration/budget-modes
git branch --merged             # saari 7 feat/* branches list mein honi chahiye
git status                      # clean
```

```text
Follow docs/plans/budget-modes-plan.md. Reply in Hinglish. This is a verification + release-prep step.

1. Run npm test and npx tsc --noEmit on integration/budget-modes. Everything green.
2. OTA safety audit — prove each with a command/output:
   - git diff main -- package.json package-lock.json app.json eas.json : show that no dependency was added/changed and expo.version/runtimeVersion are unchanged (still 1.2.4 / appVersion). If anything native changed, STOP and tell me.
   - grep the diff for any new import of a package not already in package.json.
   - Confirm all DB changes are additive and already applied (query Supabase via MCP: new columns + tables exist, RLS on).
3. Code audit across the whole diff vs main:
   - every new store field reset on sign-out
   - persist migrate handles an old payload (show the test)
   - no navigation to 'Savings' bypasses the guard
   - no date is double-counted (point to the engine tests)
   - no hardcoded colors/spacing violating AGENTS.md token rules; light/dark handled
   - no console.log without __DEV__ guard
4. Produce a final manual QA script for me (Hinglish, numbered) covering: new user, existing daily user (numbers unchanged), OFF/ON with Gullak, all 6 cadence switches, week/month finalization via device date change, offline mode, sign-out/sign-in, notifications, light/dark.
Do NOT merge or publish — I will run the release commands myself.
```

**Kya change hoga:** Code mein kuch nahi. Sirf final audit hoga aur tumhe QA script milegi.
**Kya check karna hai:** Agent ki QA script poori khud chalao. Sabse zaroori ye 3 cheezein hain:
1. `package.json` aur `app.json` mein **koi change nahi** hona chahiye (warna OTA crash karega).
2. Existing daily user ke Gullak aur streak numbers same hon.
3. Offline start par crash nahi hona chahiye.

**✅ Prompt ke BAAD (QA pass hone par) — Release commands:**
```bash
# 1. Merge & push
git checkout main
git merge --no-ff integration/budget-modes -m "release: budget modes (pure tracker + weekly/monthly gullak)"
git push origin main
git push origin integration/budget-modes   # optional, backup ke liye

# 2. OTA — pehle preview channel par test (AGENTS.md §11.3)
eas update --branch preview --message "Budget modes: pure tracker, weekly/monthly Gullak, dual ring"
#    → preview APK wale phone par app 2 baar restart karo (download + apply) aur smoke test karo

# 3. Sab theek ho toh production channel par
eas update --branch production --message "Budget modes: pure tracker, weekly/monthly Gullak, dual ring"
```
> ⚠️ Pehle confirm kar lo ki tumhare users ka installed APK kaunse channel (`preview` ya `production`) par hai (`eas.json` ke hisaab se preview APK = `preview` channel). OTA usi channel par bhejna hai, warna users tak update nahi pahunchega.

**Rollback plan:** Koi bada bug aaye toh `eas update:republish` se previous update wapas bhej do. DB changes additive hain, isliye purana bundle bina kisi problem ke chalta rahega.

---

## 4. 🧯 Agar kuch galat ho jaye

| Problem | Kya karna hai |
|---|---|
| Agent ne naya package install kar diya | Us prompt ke output ko reject karo: `git checkout .`, phir prompt dobara do aur saath mein likho "no new dependencies". |
| Tests fail hain par agent "done" bol raha hai | Commit mat karo. Likho: "npm test output paste karo aur fail tests fix karo, test ko weaken mat karna." |
| Existing user ka Gullak number badal gaya | Prompt 3 wali regression test dikhane ko bolo. Ye must-fix hai. |
| Kisi phase mein scope bahut bada lag raha hai | Agent ko bolo "is phase ko 2 parts mein karo, part 1 ke baad ruk jao". Branch same rakho. |
