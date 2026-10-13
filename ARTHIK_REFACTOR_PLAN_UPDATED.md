# Arthik — Safe Refactor Plan (behaviour same, code simple)

> **Basis:** uploaded `Arthik-App-main(10).zip` snapshot, package version `2.1.0`, reviewed on 2026-10-14. This is a static ZIP review; test/typecheck results must be measured locally in Step 0.
> **Line numbers** is doc mein us zip ke hain. Code badalne ke baad shift ho jayenge, isliye prompts mein agent ko hamesha **function ke naam se** dhundhne bolo, line number sirf "andaza" hai.
> **Is plan ka ek hi maqsad:** app ka koi bhi feature, calculation, ya behaviour **na badle**. Sirf code ki jagah, size aur readability badle.

---

## Table of contents

0. Goal ek line mein
1. Golden rules (inhe kabhi mat todna)
2. Abhi app kahan khadi hai (measured numbers)
3. Danger map (kaunsi file kyun risky hai)
4. Mattpocock skills — kahan kaunsi
5. Branch map
6. Har step ka standard loop + 5 gates
7. Manual smoke checklist (device par)
8. Steps
   - Step 0 — Baseline + Refactor Mode setup
   - Step 1 — Safety net audit: `syncPendingExpenses` (old plan's zero-test claim must be re-verified against current tests first)
   - Step 2 — Safety net: `hydrateFromSupabase`, `checkAndRollover`, `syncWithExpenses`
   - Step 3 — `InsightsScreen` split
   - Step 4 — `ProfileScreen` split
   - Step 5 — `SavingsScreen`, `StreakCalendarModal` split
   - Step 6 — `expenseStore` split
   - Step 7 — `dailyBudgetStore` split (sabse bada)
   - Step 8 — `any` cleanup + duplicate helpers
   - Step 9 — Final verification + merge + OTA
9. Agar kuch toot jaye (rollback + diagnose)
10. Kya NAHI karna (list)

---

## 0. Goal ek line mein

> "Same app, same numbers, same screens — bas badi files chhoti, samajhne layak, aur tests ke andar."

Tum kuch naya feature nahi add kar rahe, kuch fix nahi kar rahe. **Sirf code ko ghar-ghar mein baant rahe ho** (jaise ek bade godown ko alag-alag labelled kamron mein).

---

## 1. Golden rules

1. **Behaviour same.** Refactor commit mein logic nahi badalta. Sirf "cut + paste + naam dena".
2. **Pehle test, phir refactor.** Jis function ko todna hai, uska "abhi jaisa chal raha hai waisa" test pehle likho (characterization test).
3. **Refactor ke commit mein koi purana test edit nahi.** Agar purana test badalna pada, matlab behaviour badal gaya. Ruko, revert karo.
4. **Ek baar mein ek hi file ya ek hi function.** Bada-bada commit nahi.
5. **Bug mile to fix mat karo.** `docs/refactor/FOUND_BUGS.md` mein likho. Fix alag branch mein, refactor ke baad.
6. **Public API same.** Har export ka naam aur import path same rahe (naye files se `re-export` karo). 26 files `dailyBudgetStore` import karti hain, 25 `expenseStore`, unhe haath nahi lagana.
7. **No new dependency, no native change, no `schema.sql` change.** Native module (`modules/arthik-autolog`), `versionCheck.ts`, `UpdateRequiredScreen.tsx` ko touch nahi karna. Existing Auto Logging implementation/spec/migrations and pull-to-history behaviour are protected product surfaces: do not refactor them casually or combine their work with store/screen splits.
8. **`useEffect` / `useMemo` ki dependency arrays "fix" mat karo.** Verbatim copy karo, chahe kitni "galat" lage.
9. **OTA/`eas update` tab tak nahi jab tak Step 9 ka smoke checklist pass na ho.**
10. **Agent kabhi `git commit/push/merge/eas update` nahi karega.** Ye tum khud karoge (AGENTS.md ka rule already yehi kehta hai).

---

## 2. Abhi app kahan khadi hai (maine zip par chala kar nikala)

| Check | Result |
|---|---|
| `npm test` (vitest) | **Historical reference only:** old snapshot reported 71 files / 1182 tests; current ZIP must be measured in Step 0 |
| `npx tsc --noEmit` | **0 errors** |
| Source + tests total | ~72,000 lines |
| Tests ka environment | `node` (DOM nahi). Sirf `tests/**/*.test.ts` chalte hain, **`.tsx` tests nahi chalte** |
| Test helpers jo pehle se hain | `tests/helpers/hookRuntime.ts` (hooks bina renderer ke chalane ke liye), `tests/helpers/fakeStore.ts`, `tests/helpers/autoLogTestEnv.ts` |
| `any` / `@ts-ignore` | Old-plan count was 74; current ZIP must be re-counted in Step 0 |
| Screens jinke naam ka koi test nahi | `SavingsScreen`, `ProfileScreen`, `ExpenseFormScreen`, `DepositGullakModal`, `StreakCalendarModal`, `CadenceSwitchModal` |
| `syncPendingExpenses` (about 380 lines in the old snapshot) ke tests | **Audit current tests first; do not assume zero coverage** |

**Matlab:** existing pure-function coverage useful hai, lekin old-plan ke counts and coverage claims are not authoritative for this newer ZIP. Step 0 must establish the actual baseline and audit existing coverage before adding tests. Do not add duplicate characterization tests simply to match the old plan.

> Important limit: confirm the current Vitest include pattern and environment in Step 0 before relying on the old claim that only `.ts` tests run. Regardless, UI-only JSX extraction is validated with typecheck + device screenshots; move business/financial derivations only when a characterization test can observe the same behaviour.

---

## 2A. Current ZIP reconciliation (read this before running Step 0)

The old plan was written against an earlier snapshot. This uploaded ZIP already contains newer work, so **do not execute old prompts blindly**.

### Confirmed current files / line counts

| Area | Current path | Lines in uploaded ZIP | Refactor stance |
|---|---|---:|---|
| Budget / real-money state | `src/store/dailyBudgetStore.ts` | 2734 | High risk; tests first |
| Expense storage / offline sync | `src/store/expenseStore.ts` | 1192 | High risk; tests first |
| Insights UI / derived calculations | `src/screens/InsightsScreen.tsx` | 2064 | Move-only after baseline |
| Savings UI | `src/screens/SavingsScreen.tsx` | 1491 | Move-only after baseline |
| Profile / account actions | `src/screens/ProfileScreen.tsx` | 1198 | Move-only after baseline |
| Streak calendar | `src/components/StreakCalendarModal.tsx` | 901 | Move-only after baseline |
| Expense entry | `src/screens/ExpenseFormScreen.tsx` | 1177 | Move-only after baseline |
| Auto Logging engine | `src/features/autoLog/engine.ts` | 640 | Protect; no broad refactor in this plan |
| Auto Logging database | `src/features/autoLog/db.ts` | 371 | Protect SQLCipher/local data behaviour |
| Auto Logging service | `src/features/autoLog/service.ts` | 476 | Protect lifecycle, setup boundary, sign-out/pause |
| Auto Logging matching | `src/features/autoLog/matching.ts` | 207 | Protect exact-reference and cross-source identity rules |
| Pull-to-History list | `src/components/PullToHistoryList.tsx` | 457 | Treat gesture/navigation/haptics as a frozen interaction |
| Pull-to-History indicator | `src/components/PullToHistoryIndicator.tsx` | 150 | Keep visual progress/release threshold unchanged |
| Pull-to-History physics | `src/lib/pullToHistoryPhysics.ts` | 239 | Existing pure tests are the behaviour contract |

### Recent features that the old plan omitted

The ZIP includes:
- `src/features/autoLog/*` (parser, matching, engine, SQLCipher DB, ledger, review flow, background service, rollout, notifications, permissions, remote sync and types).
- `src/components/autolog/*` and `src/screens/autolog/*`, including email setup/review/management.
- Native Android module `modules/arthik-autolog/*`, the email auto-logging spec `docs/specs/EMAIL_AUTO_LOGGING_SPEC.md`, and migration `supabase/migrations/20261006_autolog_profiles.sql`.
- Split/reimbursement/self-transfer accounting tests: `tests/autoLogSplit.test.ts`, `tests/sharesReimbursementsTransfers.test.ts`, `tests/autoLogFixes.test.ts`.
- Pull-to-History implementation and physics tests: `src/components/PullToHistoryList.tsx`, `src/components/PullToHistoryIndicator.tsx`, `src/lib/pullToHistoryPhysics.ts`, `tests/pullToHistoryPhysics.test.ts`.

These are not “missing small files” to squeeze into the old screen/store split. They are recent, cross-cutting product behaviour and must be explicitly protected by the smoke checklist and the regression suite.

### New non-negotiable protected behaviour

1. **Auto Logging start boundary:** no historical SMS/email/notifications are retroactively logged when setup is enabled; only events after the user's activation boundary count.
2. **Multi-source identity:** exact stable references (RRN/UTR/transaction IDs) take precedence; a late SMS/email must attach to an already logged transaction rather than create a duplicate or reopen review. Probabilistic matching must not merge same-source repeated genuine payments or ambiguous transactions.
3. **Review lifecycle:** a user-confirmed email transaction must not be re-queued by a notification sweeper; delayed sources should merge into `transaction_sources` and remain explainable in “Why logged”.
4. **Financial classification:** reimbursement is linked to the original split/share and is not income; own-account transfers are neither income nor expense; refunds/reversals/card-bill payments retain their current classification.
5. **Local privacy and lifecycle:** preserve on-device SQLCipher storage, account isolation, sign-out/pause/disable behaviour, tracked-account/rule persistence, and the current native setup boundary. Any change to `modules/arthik-autolog`, Android permissions, manifests, app config, SQL/schema/migrations or background registration is **out of scope** for this behaviour-preserving refactor.
6. **Pull-to-History:** preserve the five recent transaction pills, permanently visible bottom navigation, indicator placement, gesture claiming, progressive ring, threshold/hysteresis, cancellation spring, single haptic, and navigation only after a qualified release.

### Step 0 must now do this before selecting steps

- Record `git status --short` and the current branch; do not assume the ZIP is a Git checkout or that the working tree is clean.
- Run `npm ci`, `npm test`, and `npx tsc --noEmit` on the actual working repository; record exact command output, test files/tests count, duration, and failures. The old 71/1182 figure is historical, not a gate.
- Inspect `vitest.config.mjs`, `package.json`, Node version, and test helper setup. The current `AGENTS.md` says Node 22+ because tests use `node:sqlite`; use a supported Node version.
- Audit whether `syncPendingExpenses`, hydration, rollover, Auto Logging email/source reconciliation, reimbursement/transfer classification, and pull-to-history already have tests. Record coverage in `docs/refactor/COVERAGE_GAPS.md`; only add tests for genuine gaps.
- Count current `any` / `@ts-ignore`, current file lengths, exports/importers, and circular dependencies from the current ZIP rather than carrying old numbers forward.
- Save the current device screenshots and run the expanded smoke checklist below before production refactoring begins.

---

## 3. Danger map

| # | File | Size | Sabse bada hissa | Risk kyun |
|---|---|---|---|---|
| 1 | `src/store/dailyBudgetStore.ts` | 2734 lines in this ZIP | `hydrateFromSupabase` **572 lines** (1849–2421), `checkAndRollover` **299** (1450–1749), `syncWithExpenses` 150 (1300–1449), `setBudgetModeEnabled` 110 | Paisa, streak, Gullak sab yahin. 26 files import karti hain. Ek action mein network + AsyncStorage + calculation + notification mixed |
| 2 | `src/store/expenseStore.ts` | 1192 lines in this ZIP | `syncPendingExpenses` **~380 lines** (337–718), `fetchExpenses` 150, `addExpense` ~100, `deleteExpense` ~105 | Offline queue (delete → add → update → settings → daily → gullak → categories → profile). Koi item silently drop hua to user ka data gaya. **Zero tests** |
| 3 | `src/screens/InsightsScreen.tsx` | 2064 lines in this ZIP | Ek component **1707 lines** (326–2033), **54 `useMemo`**, styles 1850–2033 | Calculations screen ke andar, testable nahi. Sirf data dikhata hai (paisa write nahi) → **practice ke liye sabse safe** |
| 4 | `src/screens/SavingsScreen.tsx` | 1491 lines in this ZIP | JSX sections: Hero 398–537, Budget Hub **538–915 (380 lines)**, History 916–990, styles 1021–1453 | Pehle se `useSavingsDashboard` hook (tested) hai, bas JSX bada |
| 5 | `src/screens/ProfileScreen.tsx` | 1198 lines in this ZIP | 12 `useState`, 3 Modals andar (326, 390, 427), handlers (logout 153, delete 224/230, save 292), styles 877–1187 | Delete account + logout flow yahin hai |
| 6 | `src/components/StreakCalendarModal.tsx` | 901 lines | Supabase direct call (line 19 import, ~211 query) | ADR-0003 (screens Supabase nahi chhuenge) ka violation. Behaviour mat badlo, sirf andar ki query/mapping alag file mein |
| 7 | `src/screens/ExpenseFormScreen.tsx` | 1177 lines | Logic pehle se `useExpenseForm` hook mein, tested | Low priority. Sirf styles alag file (optional) |
| 8 | `src/lib/chartUtils.ts`, `yearly/monthly/weeklyInsightsUtils.ts` | 1131 / 902 / 720 / 532 | Pure functions, tested | **Mat chhedo** (abhi safe hain) |

---

## 4. Mattpocock skills — kahan kaunsi

> Naam meri jaankari ke hisaab se hain. Teri installed list mein spelling thoda alag ho sakti hai, to apne agent mein skills ki list dekh ke match kar lena. Prompt mein skill ka naam seedha likh do (ya slash command jaise `/tdd`).
> `skills-lock.json` abhi khali hai (`"skills": {}`), matlab skills lock file mein register nahi hain. Ek baar check kar lo ki skills `.claude/skills` ya `.agents/skills` jaisi jagah par actually installed hain. Install ke liye mattpocock ke skills repo ki README dekho (command: `npx skills@latest add mattpocock/skills` hota hai, agar purana ho to README ka latest command lo).

| Skill | Kya karta hai | Tum kahan use karoge |
|---|---|---|
| `zoom-out` | Unjaan code ka bada-picture map deta hai | Step 0 (map), aur har step se pehle jab nayi file kholte ho |
| `tdd` | Red → green → refactor, public interface ke through test | **Step 1, 2** (characterization tests), Step 3c (hook test) |
| `improve-codebase-architecture` | "Deepening opportunities" dhoondhta hai. `CONTEXT.md` aur `docs/adr/` padh ke sujhata hai (tumhare paas dono pehle se hain) | **Step 6, 7 ka Phase A** (sirf plan, code nahi) |
| `grill-me` (ya `grill-with-docs`) | Tumhare plan par sawal-sawal karke chhed dhoondhta hai | Step 6, 7 plan ko stress-test karne ke liye |
| `to-issues` | Bade plan ko chhote independently-shippable tukdon mein todta hai | Step 7 ko sub-steps mein todne ke liye (tum `.scratch/` mein already issues rakhte ho, wahi format) |
| `diagnose` | Bug ke liye disciplined loop: reproduce → minimise → hypothesise → fix | **Sirf tab jab koi test fail ho ya smoke mein kuch toote** |

Jo skills yahan **nahi** chahiye: `to-prd`, `triage`, `write-a-skill` etc. (feature planning ke liye hain, refactor ke liye nahi).

---

## 5. Branch map

```
main                         (jaise abhi hai, tag: pre-refactor)
 └─ refactor/integration     (sab steps yahin merge honge. main ko sirf last mein)
     ├─ refactor/00-baseline
     ├─ refactor/01-safety-net-expense-sync
     ├─ refactor/02-safety-net-budget-store
     ├─ refactor/03-insights-split
     ├─ refactor/04-profile-split
     ├─ refactor/05-savings-streak-split
     ├─ refactor/06-expense-store-split
     ├─ refactor/07-daily-budget-store-split
     └─ refactor/08-types-and-dedupe
```

**Kyun is order mein:** pehle jaal (tests), phir aasan aur kam-risk (screens, sirf data dikhate hain), phir stores (paisa/sync). Agar kisi step mein gadbad ho to pichle steps safe hain.

**Har step ka branch flow (copy-paste):**

```bash
git checkout refactor/integration
git pull   # agar remote par push kiya ho
git checkout -b refactor/0X-name     # <- step ka branch
# ... agent kaam karta hai, tum review karte ho ...
npm test && npx tsc --noEmit         # gates (section 6)
git add -A
git commit -m "refactor(0X): <short message>"
git checkout refactor/integration
git merge --no-ff refactor/0X-name   # --no-ff taaki rollback ek revert se ho
```

**Ek baar, shuru mein (Step 0 mein):**

```bash
git checkout main
git pull
git tag pre-refactor                 # "yahan se wapas aa sakte ho" ka nishaan
git checkout -b refactor/integration
```

**Rollback ek line mein:**

```bash
git revert -m 1 <merge-commit-hash>  # ek poora step undo
# ya poora refactor undo:
git checkout main && git reset --hard pre-refactor   # (sirf agar abhi tak main mein merge nahi kiya)
```

---

## 6. Har step ka standard loop + 5 gates

**Loop:** zoom-out → branch banao → prompt do → agent kaam kare → **tum diff padho** → gates chalao → commit → merge.

### 5 gates (ek bhi fail = merge nahi)

| Gate | Command | Pass hone ka matlab |
|---|---|---|
| A. Tests | `npm test` | 0 failures. Number of tests **kam nahi hona chahiye** (Step 0 ka baseline: 1182 + naye) |
| B. Types | `npx tsc --noEmit` | 0 errors |
| C. Purane tests untouched | `git diff --name-status refactor/integration -- tests/` | Sirf `A` (new file) dikhe. **`M` ya `D` aaye to ruko** (sirf Step 1, 2 mein naye test files `A` honge, baaki steps mein `tests/` mein koi change ho hi nahi) |
| D. Moved code identical | `git diff --color-moved=dimmed-zebra --color-moved-ws=ignore-all-space refactor/integration` | Jo code ek file se doosri file gaya wo "moved" (dimmed) dikhna chahiye. **Chamakta hua (bold) red/green** sirf wahin hona chahiye jahan tumne jaan-boojh ke import/export badla |
| E. Smoke | Section 7 ka checklist (us step se related hissa) | Device par numbers/screens pehle jaise |

### Test-writing steps (1, 2) ke liye 6th gate — "mutation check"

Naya test sahi hai ya nahi, ye jaanne ke liye **jaan-boojh ke code todo**:
1. Test pass hone ke baad store/function mein ek chhoti galti daalo (jaise `+` ko `-`, ya ek `if` hata do).
2. `npm test` chalao. **Test fail hona chahiye.** Agar pass hua → test kuch check hi nahi kar raha, usse mazboot karo.
3. Galti hatao (`git checkout -- src/`), test dobara pass.

Ye 5 minute ka kaam hai aur sabse zyada confidence deta hai.

---

## 7. Manual smoke checklist (device par)

> Isse `docs/refactor/SMOKE_CHECKLIST.md` mein save kar lo (Step 0 mein agent bana dega). **Refactor shuru hone se pehle** ye checklist **purani (main) build** par ek baar chalao aur har screen ke **screenshots** le lo. Baad mein refactor wali build par same data ke saath same screens ke screenshots compare karo.

**Screenshots lene ki list (same account, same data):**
- Home (Daily mode), Home (Budget mode off)
- Insights: Weekly / Monthly / Yearly, har ek ka "This" aur "Previous" (offset 0 aur -1)
- Savings: top (hero), budget hub, history list (All / This Week / This Month / Deposits)
- Profile (poora scroll), Streak calendar modal
- History, Expense detail

**Functional checks:**

| # | Check | Kab zaroori |
|---|---|---|
| 1 | Fresh login → Home mein data load, koi blank/flicker nahi | Step 6, 7 |
| 2 | Expense add (online) → Home, History, Insights mein dikhe, Gullak/budget number sahi | Step 6, 7 |
| 3 | **Airplane mode ON** → 2 expense add, 1 edit, 1 delete → airplane OFF → sab sync ho jaye, koi duplicate nahi, koi gayab nahi | **Step 6 (sabse zaroori)** |
| 4 | Airplane mode mein app force-close → reopen → pending items wahi hain | Step 6 |
| 5 | Budget mode ON/OFF, cadence switch (daily → weekly → monthly), same-cadence edit | Step 7 |
| 6 | Gullak deposit (income se + external), delete deposit | Step 5, 7 |
| 7 | Din badalne ka rollover: kal ka savings notification/record sahi (device date 1 din aage karke ya agle din check) | Step 7 |
| 8 | Insights: Weekly/Monthly/Yearly **sare numbers screenshots se same**, swipe se period badalna | Step 3 |
| 9 | Profile: name edit modal, budget pause modal, logout, **delete account modal (sirf modal kholo/band karo, delete mat karo)** | Step 4 |
| 10 | Streak calendar: mahina badlo, din tap karo | Step 5 |
| 11 | Dark/light theme dono mein screens | Step 3, 4, 5 |
| 12 | Auto-logging banner/setup screen khulta hai | Har step ke baad (sanity) |
| 13 | Auto Logging: activation boundary respected; no pre-setup event is imported | Baseline + every step touching shared stores/startup |
| 14 | Auto Logging: email-only event, email-confirmed then late SMS, notification → email → late SMS; one transaction and sources merge, no re-review | Any shared store/startup change |
| 15 | Auto Logging: sign-out, pause, disable, tracked-account isolation; SQLCipher local data remains intact | Any auth/lifecycle/store change |
| 16 | Split/reimbursement: partial reimbursement linked to original share, shown as separate history item, never counted as income; own transfer neither income nor expense | Any expense/budget/insights change |
| 17 | Pull-to-History: ring progression, threshold label, below-threshold cancellation, qualified release, one haptic/navigation; bottom nav and five pills unchanged | Any HomeScreen/list/nav/gesture change |
| 18 | Notifications: no duplicate or reopened review after confirmed transaction; delayed-source “Why logged” reflects both sources | Any notification/Auto Logging change |


---

# 8. Steps

> **Har prompt ke end mein ye common "DONE REPORT" block hai.** Isse alag se yaad rakhne ki zaroorat nahi, har prompt mein already paste hai.

```text
DONE REPORT (reply in exactly this format when finished):
1. Placement guide: list files as NEW / REPLACED / DELETED (full paths).
2. Output summary lines of `npm test` and `npx tsc --noEmit`.
3. Output of `git diff --name-status -- tests/` (for refactor-only steps it must be empty).
4. Anything suspicious or buggy you NOTICED but did NOT fix (I will put it in docs/refactor/FOUND_BUGS.md).
5. A CHANGELOG.md entry under [Unreleased] -> "### Changed — Internal refactor (no user-visible change)". One short line.
Do NOT run git commit, git push, git merge, or eas update. I do those myself.
```

---

## Step 0 — Baseline + Refactor Mode setup

**Branch:** `refactor/00-baseline` (pehle `pre-refactor` tag aur `refactor/integration` banao, section 5 dekho)
**Skill:** `zoom-out`
**Code change:** **koi nahi** (sirf docs + AGENTS.md ka ek naya section)
**Time:** ~30 min

### Kyun
Refactor se pehle "sab theek tha" ka saboot chahiye. Aur tumhara `AGENTS.md` kehta hai "minimal diff, refactor mat karo". Agent ko batana padega ki ab ek alag mode hai, nahi to wo har step par rok-tok karega ya (aur bura) apni marzi se logic "improve" kar dega.

### Tum kya karoge (terminal)

```bash
git checkout main
git pull
npm ci
npm test                 # note karo: kitne files, kitne tests
npx tsc --noEmit         # 0 errors
git tag pre-refactor
git checkout -b refactor/integration
git checkout -b refactor/00-baseline
mkdir -p docs/refactor
```

Phir **purani build par** Section 7 ke screenshots le lo (ye step agent nahi kar sakta, device chahiye).

### Prompt (agent ko do)

```text
Use the zoom-out skill first to get a map of this repo.

Task: prepare the repo for a behaviour-preserving refactor. In THIS step NO file under src/ or tests/ or modules/ may change.

1. Run `npm ci`, `npm test`, `npx tsc --noEmit`. Write the exact numbers (test files, tests, duration, tsc result) into docs/refactor/BASELINE.md.

2. In docs/refactor/BASELINE.md add a "Danger list" table for these files:
   src/store/dailyBudgetStore.ts, src/store/expenseStore.ts, src/screens/InsightsScreen.tsx,
   src/screens/SavingsScreen.tsx, src/screens/ProfileScreen.tsx, src/components/StreakCalendarModal.tsx,
   src/screens/ExpenseFormScreen.tsx
   For each: total lines, the 3 longest functions/actions (name + start-end line), number of useState/useMemo/useEffect (screens), and which tests/*.test.ts import it (use grep). Do not edit anything, only report.

3. Create docs/refactor/FOUND_BUGS.md with a markdown table header: Date | File | What I noticed | How to reproduce | Status. Leave rows empty.

4. Create docs/refactor/SMOKE_CHECKLIST.md with the checklist I paste below.

5. Append the section "REFACTOR MODE" (text below) to the END of AGENTS.md. Do not modify any other part of AGENTS.md.

[PASTE the Section 7 table of this plan here]

REFACTOR MODE text to append:
---
# REFACTOR MODE (active during the refactor branches refactor/*)
When the user's prompt says "Refactor Mode", these rules OVERRIDE section 5 "Minimal diff" and "File inspection rule":
1. Behaviour must stay byte-for-byte identical: same outputs, same side effects, same order of side effects, same error handling, same AsyncStorage keys, same Supabase queries, same notifications.
2. Allowed: move code to new files, split a long function into named helpers, rename LOCAL variables only, add types where tsc proves it is safe, add NEW test files.
3. Forbidden: changing logic, fixing bugs, "improving" conditions, reordering awaits, changing dependency arrays of useEffect/useMemo/useCallback, changing default values, changing exported names or import paths, adding dependencies, touching modules/arthik-autolog, schema.sql, supabase/, versionCheck.ts, UpdateRequiredScreen.tsx.
4. Public API stays: every export that existed before must still be importable from the SAME path (re-export from the old file).
5. Existing tests must NOT be edited. Only new test files may be added. If an existing test fails, STOP and report; do not "fix" the test.
6. If you notice a bug, do NOT fix it. Report it in the DONE REPORT.
7. For moves, copy code VERBATIM, including comments (P0.x tags, ponytail notes etc.).
8. Never create circular imports. Helpers extracted from a store must receive `get`/`set`/data as parameters instead of importing the store.
---

DONE REPORT (reply in exactly this format when finished):
1. Placement guide: list files as NEW / REPLACED / DELETED (full paths).
2. Output summary lines of `npm test` and `npx tsc --noEmit`.
3. Output of `git diff --name-status -- tests/` (must be empty).
4. Anything suspicious you noticed but did NOT fix.
5. CHANGELOG.md: no entry needed for this step (docs only).
Do NOT run git commit, git push, git merge, or eas update.
```

### Done kab
- `npm test` → exact Step 0 baseline plus intentional new tests, 0 failures; `tsc` 0 errors
- `docs/refactor/` mein 3 files, `AGENTS.md` mein naya section
- Tumne screenshots le liye

```bash
git add -A && git commit -m "docs(refactor): baseline, smoke checklist, refactor mode rules"
git checkout refactor/integration && git merge --no-ff refactor/00-baseline
```

---

## Step 1 — Safety net: `syncPendingExpenses`

**Branch:** `refactor/01-safety-net-expense-sync`
**Skill:** `tdd` (red → green, test public interface se, internals se nahi)
**Code change:** **sirf new test files if coverage audit finds gaps**. `src/` mein ek line nahi badlegi
**New file:** `tests/expenseSyncPending.test.ts`
**Time:** 2–4 ghante

### Kyun (derivation)
`syncPendingExpenses` (`src/store/expenseStore.ts`, lines ~337–718) offline queue ko server tak pahunchata hai. Isme 8 alag kaam ek ke baad ek hote hain. Isko todne se pehle agar test nahi hai to koi bhi galat cut-paste **chup-chaap user ka expense gayab** kar sakta hai, aur app crash bhi nahi karegi. Isliye pehle ye likhna hai ki "abhi ye function **exactly kya karta hai**", chahe kuch "ajeeb" lage. Ise **characterization test** kehte hain.

### Function ka map (agent ko ye batana zaroori hai)

| Phase | Lines (approx) | Kya karta hai | Queue key (AsyncStorage) |
|---|---|---|---|
| 1. Pending **deletes** | 347–440 | Har item pe backoff check (P0.7), Supabase delete, success pe queue se hatao, fail pe retry count badhao | `@arthik_pending_deletes_<uid>` |
| 2. Pending **adds** | 441–568 | Fake category id (`'1'..'7'`) check (455), `upsert` with `onConflict:'id', ignoreDuplicates:true` (485), success pe pending flag hatao | `@arthik_pending_expenses_<uid>` |
| 3. Pending **updates** | 569–664 | Har update Supabase pe, fail pe retry/failed-sync | `@arthik_pending_updates_<uid>` |
| 4. Budget **settings** flush | 665–681 | `pending_settings` profile patch | `@arthik_pending_settings_<uid>` |
| 5. Daily savings records | ~682 | `uploadPendingDailyRecords` | (dailyBudgetStore) |
| 6. Gullak deposits | 685–689 | `syncPendingGullakDeposits` | (dailyBudgetStore) |
| 7. Categories | 690–694 | `syncPendingCategories` | (categoryStore) |
| 8. Profile patch | 695–706 | name/avatar patch | profile pending key |
| 9. Cache | 707–710 | confirmed expenses cache | `@arthik_cached_expenses_<uid>` |

Aur 3 jagah **P0.12 "concurrency-safe"** logic hai (lines ~426, ~560, ~656): save karne se pehle queue **dobara padhna**, taaki sync ke dauran naya add hua item na kho jaye. **Ye sabse nazuk hissa hai. Iska test zaroor hona chahiye.**

### Prompt

```text
Use the tdd skill. Refactor Mode is NOT active in this step; this step ONLY adds a new test file. Do not modify anything under src/.

Goal: first audit current coverage for `syncPendingExpenses` in src/store/expenseStore.ts. The tests must describe what the function does TODAY, even if the behaviour looks odd. Do not fix anything. If existing tests already cover a case, document that instead of duplicating it; only add missing cases.

Proposed new file only if the audit shows a real gap: tests/expenseSyncPending.test.ts
Follow the mocking style of tests/expenseStore.test.ts and tests/dailyBudgetStore.test.ts:
 - in-memory AsyncStorage mock (Map), expo-crypto mock, '../src/config/supabase' mock, mock react-native if needed.
 - Mock the other stores the function touches (useDailyBudgetStore.getState().syncPendingGullakDeposits / uploadPendingDailyRecords, useCategoryStore.getState().syncPendingCategories, useAuthStore, useNetworkStore) with vi.fn so I can assert call ORDER.
 - Use tests/helpers/fakeStore.ts if it helps.
First read ONLY syncPendingExpenses and the helpers it calls (getBackoffDelay, saveFailedSyncItem, savePendingUpdateOffline, savePendingDeleteOffline, updatePendingItemOffline, removePendingItemOffline, isValidUUID, isNetworkFailure). Derive exact queue key names and payload shapes from the code, do not guess.

Test cases (each its own `it`):
 A. Order: with items in every queue, assert the order of side effects: deletes -> adds -> updates -> settings flush -> daily records upload -> gullak deposits -> category sync -> profile patch -> cache write.
 B. Deletes: success removes item from queue; server error keeps item and increments its retry/backoff metadata; item inside backoff window is skipped (use vi.useFakeTimers / setSystemTime).
 C. Adds: successful upsert is called with onConflict 'id' and ignoreDuplicates true; pending flag removed from state; item with fake category id ('1'..'7') is handled exactly as the code does today (assert the actual behaviour).
 D. Adds: network failure (isNetworkFailure true) keeps the item queued and does NOT move it to failed-sync; non-network error behaves as the code does (assert it).
 E. Updates: success clears update from queue; failure keeps it.
 F. P0.12 concurrency: while an add is "in flight" (make the supabase mock await a promise), push a NEW item into the same AsyncStorage queue key, then resolve. Assert the new item is still in the queue afterwards (this is the "re-read before save" guarantee). Do this for deletes, adds and updates separately.
 G. Empty queues: function completes, makes no supabase calls except what the code still does today.
 H. Offline (useNetworkStore isOffline true or no user): function exits early the same way the code does today.
 I. Failure isolation: if gullak/category/profile step throws, later steps still run (the code has .catch() on those). Assert exactly what happens today.
 J. Final state snapshot: after a mixed scenario (2 deletes, 3 adds, 2 updates) use toMatchInlineSnapshot on { expenses state, remaining queue contents }.

Rules:
 - Use public interface: useExpenseStore.getState().syncPendingExpenses() and AsyncStorage contents. Do not test private helpers directly.
 - Reset storageMap and store state in beforeEach.
 - After tests pass, do the MUTATION CHECK for at least 4 places: (1) remove the re-read in one P0.12 block, (2) change a `+` to `-` in backoff, (3) swap order of two phases, (4) delete the `ignoreDuplicates` option. For each, show me the test that fails, then revert with `git checkout -- src/`. Confirm `git status` shows only the new test file.

DONE REPORT (reply in exactly this format when finished):
1. Placement guide: NEW tests/expenseSyncPending.test.ts (and any NEW helper under tests/helpers).
2. Output summary lines of `npm test` and `npx tsc --noEmit`.
3. Output of `git status --short` (must show only new test files).
4. List of the 4 mutation checks and which test caught each.
5. Anything suspicious or buggy you NOTICED but did NOT fix.
6. CHANGELOG.md: no entry needed (tests only).
Do NOT run git commit, git push, git merge, or eas update.
```

### Done kab
- Naya test file 12–20 tests ke saath, sab pass
- 4 mutation checks mein test fail hua
- `git diff --name-status refactor/integration` → sirf `A tests/expenseSyncPending.test.ts`

---

## Step 2 — Safety net: daily budget store ke bade actions

**Branch:** `refactor/02-safety-net-budget-store`
**Skill:** `tdd`
**Code change:** sirf naye test files
**New files:** `tests/dailyBudgetHydrate.test.ts`, `tests/dailyBudgetRollover.test.ts` (aur agar `syncWithExpenses` ka gap mile to `tests/dailyBudgetSyncWithExpenses.test.ts`)
**Time:** 3–5 ghante

### Kyun
`tests/dailyBudgetStore.test.ts` (566 lines) aur `budgetModesStore.test.ts` (636 lines) pehle se hain, lekin 572-line `hydrateFromSupabase` aur 299-line `checkAndRollover` ke har branch ko cover karte hain ya nahi, ye **pehle audit** karna hai. Jo missing ho wahi likhna hai, duplicate nahi.

### `hydrateFromSupabase` ka map (lines ~1849–2421)

| Hissa | Lines | Kya hota hai |
|---|---|---|
| P0.1 persist wait | 1852–1863 | Zustand persist hydrate na hua ho to `Promise.race` (500ms timeout) |
| P0.2 owner change | 1865–1871 | Owner badla to `resetDailyBudget()` |
| Pending settings read | 1878–1881 | `getPendingSettingsKey(userId)` se AsyncStorage |
| **Offline fast-path** | 1883–1965 | 6 fields (daily_budget, is_auto_renew, is_budget_mode_enabled, budget_cadence, weekly_budget, monthly_budget) pending settings se override; aaj ka record na ho to banana (1912), Pure mode (budget off) branch (1937); `return` |
| **Remote fetch** | 1967–2000 | 4 queries parallel (`profiles`, `daily_savings_log`, `budget_plan_changes`, `budget_periods`), **3500ms timeout** par `{data:null}` ×4 |
| Pending plan changes merge | 2088–2118 | `pendingChangesKey` |
| Pending periods merge | 2119–2130 | `pendingPeriodsKey` |
| **Self-healing: default 500** | 2131–2230 | Agar resolved budget 500 (migration default) ho to historic logs/expenses se original budget dhoondhna |
| **Self-heal corrupted row** | 2231–2281 | 3 steps: true day budget, recalc saved/status, Supabase row ko `daily_savings_log` mein fix |
| Aaj ka record ensure | 2282–2318 | (1912–1965 wale block jaisa) |
| Gullak deposits merge | 2319–2375 | Supabase + local pending adds; kuch local deposit kho na jaye |
| Metrics + `set` | 2376–2408 | `computeMetrics(...)` phir `set({...})` |
| Ending | 2409–2415 | `checkAndRollover(currentExpenses, true)` aur `uploadPendingDailyRecords()` |

### `checkAndRollover` ka map (lines ~1450–1749)

| Hissa | Lines | Kya |
|---|---|---|
| Guard | 1452 | Hydrate hone se pehle nahi chalega |
| Scheduled next-day budget apply | 1461–1475 | |
| Spent by date (single pass) | 1476–1480 | non-income expenses |
| Past dates collect (gap-fill rules) | 1481–1502 | **Sirf unhi din ke liye jinke record ya real expense hain.** Phantom days nahi banane |
| Daily loop | 1503–1654 | Sirf `daily` cadence ke din; account-creation se pehle ke din skip (1515); untracked day preserve (1533); record ka budget lock (1538); pehli baar finalize + auto-renew (1545); 0 budget skip (1551); Supabase sync fire-and-forget + offline `needsUpload` (1589–1634); kal ka savings notification (1637) |
| Multi-cadence periods | 1655–1725 | weekly/monthly finalize, `budget_periods` sync + offline queue, rollover notification |
| Metrics | 1726–1748 | |

### Prompt

```text
Use the tdd skill. This step ONLY adds new test files. Do not modify anything under src/ and do not edit existing tests.

Goal: audit existing coverage first, then close only verified gaps around three actions in src/store/dailyBudgetStore.ts: `hydrateFromSupabase` (~lines 1849-2421), `checkAndRollover` (~1450-1749), `syncWithExpenses` (~1300-1449).

PHASE A - AUDIT (no code yet):
 1. Read tests/dailyBudgetStore.test.ts, tests/budgetModesStore.test.ts, tests/offlineStartup.test.ts, tests/financialCorrectnessMatrix.test.ts, tests/gullakReconciliationHardCap.test.ts, tests/realTimeIncomeGullakDeduction.test.ts, and tests/sharesReimbursementsTransfers.test.ts (only describe/it titles + setup blocks). Do not duplicate coverage already supplied by these tests.
 2. Write docs/refactor/COVERAGE_GAPS.md: a table with every branch below and whether an existing test already covers it (file + test title) or not.
 Branches for hydrateFromSupabase: persist-wait timeout; owner change reset; offline fast-path for EACH of the 6 pending-settings fields; offline fast-path creates today's record when missing; offline Pure-mode (budget off, not finalized) branch; remote 3500ms timeout fallback; pending plan changes merge; pending periods merge; self-heal when resolved budget is 500; self-heal corrupted daily_savings_log row (all 3 sub-steps); today's-record ensure (online); gullak deposits merge incl. local pending adds not lost; final calls checkAndRollover(currentExpenses, true) and uploadPendingDailyRecords.
 Branches for checkAndRollover: hydration guard; scheduled next-day budget applied; gap-fill only for days with record or real expense; no phantom days; days owned by weekly/monthly/paused skipped by daily loop; date before account creation skipped; untracked day preserved; budget locked from existing record; first-time finalize with auto-renew and budget>0; zero budget + zero spent skipped; Supabase upload failure leaves needsUpload true; yesterday-savings notification; weekly period finalize; monthly period finalize; period upload offline queue.
 Branches for syncWithExpenses: today's spent/income/reimbursement recompute; record creation when missing; edit/delete of a past expense updating a finalized day.
 STOP after writing COVERAGE_GAPS.md and show it to me. Wait for my "go" before Phase B.

PHASE B - WRITE TESTS (after my go):
 - New files: tests/dailyBudgetHydrate.test.ts, tests/dailyBudgetRollover.test.ts, tests/dailyBudgetSyncWithExpenses.test.ts (only for gaps).
 - Reuse the mock setup style from tests/dailyBudgetStore.test.ts (AsyncStorage Map, expo-crypto, supabase query-builder mock, react-native mock).
 - Control time with vi.useFakeTimers + vi.setSystemTime so "today" is fixed (e.g. 2026-03-15) and results are deterministic. Use date-fns formats like the code (yyyy-MM-dd).
 - Use the public interface only: useDailyBudgetStore.getState().<action>(...) and read state with getState().
 - For big outputs (final dailyRecords + totals after a multi-day scenario) use toMatchInlineSnapshot so any silent change shows up.
 - Test each gap from COVERAGE_GAPS.md. Do NOT duplicate tests that already exist.
 - MUTATION CHECK for 6 places (one in hydrate offline path, one in self-heal 500, one in gullak merge, one in daily loop gap-fill, one in period finalize, one in the zero-budget skip). Show the failing test for each, then `git checkout -- src/`.

DONE REPORT (reply in exactly this format when finished):
1. Placement guide: NEW test files and docs/refactor/COVERAGE_GAPS.md.
2. Output summary lines of `npm test` and `npx tsc --noEmit`.
3. Output of `git status --short` (only new files).
4. The 6 mutation checks and which test caught each.
5. Anything suspicious or buggy you NOTICED but did NOT fix.
6. CHANGELOG.md: no entry needed (tests only).
Do NOT run git commit, git push, git merge, or eas update.
```

### Done kab
- `COVERAGE_GAPS.md` mein har branch ke saamne test ka naam
- Mutation check mein 6/6 pakde gaye
- Gates A–C pass

---

## Step 3 — `InsightsScreen` split

**Branch:** `refactor/03-insights-split`
**Skill:** `zoom-out` pehle; baaki step mein koi skill nahi (ye cut-paste hai)
**Risk:** Low (screen sirf data dikhati hai, paisa nahi likhti)
**Time:** 3–5 ghante
**4 sub-steps, har ek ka alag commit.** Har sub-step ke baad Gate A–D.

### Kyun (derivation)
`InsightsScreen.tsx` mein ek hi component **1707 lines** ka hai (326–2033). Usme 54 `useMemo` hain jo weekly/monthly/yearly ke numbers nikalte hain. Problem: (1) ek jagah badlao karo to pata nahi kaun sa tab toot gaya, (2) ye calculations screen ke andar hain, isliye tests nahi ho sakte (tests node mein chalte hain, screen render nahi hoti). **Hal:** calculations ko ek hook mein nikalo. Hook ko tum `tests/helpers/hookRuntime.ts` se test kar sakte ho (jaise `useSavingsDashboard` ka test already hai).

### Naye files (sab `src/screens/insights/` mein; `InsightsScreen.tsx` apni jagah rahegi taaki navigation import na toote)

| New file | Kya jayega (verbatim) | Source lines |
|---|---|---|
| `periodUtils.ts` | `buildInterval`, `buildDateLabel`, `computeMinOffset`, `CHART_COLORS`, `MAX_NAV_DOTS`, aur `Period` type | ~94–170 |
| `PeriodNavigator.tsx` | `PeriodNavigator` component + `PeriodNavigatorProps` + `navStyles` | ~173–325 |
| `InsightsScreen.styles.ts` | `styles` (`StyleSheet.create`) | ~1850–2033 |
| `useInsightsData.ts` | Saare **pure derived** `useMemo`: `earliestExpenseDate`, `minOff`, `sortedCategories`, `monthlyCashFlowData`, `yearlyGullakMetrics`, weekly/monthly/yearly comparisons, `heroTrend`, `effectiveBudgetResult`, `budgetHealth`, `activeBudgetPool`, pace values, takeaways, yearly values | ~396–1198 (**minus** neeche wali "screen mein hi rahenge" list) |

**Screen mein hi rahenge (UI/layout se jude):** `panResponder` (453–497), `donutSize`/`donutStroke` (610–622, `useWindowDimensions` use karte hain), `handleScroll`, `useIsFocused`, `useFocusEffect`, `loadData`, `onRefresh`, `handlePeriodChange`, `handleCategoryPress`, saare `useState` (period, offset, selectedCategoryId, focusTime, refreshing, showAllCategories), animation values.
Rule: **jo `useWindowDimensions`, insets, `Animated`, navigation, ya `set...` (state setter) chhuta hai wo screen mein. Baaki sab hook mein.**

### Sub-step 3a — period helpers + `PeriodNavigator`

```text
Refactor Mode. Use the zoom-out skill first on src/screens/InsightsScreen.tsx (read only the top 330 lines).

Task 3a: move these things OUT of src/screens/InsightsScreen.tsx into new files, VERBATIM:
 1. src/screens/insights/periodUtils.ts : the `Period` type (wherever declared in the file), CHART_COLORS, MAX_NAV_DOTS, and the functions buildInterval, buildDateLabel, computeMinOffset (currently ~lines 94-170). Export them.
 2. src/screens/insights/PeriodNavigator.tsx : the PeriodNavigator component, its props interface, and `navStyles` (currently ~lines 173-325). It should import what it needs from periodUtils.ts and the same packages the original used.
Then in InsightsScreen.tsx replace the removed code with imports. Nothing else changes: same names, same JSX, same logic, same comments.
InsightsScreen must still export `InsightsScreen` from the same path, and every other file that imports anything from InsightsScreen.tsx must keep working (grep first for imports of this file, e.g. navigation/index.tsx and tests/*).
Check that no existing test imports a symbol that moved; if one does, re-export it from InsightsScreen.tsx.

Run `npm test` and `npx tsc --noEmit`.
Then run: git diff --color-moved=dimmed-zebra --color-moved-ws=ignore-all-space --stat
and tell me which hunks are NOT pure moves.

DONE REPORT (reply in exactly this format when finished):
1. Placement guide: NEW / REPLACED / DELETED.
2. Output summary lines of `npm test` and `npx tsc --noEmit`.
3. `git diff --name-status -- tests/` (must be empty).
4. Anything suspicious you NOTICED but did NOT fix.
5. CHANGELOG.md entry under [Unreleased] -> "### Changed — Internal refactor (no user-visible change)". One short line.
Do NOT run git commit, git push, git merge, or eas update.
```

Commit: `git commit -am "refactor(03a): extract insights period utils and PeriodNavigator"`

### Sub-step 3b — styles alag file

```text
Refactor Mode.
Task 3b: move the main `styles = StyleSheet.create({...})` block at the bottom of src/screens/InsightsScreen.tsx (starts ~line 1850 before 3a, shifts after) into src/screens/insights/InsightsScreen.styles.ts as `export const styles = StyleSheet.create({...})`, VERBATIM. In InsightsScreen.tsx import { styles } from './insights/InsightsScreen.styles'. Make sure no style key is renamed, reordered, or removed, and that StyleSheet import is still used or removed only if now unused (tsc will tell).
If PeriodNavigator.tsx or another new file needs `styles`, do NOT share it; each file keeps its own style block.
Run npm test and npx tsc --noEmit. Verify with the git diff --color-moved command from 3a.

DONE REPORT: (same format as 3a)
```

Commit: `git commit -am "refactor(03b): move InsightsScreen styles to its own file"`

### Sub-step 3c — `useInsightsData` hook (sabse zaroori)

```text
Refactor Mode. Use the zoom-out skill first on the body of the InsightsScreen component (from the `export const InsightsScreen` line to the `return (` of the JSX, ~lines 326-1212 before earlier splits).

Task 3c: create src/screens/insights/useInsightsData.ts exporting `useInsightsData(params)` and move into it, VERBATIM and IN THE SAME ORDER, every useMemo that is a pure derivation of data. That is: earliestExpenseDate, minOff, sortedCategories, monthlyCashFlowData, yearlyGullakMetrics, legendSegments/sideCategories/bottomCategories ONLY IF they do not depend on layout values, weeklyDayMatchedComp, monthlyComp, yearlyActiveDays, yearlyDailyBurn, yearlyComparison, heroTrend, effectiveBudgetResult, budgetHealth, elapsedDaysInWeek, elapsedDaysInMonth, monthlyRemainingDays, monthlyEffectiveBudget, monthlyBudgetHealth, currentPeriodIncome, activeBudgetPool, safeDailyPace, monthlySafeDailyPace, weeklyGullak, weekTransactionCount, smartTakeaway, largestOutflow, weekdayWeekendDynamics, peakDaysSubtitle, monthlyDailyBurnPace, monthlyGullakSavings, monthlyLargestOutflow, monthlyCategoryShift, monthlyPeakWeek, monthTransactionCount, smartMonthlyTakeaway, yearlyInflow, yearlyNetCashFlow, yearlySavingsRate, yearlyCashFlowData, smartYearlyTakeaway, annualBudgetDiscipline, yearlyCapitalOutlier, yearlyCategoryTrajectory, yearTransactionCount, gullakDepositsInYearCount.

Rules:
 - Anything that uses useWindowDimensions, useSafeAreaInsets, Animated, PanResponder, navigation hooks, or a state setter STAYS in the screen (panResponder, donutSize, donutStroke, handleScroll, loadData, onRefresh, handlePeriodChange, handleCategoryPress, all useState).
 - If a moved memo depends on a value that stays in the screen (e.g. donutSize), then do NOT move that memo; leave it in the screen and tell me.
 - The hook's params are exactly the inputs those memos read: period, offset, expenses, categories, dailyRecords, gullakDeposits, isBudgetModeEnabled, budgetPeriods, budgetCadence, dailyBudgetAmount, weeklyBudgetAmount, monthlyBudgetAmount, totalAccumulatedSavings, selectedCategoryId, focusTime, user (add or remove ONLY what tsc demands). Define a `UseInsightsDataParams` interface.
 - Hook returns an object with every value the JSX or the remaining screen code uses. Define the return type via `ReturnType` or an explicit interface.
 - Copy each useMemo body and its dependency array EXACTLY. Do not "fix" exhaustive-deps. Keep comments.
 - Keep the same relative order of the useMemo calls (some depend on earlier ones).
 - In the screen: `const { ... } = useInsightsData({ ... });` placed where the first moved memo used to be.
Run npm test and npx tsc --noEmit. Then run the git diff --color-moved check and list any hunk that is not a pure move.

THEN add tests/useInsightsData.test.ts (new file) using tests/helpers/hookRuntime.ts (renderHook) and the same mocking approach as tests/useSavingsDashboard.test.ts:
 - fixture: ~40 expenses across 3 months with 5 categories (income + expense + a reimbursement + a self-transfer), dailyRecords for each day, 2 gullak deposits (one 'income', one 'external'), budget mode on, daily cadence.
 - for period 'Weekly', 'Monthly', 'Yearly' with offset 0 and -1: call the hook and assert toMatchInlineSnapshot on the returned object (use a helper to JSON-normalise Dates).
 - one more fixture with budget mode OFF and one with weekly cadence + budgetPeriods.
This snapshot is the new safety net for FUTURE changes, so it must cover all three periods.

DONE REPORT: (same format as 3a; also include "values that stayed in the screen and why")
```

Commit: `git commit -am "refactor(03c): extract useInsightsData hook and add its snapshot tests"`

> **Yaad rakho:** 3c ka test **move ke baad** likha ja raha hai, isliye wo "pehle jaisa hi hai" saabit nahi karta. Saabit ye karte hain: (1) `--color-moved` diff (code verbatim hai), (2) `tsc` (har variable resolve hota hai), (3) **screenshots before/after same** (Section 7). Ye teeno zaroor karo. Test future ke liye hai.

### Sub-step 3d (optional, baad mein) — JSX ke sections

Weekly (`period === 'Weekly'` block ~1358), Monthly (~1388), Yearly (~1418) ke blocks ko `WeeklySection.tsx`, `MonthlySection.tsx`, `YearlySection.tsx` mein todo. Sirf tab karo jab 3a–3c ke baad bhi file bhaari lage. Pattern same: verbatim JSX, props se data, `styles` import.

### Step 3 done kab
- Gates A–D pass, 3a/3b/3c alag commits
- `InsightsScreen.tsx` ~1000 lines ya kam (UI + animations + JSX)
- Screenshots (Weekly/Monthly/Yearly, This + Previous, dark + light) **pehle jaise**

```bash
git checkout refactor/integration && git merge --no-ff refactor/03-insights-split
```

---

## Step 4 — `ProfileScreen` split

**Branch:** `refactor/04-profile-split`
**Skill:** koi nahi (cut-paste)
**Risk:** Low–Medium (logout / delete account yahin hai, isliye handlers **screen mein hi rahenge**)
**Time:** 2–3 ghante

### Kyun (derivation)
`ProfileScreen.tsx` mein 12 `useState` aur 3 `Modal` (pause budget, edit profile, delete account) ek hi file mein hain, aur styles 310 lines ke hain. Problem: modal ka JSX 60–100 lines ka hai, bich-bich mein handlers aur state ghule-mile hain, to koi ek modal badalne par poori screen padhni padti hai.

**Sabse badi galti jo yahan ho sakti hai:** modal ka `useState` modal component ke andar le jaana. Isse state ka lifecycle badal jata hai (jaise `deleteEmailInput` ab modal band hone par reset ho sakta hai ya nahi). Isliye **state screen mein hi rahegi**, modals sirf "dikhane wale" components banenge (props se sab milega). Behaviour bilkul same.

### Naye files

| New file | Source (approx lines) | Props jo lenge |
|---|---|---|
| `src/components/profile/PauseBudgetModal.tsx` | `<Modal visible={pauseModalVisible}>` 326–387 | `visible`, `onClose` + jo handlers/values JSX use karta hai |
| `src/components/profile/EditProfileModal.tsx` | `<Modal visible={editVisible}>` 390–424 | `visible`, `onClose`, `firstName`, `lastName`, `onChangeFirst`, `onChangeLast`, `saving`, `onSave` |
| `src/components/profile/DeleteAccountModal.tsx` | `<Modal visible={deleteModalVisible}>` 427–530 | `visible`, `onClose`, `emailInput`, `onChangeEmail`, `isDeleting`, `onConfirm`, ... |
| `src/screens/ProfileScreen.styles.ts` | `styles` 877–1187 | (sab styles) |

(Exact props `tsc` batayega. Props ki list tum final mat maano, agent ko jo JSX chhuta hai wahi props banana hai.)

### Prompt

```text
Refactor Mode. Read only src/screens/ProfileScreen.tsx.

Task: split the three <Modal> blocks and the styles out of ProfileScreen.tsx. ALL state (`useState`), ALL handlers (handleLogout, handleDeleteAccount, handleConfirmEmailForDelete, handleSaveProfile, handleToggleBudgetMode, handleToggleAppLock, handleToggleNotifications) and ALL effects STAY in ProfileScreen. Do not move any state into the new components.

Create (VERBATIM JSX, same props on <Modal>, same inline styles, same comments):
 1. src/components/profile/PauseBudgetModal.tsx  <- the Modal whose visible={pauseModalVisible} (currently ~lines 326-387)
 2. src/components/profile/EditProfileModal.tsx  <- the Modal whose visible={editVisible} (~390-424)
 3. src/components/profile/DeleteAccountModal.tsx <- the Modal whose visible={deleteModalVisible} (~427-530)
 4. src/screens/ProfileScreen.styles.ts exporting `styles` <- the StyleSheet.create block at the bottom (~877-1187), VERBATIM.
Each new modal component is a plain function component that receives everything it needs as props (values, setters/handlers, colors/isDark theme values, styles). The parent keeps rendering them ALWAYS (never conditionally mount them), exactly like the Modal is always rendered today, so mount/unmount behaviour is unchanged.
Props: name them after the original variable names where possible. Let `npx tsc --noEmit` tell you which props are missing.
If a modal needs more than 15 props, STOP and tell me instead of continuing.
ProfileScreen must still export `ProfileScreen` from the same path.

Run npm test and npx tsc --noEmit. Run `git diff --color-moved=dimmed-zebra --color-moved-ws=ignore-all-space --stat` and list hunks that are not pure moves.

DONE REPORT (reply in exactly this format when finished):
1. Placement guide: NEW / REPLACED / DELETED.
2. Output summary lines of `npm test` and `npx tsc --noEmit`.
3. `git diff --name-status -- tests/` (must be empty).
4. Anything suspicious you NOTICED but did NOT fix.
5. CHANGELOG.md entry under [Unreleased] -> "### Changed — Internal refactor (no user-visible change)". One short line.
Do NOT run git commit, git push, git merge, or eas update.
```

### Done kab
- Gates A–D, `ProfileScreen.tsx` ~600 lines
- Smoke #9 (Profile modals) + #11 (dark/light) + screenshots same
- **Delete account modal sirf kholo/band karo, confirm mat dabana**

```bash
git add -A && git commit -m "refactor(04): split ProfileScreen modals and styles"
git checkout refactor/integration && git merge --no-ff refactor/04-profile-split
```

---

## Step 5 — `SavingsScreen` + `StreakCalendarModal`

**Branch:** `refactor/05-savings-streak-split`
**Skill:** `tdd` sirf 5c ke liye (chhota pure function test)
**Risk:** Low–Medium
**Time:** 3–4 ghante
**3 sub-steps, alag commit.**

### Kyun
`SavingsScreen.tsx` (1453 lines) ka logic pehle se `useSavingsDashboard` hook mein hai aur tested hai. Problem sirf JSX ka size hai: ek hi `return` mein 4 bade sections, "Budget Hub" akela 380 lines. `StreakCalendarModal.tsx` (901 lines) mein ek jagah raw Supabase rows ko screen ke format mein badalne ka logic UI ke andar dabaa hua hai.

### 5a — `SavingsScreen` styles + sections

| New file | Source (approx lines) |
|---|---|
| `src/screens/SavingsScreen.styles.ts` | `styles` 1021–1453 |
| `src/components/savings/SavingsHeader.tsx` | `{/* ── Header ── */}` 365–397 |
| `src/components/savings/SavingsHeroCard.tsx` | `{/* ── Hero Card: Total Accumulated Savings ── */}` 398–537 |
| `src/components/savings/BudgetHubSection.tsx` | `{/* ── Unified Daily Allowance & Budget Mode Hub ── */}` 538–915 |
| `src/components/savings/SavingsHistorySection.tsx` | `{/* ── Day-by-Day Savings History ── */}` 916–990 (filter toggle + past records list) |

`Modals` (991–1020: Edit Budget, Streak Calendar, Deposit Gullak, Money Explainer) **screen mein hi rahenge** (unka visible-state screen ke paas hai).
`handleDeleteDeposit` (118), `handleCancelScheduled` (283) screen mein, props se pass honge.

```text
Refactor Mode. Read src/screens/SavingsScreen.tsx and src/hooks/useSavingsDashboard.ts (signature only).

Task 5a: split SavingsScreen.tsx.
 1. Move the `styles = StyleSheet.create({...})` block (~line 1021 to end) to src/screens/SavingsScreen.styles.ts as `export const styles`, VERBATIM.
 2. Move these JSX sections into presentational components under src/components/savings/, VERBATIM JSX:
    - SavingsHeader.tsx             <- section marked "Header" (~365-397)
    - SavingsHeroCard.tsx           <- "Hero Card: Total Accumulated Savings" (~398-537)
    - BudgetHubSection.tsx          <- "Unified Daily Allowance & Budget Mode Hub" (~538-915)
    - SavingsHistorySection.tsx     <- "Day-by-Day Savings History" incl. the segmented filter and past records list (~916-990)
    Props: pass the whole `dashboard` object returned by useSavingsDashboard (or the exact fields used), plus the local state values/setters and handlers the JSX uses. Name props after the original variables.
 3. The four modals at the end (Edit Budget, Streak Calendar, Deposit to Gullak, Money Explainer), all useState, all handlers (handleDeleteDeposit, handleCancelScheduled etc.) and the data hooks STAY in SavingsScreen.
 4. Do not change any JSX, className/style, conditional, key, or prop value. Do not change memo/callback dependency arrays.
 5. If any single new component needs more than 20 props, do NOT force it: instead split ONLY the styles for now and tell me which section is too entangled.
SavingsScreen must still export `SavingsScreen` from the same path.

Run npm test and npx tsc --noEmit. Run the git diff --color-moved check and list non-move hunks.

DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(05a): split SavingsScreen sections and styles"`

### 5b — `StreakCalendarModal` styles

```text
Refactor Mode.
Task 5b: move the StyleSheet.create block (~line 706 to end) of src/components/StreakCalendarModal.tsx to src/components/StreakCalendarModal.styles.ts as `export const styles`, VERBATIM. Nothing else changes. Same for src/components/DepositGullakModal.tsx (styles at ~line 706 to end -> DepositGullakModal.styles.ts). Run npm test and tsc.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(05b): move modal styles to own files"`

### 5c — `StreakCalendarModal`: raw rows → DayLogData ka pure function

Is modal ke andar (~lines 211–260) Supabase se aaye rows ko `DayLogData` mein badalne ka code hai (`status === 'unknown'` → `unknown`; `status === 'saved' && amount_saved > 0` → `saved`; warna `missed`). Ye pure logic hai, test ho sakta hai.

> **Note (ADR-0003):** is modal mein `supabase` seedha import hai (line 19), jo ADR ke khilaf hai. Isko abhi **mat chhedo**: network call ko store mein le jaana "behaviour change" ka risk hai. Sirf **mapping** nikalo. Baad mein agar chaho to alag branch mein.

```text
Use the tdd skill for the new test. Refactor Mode for the move.

Task 5c: in src/components/StreakCalendarModal.tsx find where rows returned by supabase `daily_savings_log` (select 'date, amount_saved, status') are converted into `remoteMap: Record<string, DayLogData>` (~lines 211-260).
 1. Create src/lib/streakCalendarData.ts exporting `mapRemoteRowsToDayLog(rows)` that contains EXACTLY that conversion logic (unknown -> {status:'unknown', amount:0}; saved only if status==='saved' && Number(amount_saved) > 0; otherwise 'missed'; amount = Number(amount_saved) || 0). Move the `DayLogData` type there only if it is not exported already; otherwise import it.
 2. In the modal replace the inline conversion with a call to this function. KEEP the supabase query, error handling, loading state, cache handling and merge-with-local logic exactly where they are.
 3. Add tests/streakCalendarData.test.ts (new): unknown row, saved with amount, saved with 0 amount -> missed, missed row, null/undefined/NaN amount, empty array.
 4. Mutation check: flip `> 0` to `>= 0`, confirm a test fails, revert.
Run npm test and npx tsc --noEmit.

DONE REPORT (same format as Step 4; item 3 may show only the new test file as A).
```

Commit: `git commit -am "refactor(05c): extract streak calendar row mapping with tests"`

### Step 5 done kab
- Gates A–D
- `SavingsScreen.tsx` ~400–500 lines
- Smoke #6 (Gullak deposit/delete), #10 (Streak calendar), #11, Savings screenshots same

```bash
git checkout refactor/integration && git merge --no-ff refactor/05-savings-streak-split
```

---

## Step 6 — `expenseStore` split

**Branch:** `refactor/06-expense-store-split`
**Skills:** Phase A: `improve-codebase-architecture` + `grill-me`. Phase B: koi nahi (Step 1 ke tests ab tumhari safety net hain)
**Risk:** **High.** Offline sync yahin hai
**Time:** 1 din
**Pehle shart:** Step 1 merged aur uske tests green

### Kyun (derivation)
`expenseStore.ts` mein sab kuch ek hi file mein: types, AsyncStorage key getters, retry/backoff, queue helpers, 8 phase wala sync, fetch, add, update, delete. `syncPendingExpenses` akela 380 lines. Ek sync bug theek karne ke liye 1192 lines padhni padti hain.

**Do cheezein dhyaan se (iske upar ADR-0003 aur ADR-0005 likhe hain):**
1. Stores ek doosre ko circular import nahi kar sakte. `expenseStore` ne `dailyBudgetStore`, `categoryStore`, `networkStore`, `authStore` import kiye hain. Naye helper files mein **store khud import mat karo**. `get`/`set` parameter mein lo. Types ke liye `import type { Expense } from '../expenseStore'` use karo (runtime par import nahi banta, cycle nahi banta).
2. Bahar ki files jo `expenseStore` se `isValidUUID`, `UUID_REGEX`, `getPendingSyncCount`, `registerExpenseGetter` jaisi cheezein import karti hain unhe **kuch nahi badalna chahiye**. `expenseStore.ts` se **re-export** karo.

### Phase A — Plan (code nahi)

```text
Use the improve-codebase-architecture skill, then the grill-me skill on its output. Read CONTEXT.md, docs/adr/0001, 0003, 0005 and src/store/expenseStore.ts. DO NOT change any code.

Goal: propose how to split src/store/expenseStore.ts into smaller modules WITHOUT changing behaviour, public exports, or import paths, and without circular imports.
Constraints you must respect: ADR-0003 (stores are the sole data-access layer; screens never touch supabase/AsyncStorage), ADR-0005 (cross-store wiring via registration callbacks), ADR-0001 (offline-first write path). Offline queue keys must not change: @arthik_pending_expenses_<uid>, @arthik_pending_updates_<uid>, @arthik_pending_deletes_<uid>, @arthik_cached_expenses_<uid>, @arthik_failed_sync_<uid>.
Output docs/refactor/PLAN_EXPENSE_STORE.md with: proposed new files and exactly which functions/constants (by name and current line) move to each; which exports must be re-exported from src/store/expenseStore.ts (grep who imports each); the import graph before/after proving no cycles; the order of sub-steps (smallest risk first); and for each sub-step which tests in tests/ guard it.
Then grill me: ask me the 5 hardest questions about this plan (one at a time) and wait for my answers before finalising.
```

Agent ka plan wahi hona chahiye jo neeche likha hai. Agar alag nikle to dono compare karo, jo zyada safe lage wo lo.

### 6a — queue helpers ek alag file mein

**New file:** `src/store/expense/pendingQueues.ts`
**Move (verbatim):** key getters `getPendingStorageKey`, `getPendingUpdatesKey`, `getPendingDeletesKey`, `getCachedStorageKey`, `getFailedSyncStorageKey` (81–85), `getBackoffDelay` (90), `UUID_REGEX` + `isValidUUID` (95–96), `saveFailedSyncItem` (123), `savePendingUpdateOffline` (137), `savePendingDeleteOffline` (154), `updatePendingItemOffline` (177), `removePendingItemOffline` (190), `sanitizeNote` (203).
**Re-export from `expenseStore.ts`:** `UUID_REGEX`, `isValidUUID` (aur koi bhi jo bahar se import hota ho, agent grep karega).

```text
Refactor Mode. Read src/store/expenseStore.ts lines 1-215 only, then grep for who imports each exported symbol from it.

Task 6a: create src/store/expense/pendingQueues.ts and move into it, VERBATIM: getPendingStorageKey, getPendingUpdatesKey, getPendingDeletesKey, getCachedStorageKey, getFailedSyncStorageKey, getBackoffDelay, UUID_REGEX, isValidUUID, saveFailedSyncItem, savePendingUpdateOffline, savePendingDeleteOffline, updatePendingItemOffline, removePendingItemOffline, sanitizeNote (and the FailedSyncItem / ExpenseUpdatePayload types ONLY if they are not needed by the store's public interface; otherwise leave the types in expenseStore.ts and `import type` them).
Rules:
 - The new file MUST NOT import the store (`useExpenseStore`) or any other store. If one of these helpers reads store state, pass `get`/`set` in as a parameter and tell me.
 - src/store/expenseStore.ts imports the helpers back AND re-exports every symbol that was previously exported from it (`export { UUID_REGEX, isValidUUID } from './expense/pendingQueues'` etc.). Do the grep so you know exactly which ones.
 - AsyncStorage key strings must be byte-identical.
Run npm test (tests/expenseSyncPending.test.ts and tests/expenseStore.test.ts must pass untouched) and npx tsc --noEmit. Run the git diff --color-moved check.

DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(06a): extract expense pending-queue helpers"`

### 6b — `syncPendingExpenses` ko **usi file mein** chhote functions mein todo

Pehle same file mein todo (sirf organisation), tests pass karao. Phir alag file mein le jao (6c). Do-step isliye ki agar kuch toote to pata chale ki "todna" toota ya "le jaana".

Target shape:

```text
syncPendingExpenses (orchestrator, ~30 lines)
  ├─ syncPendingDeletes(userId, get, set)        // phase 1  (~347-440)
  ├─ syncPendingAdds(userId, get, set)           // phase 2  (~441-568)
  ├─ syncPendingUpdates(userId, get, set)        // phase 3  (~569-664)
  └─ flushSideQueues(userId, get)                // phases 4-9: settings, daily records, gullak, categories, profile patch, cache (~665-710)
```

```text
Refactor Mode. Read ONLY `syncPendingExpenses` in src/store/expenseStore.ts (and the helpers it calls).

Task 6b: split the body of `syncPendingExpenses` into four named functions defined ABOVE the store in the SAME file (do not create new files in this sub-step):
 - syncPendingDeletes(userId, get, set)  <- "1. Sync pending deletes first" section
 - syncPendingAdds(userId, get, set)     <- "2. Sync pending additions" section
 - syncPendingUpdates(userId, get, set)  <- "3. Sync pending updates" section
 - flushSideQueues(userId, get)          <- sections 4-8 plus the final cache write
The action `syncPendingExpenses` keeps its guards, its outer try/catch and calls these in EXACTLY the same order with the same awaits.
Rules:
 - Move code VERBATIM, including P0.x comments, loops, backoff checks, the "re-read queue before saving" blocks (P0.12), error handling, and `.catch()` chains.
 - Do NOT convert sequential awaits to Promise.all. Do NOT reorder anything. Do NOT merge the three near-identical loops into one generic loop.
 - Variables that were shared between sections (e.g. a "changed" flag, a userId, lists) must be passed/returned explicitly. If any variable is shared in a way that needs a redesign, STOP and tell me.
 - Types: `get: () => ExpenseState`, `set: (partial: ...) => void` using the store's own types.
Run npm test; tests/expenseSyncPending.test.ts and tests/expenseStore.test.ts MUST pass untouched. Then do a MUTATION CHECK: in syncPendingAdds delete the ignoreDuplicates option; confirm a test fails; `git checkout -- src/`.

DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(06b): split syncPendingExpenses into phase functions"`

### 6c — phase functions ko alag file mein

**New file:** `src/store/expense/syncPending.ts` — `syncPendingDeletes`, `syncPendingAdds`, `syncPendingUpdates`, `flushSideQueues` (verbatim). Ye `./pendingQueues`, `../dailyBudgetStore`, `../categoryStore`, `../../config/supabase`, `../../lib/networkUtils` import kar sakti hai; **`../expenseStore` ko sirf `import type` se** (cycle nahi banta).

```text
Refactor Mode.
Task 6c: move syncPendingDeletes, syncPendingAdds, syncPendingUpdates, flushSideQueues from src/store/expenseStore.ts to src/store/expense/syncPending.ts, VERBATIM, and import them back in expenseStore.ts.
Rules: syncPending.ts must NOT import `useExpenseStore` at runtime. Types only via `import type { Expense, ExpenseState } from '../expenseStore'`. Check there is no cycle: run `npx madge --circular --extensions ts,tsx src` (install with npx, do not add to package.json) before and after and show both outputs. Any NEW cycle = stop and report.
Run npm test and npx tsc --noEmit.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(06c): move sync phases to src/store/expense/syncPending.ts"`

> `fetchExpenses` (718–867), `addExpense` (868–968), `updateExpense` (969–1060), `deleteExpense` (1061–1165) abhi **mat chhedo**. Agar 6a–6c ke baad bhi file bhaari lage to baad mein alag step banana.

### Step 6 done kab
- `expenseStore.ts` ~700 lines, `syncPendingExpenses` ~30 lines
- Gates A–D, madge mein koi naya cycle nahi
- **Smoke #3 aur #4 (airplane mode wale) zaroor**, #1, #2 bhi

```bash
git checkout refactor/integration && git merge --no-ff refactor/06-expense-store-split
```

---

## Step 7 — `dailyBudgetStore` split (sabse bada)

**Branch:** `refactor/07-daily-budget-store-split`
**Skills:** Phase A: `improve-codebase-architecture` → `grill-me` → `to-issues`. Phase B: koi nahi (Step 2 ke tests safety net)
**Risk:** **Sabse high.** Paisa, streak, Gullak, rollover
**Time:** 2–3 din
**Pehle shart:** Step 2 aur Step 6 merged, sab green

### Kyun (derivation)
`dailyBudgetStore.ts` 2501 lines. Usme: (1) AsyncStorage key getters aur pending-save helpers, (2) expense bridge (`registerExpenseGetter` ke module-level singletons), (3) income/reimbursement classifiers, (4) `computeMetrics` (150 lines), (5) 30+ actions, jinme 2 monster: `hydrateFromSupabase` (572) aur `checkAndRollover` (299), (6) persist + migrate. Ek action badalne ka matlab 2500 lines ka context.

**Kya khaas dhyaan dena hai (ye file ki khaas "jaalen" hain):**
1. `expenseGetter` aur `expensesLoadedGetter` (lines 19–33) **module-level variables** hain, singleton. Agar tum inhe naye file mein le jao to **sirf ek hi file mein ho** aur `dailyBudgetStore.ts` unhe re-export kare. Do copies = dono stores alag getter dekhenge = bug.
2. File ke beech mein `import` statements hain (lines ~34–45). **Inhe top par mat le jao.** Import order module-evaluation order badal sakta hai (circular imports ke saath ye silent bug deta hai). Jaise hain waise rehne do.
3. `persist` ka `version: 3` aur `migrate` (line ~2461+) aur `partialize`: **bilkul mat chhedo**. Persisted state ka shape badla to users ka local data corrupt.
4. `hydrateFromSupabase` mein do jagah "aaj ka record ensure" ka lagbhag same code hai (offline path ~1912–1965 aur online path ~2282–2318; farak sirf ek comment ka). Isko **ek helper mein tabhi** merge karo jab Step 2 ke tests us branch ko cover karte hon. Warna dono rehne do.
5. `get()` / `set()` ki timing: `hydrateFromSupabase` ke andar `get()` bar-bar naya state padhta hai. Helper functions ko `get` pass karo, purana `state` snapshot mat pass karo.

### Phase A — Plan (code nahi)

```text
Use the improve-codebase-architecture skill, then grill-me, then to-issues. Read CONTEXT.md, docs/adr/0003, 0005, 0010, 0011, docs/maps/daily-budget-map.md and src/store/dailyBudgetStore.ts. DO NOT change code.

Goal: plan a behaviour-preserving split of src/store/dailyBudgetStore.ts (2501 lines) into modules under src/store/dailyBudget/. Output docs/refactor/PLAN_DAILY_BUDGET_STORE.md with: new file list; for each, the exact names of functions/constants that move and their current line ranges; every symbol that must stay exported from src/store/dailyBudgetStore.ts (grep all importers across src/ and tests/); the import graph before/after proving no cycles; and sub-steps 7a..7g ordered smallest-risk-first, each with the tests in tests/ that guard it.
Must-respect constraints: module-level singletons (expenseGetter, expensesLoadedGetter) must exist in exactly one module; imports in the middle of the file must not be reordered; persist version/migrate/partialize untouched; no new cycles; get()/set() must be passed to helpers, never a stale snapshot.
Convert the sub-steps into issues in .scratch/refactor/issues/ (same format as the existing .scratch/*/issues/*.md files).
Then grill me with the 5 hardest questions, one at a time.
```

### 7a — pending storage helpers + types

**New files:** `src/store/dailyBudget/pendingStorage.ts`, `src/store/dailyBudget/types.ts`
**Move (verbatim):**
- `pendingStorage.ts`: `getPendingSettingsKey`, `getPendingGullakAddsKey`, `getPendingGullakDeletesKey`, `getPendingPlanChangesKey`, `getPendingBudgetPeriodsKey`, `getLastRenewedPeriodKey` (125–130), `savePendingSettingsOffline` (141), `clearPendingSettingsOffline` (156), `savePendingPlanChangeOffline` (180), `savePendingBudgetPeriodOffline` (190), `getStoredList`, `setStoredList` (211–220), `savePendingGullakAdd` (221), `tryRemovePendingGullakAdd` (228), `savePendingGullakDelete` (237)
- `types.ts`: `ProfileSettingsPatch` (132), `GullakDepositSource`, `GullakDeposit` (200–210)
**Re-export from `dailyBudgetStore.ts`:** jo bhi pehle `export` tha (expenseStore, `features/autoLog/ledger.ts`, `ProfileScreen` ye import karte hain).

```text
Refactor Mode. Read src/store/dailyBudgetStore.ts lines 100-245 and grep importers of every exported symbol in that range across src/ and tests/.

Task 7a: create src/store/dailyBudget/types.ts (ProfileSettingsPatch, GullakDepositSource, GullakDeposit) and src/store/dailyBudget/pendingStorage.ts (the six key getters, savePendingSettingsOffline, clearPendingSettingsOffline, savePendingPlanChangeOffline, savePendingBudgetPeriodOffline, getStoredList, setStoredList, savePendingGullakAdd, tryRemovePendingGullakAdd, savePendingGullakDelete) by moving them VERBATIM.
Rules:
 - Do not move any import statement that sits in the middle of dailyBudgetStore.ts to the top and do not reorder imports there. Only ADD new import lines for the new files next to the existing ones.
 - dailyBudgetStore.ts must re-export every symbol that was exported before (`export { ... } from './dailyBudget/pendingStorage'`, `export type { ... } from './dailyBudget/types'`), so all existing importers keep working unchanged.
 - The new files import nothing from dailyBudgetStore.ts at runtime. Types only via `import type`.
 - AsyncStorage key strings stay byte-identical.
Run npm test and npx tsc --noEmit; then `npx madge --circular --extensions ts,tsx src` before and after.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(07a): extract daily budget pending storage and types"`

### 7b — expense bridge + classifiers

**New files:** `src/store/dailyBudget/expenseBridge.ts`, `src/store/dailyBudget/classifiers.ts`
**Move (verbatim):**
- `expenseBridge.ts`: `expenseGetter`, `registerExpenseGetter`, `getCurrentExpenses`, `expensesLoadedGetter`, `registerExpensesLoadedGetter`, `areExpensesLoaded` (19–33). **Module-level `let` variables saath mein jayenge.**
- `classifiers.ts`: `buildCategoryClassifier`, `buildReimbursementClassifier`, `buildEligibleIncomeClassifier` (50–58)
**Re-export from `dailyBudgetStore.ts`:** `registerExpenseGetter`, `getCurrentExpenses`, `registerExpensesLoadedGetter`, `areExpensesLoaded`.

```text
Refactor Mode.
Task 7b: create src/store/dailyBudget/expenseBridge.ts and src/store/dailyBudget/classifiers.ts and move VERBATIM:
 - expenseBridge.ts: the module-level variables `expenseGetter` and `expensesLoadedGetter` together with registerExpenseGetter, getCurrentExpenses, registerExpensesLoadedGetter, areExpensesLoaded (lines ~19-33). These singletons must exist ONLY in this new file (not duplicated).
 - classifiers.ts: buildCategoryClassifier, buildReimbursementClassifier, buildEligibleIncomeClassifier (lines ~50-58).
dailyBudgetStore.ts re-exports registerExpenseGetter, getCurrentExpenses, registerExpensesLoadedGetter, areExpensesLoaded and imports the classifiers. Do not touch import order of the existing imports.
Verify: grep that `registerExpenseGetter` and `registerExpensesLoadedGetter` callers (expenseStore.ts and tests) still import from './dailyBudgetStore' and that after the change the SAME module instance is used (a single definition of `let expenseGetter` exists in the repo).
Run npm test (all tests untouched) and npx tsc --noEmit; madge before/after.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(07b): extract expense bridge and classifiers"`

### 7c — `computeMetrics`

**New file:** `src/store/dailyBudget/metrics.ts` ← `computeMetrics` (243–394, ~150 lines). Ye `buildCategoryClassifier` (classifiers.ts) aur `getCurrentExpenses` (expenseBridge.ts) import karega.

```text
Refactor Mode.
Task 7c: move `computeMetrics` (src/store/dailyBudgetStore.ts ~lines 243-394) VERBATIM to src/store/dailyBudget/metrics.ts and export it. It imports what it uses (classifiers.ts, expenseBridge.ts, ../../lib/* helpers, isCountedIncome, round2 etc.). dailyBudgetStore.ts imports it back. Keep every default parameter value exactly (currentCadence = 'daily' etc.) and the exact parameter order.
Run npm test and npx tsc --noEmit; madge before/after.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(07c): extract computeMetrics"`

### 7d — `checkAndRollover` ko todo

Pehle **usi file mein** helper functions (7d-1), phir naye file mein le jao (7d-2).

Target shape (line ranges abhi ke):

```text
checkAndRollover (orchestrator)
  ├─ guard (hydration check)                                   1452
  ├─ applyScheduledNextDayBudget(get, set, todayStr)          1461-1475
  ├─ groupSpentByDate(expenses, isIncomeFn)                   1476-1480
  ├─ collectPastDates(records, spentByDate, todayStr)         1481-1502   (gap-fill rules, no phantom days)
  ├─ finalizeDailyRecords(ctx)                                1503-1654   (loop: skip rules, lock budget, upload, notification)
  ├─ finalizePeriods(ctx)                                     1655-1725   (weekly/monthly, budget_periods upload + offline queue)
  └─ metrics + set                                            1726-1748
```

```text
Refactor Mode. Read ONLY `checkAndRollover` in src/store/dailyBudgetStore.ts.

Task 7d-1: split `checkAndRollover` into named helper functions defined ABOVE the store in the SAME file (no new files yet):
 - applyScheduledNextDayBudget(get, set, todayStr)
 - groupSpentByDate(expenses, isIncomeFn)
 - collectPastDates(records, spentByDate, todayStr)
 - finalizeDailyRecords(ctx)     where ctx = { get, set, todayStr, records, spentByDate, pastDates, isIncomeFn, ...whatever the loop body reads }
 - finalizePeriods(ctx)
The action keeps the hydration guard, early returns and the final computeMetrics + set(...) and calls the helpers in EXACTLY the same order.
Rules:
 - Verbatim bodies, incl. all comments (P0.x, D2, D10, ponytail note).
 - Keep fire-and-forget promises fire-and-forget (do not add `await`, do not add `.catch` where there was none, do not remove one).
 - The per-date loop body currently mutates `records[date]`; keep the same mutation semantics (same object, same order of keys).
 - Notification calls (notifyRollover etc.) must stay in the same position relative to Supabase calls.
 - If a variable is shared across sections in a way that needs a redesign, STOP and tell me.
Run npm test: tests/dailyBudgetRollover.test.ts, tests/dailyBudgetStore.test.ts, tests/budgetModesStore.test.ts, tests/cadenceSwitch.test.ts MUST pass untouched.
MUTATION CHECK: (1) change `<` to `<=` in the past-date filter, (2) remove the "account creation" skip, (3) swap notify and upload order. Each must fail a test. Revert with git checkout -- src/.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(07d-1): split checkAndRollover into helpers (same file)"`

```text
Refactor Mode.
Task 7d-2: move the five helpers created in 7d-1 from src/store/dailyBudgetStore.ts to src/store/dailyBudget/rollover.ts, VERBATIM, and import them back. rollover.ts must not import the store at runtime (receive get/set via ctx). Types via `import type`. Run npm test, tsc, madge before/after.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(07d-2): move rollover helpers to dailyBudget/rollover.ts"`

### 7e — `hydrateFromSupabase` ko todo (sabse nazuk, sabse last)

Target shape (line ranges abhi ke):

```text
hydrateFromSupabase (orchestrator: try/catch + final set + checkAndRollover + upload)
  ├─ waitForPersistHydration()                              1852-1863   (500ms race)
  ├─ owner-change reset + set ownerUserId + notification owner   1865-1876  (stays in orchestrator)
  ├─ readPendingSettings(userId)                            1878-1881
  ├─ buildOfflineHydrationPatch(get, pendingSettings, ...)  1883-1965   (offline fast-path; returns patch; orchestrator does set + return)
  ├─ fetchRemoteBudgetData(userId)                          1967-2000   (4 parallel queries + 3500ms timeout)
  ├─ (resolve remote values, ~2001-2087)                    stays as locals in orchestrator
  ├─ mergePendingPlanChanges(...)                           2088-2118
  ├─ mergePendingPeriods(...)                               2119-2130
  ├─ selfHealDefaultBudget(...)                             2131-2230   (the "500" recovery)
  ├─ selfHealCorruptedRows(...)                             2231-2281   (3 sub-steps incl. Supabase row fix)
  ├─ ensureTodayRecord(records, ctx)                        2282-2318   (and the duplicate at 1912-1965, ONLY if tests cover both)
  ├─ hydrateGullakDeposits(...)                             2319-2375
  └─ computeMetrics + set(...)                              2376-2408
```

> **Strategy:** sirf wo hisse nikalo jo apne aap mein poore hain (input leke output dete hain). Beech ke local variables (`resolvedBudget`, `resolvedAutoRenew`, `resolvedCadence`...) ko jabardasti object mat banao. Wo orchestrator mein locals hi rahenge. Jo helper unhe badalna chahta hai wo naya value **return** kare aur orchestrator assign kare, **usi order mein**.

```text
Refactor Mode. Read ONLY `hydrateFromSupabase` in src/store/dailyBudgetStore.ts.

Task 7e-1: extract these self-contained blocks into named helper functions defined ABOVE the store in the SAME file (no new files yet), one at a time, running `npm test` after EACH extraction (so a failure points to one block):
 1. waitForPersistHydration()
 2. readPendingSettings(userId)
 3. fetchRemoteBudgetData(userId): the Promise.race of the 4 parallel supabase queries with the 3500ms timeout; returns { profileData, logsData, plansData, periodsData }. Keep the exact select() column lists, order() calls and the timeout fallback value.
 4. mergePendingPlanChanges(...) and mergePendingPeriods(...)
 5. selfHealDefaultBudget(...)  (the "OTA Update Bug where budget was reset to 500" recovery)
 6. selfHealCorruptedRows(...)  (3 sub-steps incl. the daily_savings_log update)
 7. hydrateGullakDeposits(...)
 8. The offline fast-path: `buildOfflineHydrationPatch(get, pendingSettings, todayStr)` that returns the object passed to set(...); the orchestrator keeps `set(patch); return;`.
Rules:
 - VERBATIM bodies and comments. No reordering of awaits. No Promise.all conversions. Same try/catch boundaries: if a block was inside its own try/catch that swallows errors, the helper keeps that try/catch.
 - The local variables resolvedBudget, resolvedAutoRenew, resolvedBudgetModeEnabled, resolvedCadence, resolvedWeeklyBudget, resolvedMonthlyBudget, resolvedPlanChanges, resolvedPeriods, resolvedDeposits, records stay as `let` locals in hydrateFromSupabase. Helpers receive what they read as parameters and RETURN what they changed; the orchestrator assigns in the same order as before.
 - Helpers call get()/set() through passed-in functions, never a stale snapshot of state.
 - The two near-identical "ensure today's record" blocks (offline ~1912-1965 and online ~2282-2318): DO NOT merge them in this step. Leave both as they are.
 - Do not touch the final part: computeMetrics + set(...), get().checkAndRollover(currentExpenses, true), get().uploadPendingDailyRecords(), and the outer catch.
After the last extraction run the full suite. tests/dailyBudgetHydrate.test.ts, tests/dailyBudgetStore.test.ts, tests/budgetModesStore.test.ts, tests/offlineStartup.test.ts MUST pass untouched.
MUTATION CHECK for 6 places: remove one of the 6 pending-settings overrides in the offline path; change 3500 to 0; skip selfHealDefaultBudget; remove local-pending-adds preservation in hydrateGullakDeposits; remove the checkAndRollover(…, true) call; swap order of mergePendingPlanChanges and mergePendingPeriods. Each must fail a test. Revert with git checkout -- src/.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(07e-1): split hydrateFromSupabase into helpers (same file)"`

```text
Refactor Mode.
Task 7e-2: move the helpers created in 7e-1 from src/store/dailyBudgetStore.ts to src/store/dailyBudget/hydrate.ts, VERBATIM. hydrate.ts must not import the store at runtime (get/set/useNetworkStore-state are passed in or imported from their own stores; check for cycles). Types via `import type`. Run npm test, tsc, madge before/after.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(07e-2): move hydrate helpers to dailyBudget/hydrate.ts"`

### 7f (optional) — baaki lambe actions

`setBudgetModeEnabled` (729–838, 110 lines), `setDailyBudget` (529–635, 107 lines), `setBudgetCadence` (839–929), `toggleAutoRenew` (636–712), `setWeeklyBudget`/`setMonthlyBudget` (~67 lines each). Inhe bhi 7d jaise todo, **ek ek action alag commit mein**, aur pehle us action ka test gap Step 2 jaisa check karo. Sirf tab jab file abhi bhi bhaari lage.

### Step 7 done kab
- `dailyBudgetStore.ts` ~900–1100 lines, kisi action mein 150 se zyada lines nahi (7f ke bina `setBudgetModeEnabled` 110 hi rahega)
- Gates A–D, madge mein koi naya cycle nahi
- **Smoke #5, #6, #7 (rollover), #1, #2, #3** device par

```bash
git checkout refactor/integration && git merge --no-ff refactor/07-daily-budget-store-split
```

---

## Step 8 — `any` cleanup + duplicate helpers (optional, low priority; Auto Logging runtime frozen)

**Branch:** `refactor/08-types-and-dedupe`
**Skill:** koi nahi
**Risk:** Low (types runtime par erase ho jate hain), lekin dedupe medium
**Time:** 2–3 ghante

### 8a — `any` hatao (sirf jahan `tsc` clean rahe)
Old snapshot count was 74; re-count in Step 0. Top files in the old snapshot included `SplashScreen.tsx`, `lib/chartUtils.ts`, and `features/autoLog/engine.ts`. Aur do jagah jo Step 7 ke baad dikhengi: `Promise<[any, any, any, any]>` (remote fetch timeout fallback) aur `data.forEach((row: any) => ...)` (streak calendar).

```text
Refactor Mode (types only).
Task 8a: replace `any` with precise types in these files ONLY: src/screens/SplashScreen.tsx, src/lib/chartUtils.ts, src/store/dailyBudget/hydrate.ts (the Promise.race tuple of supabase responses), src/lib/streakCalendarData.ts. Do NOT edit `src/features/autoLog/engine.ts` in this pass: its matching/review/financial classification behaviour is protected; handle any Auto Logging typing cleanup in a separately reviewed plan after the core refactor.
Rules: types only. No runtime code changes (no new `if`, no `?.` added, no `as` that changes meaning, no defaults). Use existing interfaces from the repo or small local interfaces describing the Supabase row shape actually selected. If a precise type needs a runtime change, leave the `any` and list it in the report. Prefer `unknown` + narrowing ONLY where narrowing code already exists.
Run npx tsc --noEmit (must stay 0 errors) and npm test.
DONE REPORT (same format as Step 4).
```

### 8b — 4 jagah repeat hue `getStoredList/setStoredList`

```text
Refactor Mode.
Task 8b: grep for duplicated definitions of `getStoredList` and `setStoredList` (and any identical JSON-array AsyncStorage read/write helper) across src/store/*.ts and src/store/**/*.ts. First print each definition side by side and tell me if the bodies are IDENTICAL (same try/catch, same fallback `[]`, same JSON.parse handling). Only if ALL are identical: create src/lib/asyncStorageList.ts with the single implementation, and replace the duplicates with imports. If even one differs in behaviour, do NOT merge those; list the differences.
Run npm test and npx tsc --noEmit.
DONE REPORT (same format as Step 4).
```

Commit: `git commit -am "refactor(08): types cleanup and dedupe storage list helpers"` → merge `--no-ff` into `refactor/integration`.

---

## Step 9 — Final verification, docs update, merge, OTA

**Branch:** `refactor/integration` (ab main se compare karo)
**Skill:** `zoom-out` (docs update ke liye)
**Time:** 1 din

### 9a — Docs ko naye structure ke saath sync karo

Tumhare `AGENTS.md` §2 (Repository Map), `docs/architecture.md`, `CONTEXT.md` ke "Code location" references (jinme line numbers hain, jaise `dailyBudgetStore.ts (lines 38–48)`) aur `docs/maps/daily-budget-map.md` **purane structure** ko batate hain. Agle AI agent ko galat jagah bhejenge.

```text
Use the zoom-out skill. Docs-only task: no changes under src/ or tests/.
The refactor moved code into src/store/expense/*, src/store/dailyBudget/*, src/screens/insights/*, src/components/profile/*, src/components/savings/*, plus *.styles.ts files and src/lib/streakCalendarData.ts, src/lib/asyncStorageList.ts.
Update ONLY these documents so every path/function reference is correct:
 - AGENTS.md section 2 "Repository Map" and the "High blast-radius files" list (remove line-number claims that no longer hold).
 - docs/architecture.md
 - docs/maps/daily-budget-map.md
 - CONTEXT.md: every "Code location" that names a file + line range or a function that moved (use grep for each function name to find its new file). Do NOT change any definition, language, or "Avoid" term.
 - Add a new ADR docs/adr/0012-store-module-split.md describing the split (context, decision, consequences, "what would have to be true to revisit"), in the same style as the other ADRs, including the rules: stores never imported by their helper modules; re-exports keep old import paths; singletons live in exactly one module.
Verify every path you write exists (ls/grep).
DONE REPORT: list of changed docs; no code changes (git diff --name-status must show only .md files).
Do NOT run git commit, git push, git merge, or eas update.
```

### 9b — Final gates (tum khud)

```bash
git checkout refactor/integration
npm ci
npm test                                   # >= exact Step 0 baseline + intentionally added tests, 0 failures
npx tsc --noEmit                           # 0 errors
npx madge --circular --extensions ts,tsx src   # naya cycle nahi
git diff --name-status main -- tests/      # sirf A (naye test files)
git diff --stat main -- src/ | tail -1     # kitna badla
wc -l src/store/*.ts src/screens/InsightsScreen.tsx src/screens/SavingsScreen.tsx src/screens/ProfileScreen.tsx
```

**Expected sizes (andaza):**

| File | Pehle | Baad mein |
|---|---|---|
| `dailyBudgetStore.ts` | 2501 | ~900–1100 |
| `expenseStore.ts` | 1192 | ~700 |
| `InsightsScreen.tsx` | 2033 | ~900–1000 |
| `SavingsScreen.tsx` | 1453 | ~400–500 |
| `ProfileScreen.tsx` | 1187 | ~600 |
| `StreakCalendarModal.tsx` | 901 | ~700 |

### 9c — Device par poora smoke + screenshots compare
Section 7 ki **poori** list, **dev build** (ya local `npx expo start --dev-client`) par. Screenshots purane (Step 0 wale) se ek-ek karke compare karo. Offline (#3, #4) aur rollover (#7) ko khaas dhyaan se.

### 9d — Pehle `preview` channel par OTA (tumhare `eas.json` mein `preview` channel hai)

> Apna `docs/RELEASE_PROCESS.md` aur ADR-0006 ("OTA updates tied to app version") ek baar dekh lo. Neeche ke commands tumhare EAS setup ke hisaab se verify karna.

```bash
# preview build wala APK ek phone par installed ho, phir:
eas update --branch preview --message "refactor verification (no behaviour change)"
```
Preview APK par 1–2 din normal use karo (khud ka real data). Kuch ajeeb dikhe to Section 9 (rollback) dekho.

### 9e — main mein merge aur production

```bash
# CHANGELOG.md mein ek hi consolidated entry rakhna ("Internal refactor, no user-visible change")
git checkout main
git merge --no-ff refactor/integration
git push
# production OTA tabhi jab preview par sab theek ho:
eas update --branch production --message "internal refactor (no user-visible change)"
```

**Do tips:**
1. Refactor OTA ko **kisi naye feature ke saath mat bhejo.** Alag bhejo, taaki kuch bigde to rollback ek hi update ka ho.
2. Production mein jaane ke baad ek-do din Supabase dashboard par nazar rakho: `daily_savings_log`, `expenses` mein unusual duplicates ya gaps to nahi.

---

# 9. Agar kuch toot jaye (rollback + diagnose)

**Pehle rule: panic mat karo, step chhota tha, to ek commit/merge ka hi kaam hai.**

| Situation | Kya karo |
|---|---|
| Step branch par test fail | Wahi commit revert karo: `git revert <hash>` ya `git reset --hard HEAD~1` (agar commit abhi local hai). Fir prompt ko "aur chhota" karke dobara chalao |
| Merge ke baad `refactor/integration` mein kuch toota | `git revert -m 1 <merge-commit-hash>` (poora step wapas) |
| Pata nahi kaun sa commit tod gaya | `git bisect start; git bisect bad; git bisect good pre-refactor` aur har step par `npm test` chalao |
| Production OTA ke baad bug | Pichla update dobara publish karo (ya `pre-refactor` tag se: `git checkout pre-refactor && eas update --branch production`), phir bug ko calm dimaag se `diagnose` skill se dhundo |
| Smoke test mein number alag aa raha hai (screens) | Pehle `git diff --color-moved` dekho. 99% yahan koi "moved nahi, badla hua" hunk milega |

**`diagnose` skill ka prompt (sirf tab):**

```text
Use the diagnose skill.
Symptom: <jo dikha: screen, kaunsa number, kya expected, kya aaya>.
Context: I am in the middle of a behaviour-preserving refactor (see docs/refactor/*). The last known-good tag is `pre-refactor`; the current branch is <branch>.
Steps: (1) build a feedback loop: reproduce the symptom with a failing Vitest test or a minimal script (use tests/helpers/*). (2) minimise it. (3) run `git diff --color-moved=dimmed-zebra --color-moved-ws=ignore-all-space pre-refactor -- <suspect files>` and list every hunk that is not a pure move. (4) hypothesise which non-move hunk or which moved block changed behaviour (order of awaits, dependency arrays, shared singleton, stale snapshot). (5) propose the SMALLEST fix that restores the old behaviour exactly. Do not fix anything else. Do not commit.
```

---

# 10. Kya NAHI karna (list)

1. Refactor ke saath **koi bug fix ya feature** mat mila do.
2. Purane **test file edit mat karo** (sirf naye add).
3. Dependency arrays `[...]` "sahi" mat karo.
4. `await` ka order mat badlo; sequential ko `Promise.all` mat banao.
5. Mid-file `import` ko top par mat le jao (dailyBudgetStore); import order mat badlo.
6. Store khud helper file mein import mat karo (circular). `get/set` pass karo, types ke liye `import type`.
7. `persist` ka `version`, `migrate`, `partialize` mat chhuo.
8. AsyncStorage key strings (`@arthik_pending_...`) ka ek akshar mat badlo.
9. `modules/arthik-autolog`, `schema.sql`, `supabase/`, `versionCheck.ts`, `UpdateRequiredScreen.tsx` mat chhuo. Also do not opportunistically refactor `src/features/autoLog/*`, `src/components/autolog/*`, `src/screens/autolog/*`, or Pull-to-History files during this plan; preserve them and run their tests as regression gates.
10. Naya package mat add karo (`madge` sirf `npx` se chalao, `package.json` mein nahi).
11. Ek hi commit mein 2 steps mat daalo.
12. Production OTA tab tak nahi jab tak `preview` par smoke pass na ho.

---

## 11. Updated execution order and stop conditions

1. Step 0 baseline + current ZIP reconciliation.
2. Audit coverage for offline expense sync, budget hydration/rollover, Auto Logging source reconciliation, reimbursements/transfers, and Pull-to-History. Add only missing tests; do not force the historical test counts.
3. Refactor UI-only files in small move-only commits.
4. Refactor `expenseStore` only after its offline-queue safety net is proven.
5. Refactor `dailyBudgetStore` only after all money/rollover/accounting tests are green.
6. Keep Auto Logging and Pull-to-History implementation frozen during the broad refactor; run their existing tests after every meaningful step. Any failure means stop and diagnose, not patch forward.
7. Docs + full suite + device smoke + preview validation. No commit/merge/OTA unless Kislaya explicitly instructs it.

# Quick view: poora order ek nazar mein

| # | Step | Branch | Skill | Code change? | Risk |
|---|---|---|---|---|---|
| 0 | Baseline + Refactor Mode | `refactor/00-baseline` | `zoom-out` | Nahi (docs) | Zero |
| 1 | Tests: `syncPendingExpenses` | `refactor/01-safety-net-expense-sync` | `tdd` | Sirf naye tests | Zero |
| 2 | Tests: hydrate/rollover/sync | `refactor/02-safety-net-budget-store` | `tdd` | Sirf naye tests | Zero |
| 3 | `InsightsScreen` | `refactor/03-insights-split` | `zoom-out` | Move only | Low |
| 4 | `ProfileScreen` | `refactor/04-profile-split` | — | Move only | Low–Med |
| 5 | `SavingsScreen`, Streak modal | `refactor/05-savings-streak-split` | `tdd` (5c) | Move + 1 pure fn | Low–Med |
| 6 | `expenseStore` | `refactor/06-expense-store-split` | `improve-codebase-architecture`, `grill-me` | Move + split | **High** |
| 7 | `dailyBudgetStore` | `refactor/07-daily-budget-store-split` | `improve-codebase-architecture`, `grill-me`, `to-issues` | Move + split | **Highest** |
| 8 | `any` + dedupe | `refactor/08-types-and-dedupe` | — | Types only | Low |
| 9 | Docs + final + OTA | `refactor/integration` | `zoom-out` | Docs only | — |

**Suggested timeline:** Din 1: Step 0–1 · Din 2: Step 2 · Din 3: Step 3 · Din 4: Step 4–5 · Din 5–6: Step 6 · Din 7–9: Step 7 · Din 10: Step 8–9.
**Agar time kam hai:** Step 0, 1, 2, 3, 6 karo. Ye sabse zyada fayda dete hain. Step 7 ko tab karo jab Step 6 ke baad confidence aa jaye.
