# Arthik — OTA Optimisation Guide (agent execution file)

> **Who this is for:** the coding agent working on the Arthik repo.
> **What it is:** a list of optimisation tasks. Each task says exactly which file to change, how, what must NOT change,
> and how to prove it worked. Do the tasks **one by one, in order**. Do not invent extra work. Do not skip the checks.
>
> **Written:** 23 Oct 2026, from a line-by-line read of the codebase at that date
> (`src/` + `App.tsx` + `index.ts`: ~65,200 lines; 128 test files, 1,895 tests, `tsc` clean).
> **Location:** `docs/optimisation.md`. This is the **only** optimisation document of the repo and it is supreme for
> optimisation work. The old `docs/OPTIMISATION_PLAN.md` has been deleted on purpose; nothing in this file depends on
> it. Do not recreate it and do not look for it.
>
> **Progress tracking:** when a task is merged, add one line directly under its heading:
> `**Status:** ✅ Done <date> — <PR link or short note>`. Never delete a finished task; the file is also the record.

---

## 0. Rules you must follow for EVERY task

### 0.1 The golden rule
**Faster, smoother, smaller. Never different.** Same numbers, same rounding, same order of money operations, same
stored values, same screens, same copy, same navigation. If a task could change what a user sees in a number, or what is
saved to the database or AsyncStorage, it is marked **⚠️ OWNER GATE**: stop, write the owner a short note (what changes,
what could go wrong), and wait for an explicit "yes" before writing code.

Before any task, read:
- `AGENTS.md` (whole file). Its protocol wins over anything here.
- `docs/ARTHIK_CANONICAL_RULES.md`. If a task would contradict a rule ID, stop and tell the owner (name the rule ID).

### 0.2 OTA-safe contract (the whole point of this file)
Every task in this file must ship with `eas update` (OTA). **No new APK.** That means:

**Allowed:** TypeScript/JS changes, JS-only packages that are already in `package.json`, image/font assets that are
`require()`d from JS, devDependencies (tooling only), Supabase SQL that the owner runs (only where a task says so).

**Forbidden (needs a new APK, so not part of this file):**
- Adding or upgrading any package that has native code (anything with `android/` or an Expo config plugin).
- Changing `app.json` keys: `plugins`, `android.permissions`, `android.package`, `version`, `runtimeVersion`, `splash`,
  `icon`, `adaptiveIcon`, `scheme`. (The only `app.json` edit allowed is the OTA `highlights` text list.)
- Anything inside `modules/arthik-autolog/android/` (Kotlin).
- Calling a native module method that the installed binary does not have.

**How to self-check before you open the PR:**
```bash
git diff --name-only main...HEAD
# Must NOT list: modules/arthik-autolog/android/**, android/**, ios/**
git diff main...HEAD -- package.json
# Only allowed: devDependencies, or nothing. No new "dependencies" entries.
git diff main...HEAD -- app.json
# Only allowed: lines inside "highlights": [ ... ]
```

### 0.3 Definition of done (every task)
1. `npm run typecheck` → 0 errors.
2. `npm test` → every test passes. Test count may only go **up**.
3. `npx expo export --platform android --output-dir /tmp/arthik-export` → builds with no error.
4. Manual device check from the task's **"Check on device"** list (use a low-end Android if possible, see §0.5).
5. `CHANGELOG.md` → new entry at the top of `## [Unreleased]`, same style as existing entries
   (title, what changed, why, "No money logic touched", tests, docs). Add "— OTA-safe" to the title.
6. Docs sync (AGENTS.md rule 4): update every doc that mentions what you changed (`docs/CODEBASE_GUIDE.md`,
   `docs/design-system.md`, `docs/architecture.md`, `CONTEXT.md`, `AGENTS.md` repo map, and the **Status** line of the
   task in this file). Use `grep -rn "<name>" --include=*.md .` to find mentions.
7. `app.json` → `highlights`: add a line **only** if the user can feel the change (smoother, faster). Plain English.
   Never use Hinglish or the word "udhari" in app text.
8. Never `git commit`, `git push`, `git merge`, or `eas update` unless the owner explicitly says so.

### 0.4 One task = one PR
Never mix two tasks in one PR. If a task says "do A then B", that is still one PR.
If you discover a new problem while working, **write it down in the PR description** under "Found, not fixed". Do not fix it.

### 0.5 Device test setup (use for every "Check on device")
- Phone: any Android with 4 GB RAM or less if available, plus one modern phone.
- Developer options → "Profile HWUI rendering" → "On screen as bars". Green line = 16 ms (60 fps). Bars above it = jank.
- In the dev build: shake → "Perf Monitor". Watch **JS** fps and **UI** fps separately.
  - UI fps drops → rendering/native problem.
  - JS fps drops while an animation runs → that animation is on the JS thread (Phase 2 fixes these).
- Test each change on: light theme, dark theme, AMOLED theme, largest system font size, "Remove animations" ON
  (Accessibility), airplane mode.

### 0.6 Spring and easing conversion table (needed in Phase 2)
React Native `Animated.spring({ tension, friction })` uses "origami" values. Reanimated `withSpring` uses
`{ stiffness, damping, mass }`. Convert with React Native's own formulas so the motion is **identical**:

```
stiffness = (tension  - 30) * 3.62 + 194
damping   = (friction -  8) * 3    + 25
mass      = 1
```

| Animated.spring | Reanimated withSpring (identical feel) | Used in |
|---|---|---|
| tension 70, friction 8 | `{ stiffness: 338.8, damping: 25, mass: 1 }` | nav tab press, keypad spring-back, add button press |
| tension 100, friction 16 | `{ stiffness: 447.4, damping: 49, mass: 1 }` | Insights period dots (already listed in design-system.md) |
| tension 75, friction 6 | `{ stiffness: 356.9, damping: 19, mass: 1 }` | save-button tick |

If the source already uses `{ stiffness, damping, mass }`, copy the values as they are.
Always set `overshootClamping` the same as the source (default `false`).
`Easing.out(Easing.cubic)` from `react-native` → `Easing.out(Easing.cubic)` from `react-native-reanimated` (same curve).
`Easing.bezier(a,b,c,d)` → `Easing.bezier(a,b,c,d)` from `react-native-reanimated`.

**Gesture velocity units:** `PanResponder` gives `vx/vy` in **px per millisecond**. React Native Gesture Handler gives
`velocityX/velocityY` in **px per second**. Multiply every velocity threshold by **1000** when porting.
Example: `vy > 0.35` → `e.velocityY > 350`.

**Thread hop:** this codebase uses `scheduleOnRN` from `react-native-worklets` to call JS from a worklet
(see `BottomSheetModal.tsx`). Use the same. Do not use `runOnJS`.

### 0.7 Order of work
| Phase | What | Risk | Why this order |
|---|---|---|---|
| M | Measure (baseline numbers) | none | So every later PR can prove it helped |
| 1 | Startup and bundle size | low | Biggest felt win: app opens faster |
| 2 | Animations to the UI thread | low–medium | Removes stutter during data loads |
| 3 | Data flow and re-renders | low–medium | Fewer useless renders, less battery |
| 4 | Lists | medium | History scroll on big accounts |
| 5 | Perceived speed and polish (big-app patterns) | mixed, several ⚠️ | Feels premium |
| 6 | Clean-up | none | Smaller, tidier repo |
| 7 | React Compiler (optional) | ⚠️ | Only after everything else is green |

---

## OPT-00. Housekeeping after the old plan was deleted (do this first, 5 minutes)
The owner deleted `docs/OPTIMISATION_PLAN.md` and placed this file at `docs/optimisation.md`. Fix the links:
1. `docs/README.md`: find the table row that links to `OPTIMISATION_PLAN.md`. Change the link target and text to
   `optimisation.md`, and the description to "OTA optimisation guide (agent execution file, supreme for optimisation
   work)".
2. `CHANGELOG.md`: do **not** edit released/old entries (they are history). In the `## [Unreleased]` section only, if an
   entry lists `docs/OPTIMISATION_PLAN.md` among changed docs, remove that file name from the list. Add a new
   Unreleased entry: "Docs: replaced `docs/OPTIMISATION_PLAN.md` with `docs/optimisation.md` (OTA optimisation guide)."
3. `grep -rn "OPTIMISATION_PLAN" . --include=*.md --include=*.ts --include=*.tsx --include=*.json | grep -v node_modules`
   → only old CHANGELOG history lines may remain.
No code changes. No tests needed beyond `npm run typecheck` and `npm test` passing.

---

## Phase M — Measure first

### M1. Add dev-only performance marks
**Status:** ✅ Done 23 Oct 2026 — Dev-only timing marks in App.tsx, SplashScreen.tsx, HomeScreen.tsx

**Why:** Today nobody can say "Home now opens 400 ms faster" with proof. Every big app (Uber, Swiggy, Google) tracks
time-to-interactive per screen. We do it dev-only, so release builds carry zero cost.

**Create** `src/lib/perfMarks.ts`:
```ts
/**
 * Dev-only timing marks. In release builds every function is a no-op (no cost, no logs).
 * Usage: perfMark('fonts_ready'); ... perfSummary();
 */
type Mark = { name: string; t: number };
const marks: Mark[] = [];
const now = (): number =>
  typeof globalThis.performance?.now === 'function' ? globalThis.performance.now() : Date.now();

export function perfMark(name: string): void {
  if (!__DEV__) return;
  if (marks.some((m) => m.name === name)) return; // first occurrence only
  marks.push({ name, t: now() });
}

export function perfSummary(label = 'startup'): void {
  if (!__DEV__ || marks.length === 0) return;
  const t0 = marks[0].t;
  const lines = marks.map((m) => `${m.name.padEnd(28)} +${Math.round(m.t - t0)}ms`);
  // eslint-disable-next-line no-console
  console.log(`[perf:${label}]\n${lines.join('\n')}`);
}
```

**Add marks (one line each, nothing else changes):**
| File | Where | Line to add |
|---|---|---|
| `App.tsx` | first line inside the module body, after imports | `perfMark('js_start');` |
| `App.tsx` | right after `const [fontsLoaded] = useFonts(...)`, inside `if (fontsLoaded)` branch of render, via `useEffect(() => { if (fontsLoaded) perfMark('fonts_ready'); }, [fontsLoaded]);` | as shown |
| `src/screens/SplashScreen.tsx` | after the `getSession` race resolves (step 2) | `perfMark('session_ready');` |
| `src/screens/SplashScreen.tsx` | after the hydration race (step 4) | `perfMark('hydration_done');` |
| `src/screens/SplashScreen.tsx` | where `navigation.replace(target)` is called | `perfMark('splash_exit');` |
| `src/screens/HomeScreen.tsx` | `onLayout` of the root view (add an `onLayout` prop to the existing outer `View`/shell if none) | `perfMark('home_first_layout'); perfSummary();` |

**Must not change:** any timing, any order, any await. Marks only read the clock.

**Check:** run the dev build 3 times cold (kill app each time). Write the 3 summaries into the PR description.
That table is the **baseline** for Phase 1:

| Checkpoint | Run 1 | Run 2 | Run 3 | Baseline Average |
|---|---|---|---|---|
| `js_start` | +0ms | +0ms | +0ms | **+0ms** |
| `fonts_ready` | +170ms | +151ms | +176ms | **+166ms** |
| `session_ready` | +1204ms | +931ms | +1900ms | **+1345ms** |
| `hydration_done` | +2640ms | +1691ms | +3051ms | **+2461ms** |
| `splash_exit` | +3256ms | +2327ms | +3658ms | **+3080ms** |
| `home_first_layout` | +4224ms | +3073ms | +4487ms | **+3928ms** |


### M2. Record bundle size baseline
**Status:** ✅ Done 23 Oct 2026 — Recorded production bundle and package sizes

**Do (no code change, no commit of output):**
```bash
npx expo export --platform android --output-dir /tmp/arthik-export --dump-sourcemap
ls -la /tmp/arthik-export/_expo/static/js/android/
npx --yes source-map-explorer /tmp/arthik-export/_expo/static/js/android/*.js \
     /tmp/arthik-export/_expo/static/js/android/*.map --html /tmp/bundle.html
```
(If the bundle file is `.hbc`, use the `.map` with the matching name; if `source-map-explorer` cannot read Hermes
bytecode, add `--no-bytecode` to `expo export`. This is only for measuring.)

Write into the PR description: total bundle size, and the size of `lucide-react-native` and `date-fns` in the
explorer output. Phase 1 must make these numbers go down.

**Baseline Recorded (23 Oct 2026):**

| Metric / Module | Size | Share | Note |
|---|---|---|---|
| **Hermes Bytecode (`.hbc`)** | **8.07 MB** (8,458,487 B) | 100% | Shipped in OTA / release binary |
| **Minified JS Bundle (`.js`)** | **5.65 MB** (5,921,071 B) | 100% | Raw JS before bytecode compilation |
| **Total Module Count** | **4,050 modules** | — | Modules bundled by Metro |
| **`lucide-react-native`** | **1,619.1 KB** (1.58 MB) | **14.8%** | ~1,850 icons from barrel export |
| **`date-fns`** | **507.2 KB** | **4.6%** | Date utility functions |
| **`app-src` (`src/` + `App.tsx`)** | **2,297.6 KB** | **21.0%** | Application source code |
| **`react-native` core** | **2,065.6 KB** | **18.9%** | Framework runtime |


---

## Phase 1 — Startup and bundle size

### OPT-01. Import Lucide icons one by one (static imports)
**Status:** ✅ Done 23 Oct 2026 — Rewrote 70 files to static single-icon imports (`lucide-react-native/icons/*`)

**Problem found:** 73 files do `import { X, Y } from 'lucide-react-native'`. Metro (the bundler) does **not** remove unused
exports. That barrel file re-exports **~1,850 icons**, so every icon in the library is in the app bundle and is
parsed by Hermes at startup, even though the app uses about 80.

**Root cause:** the package entry `lucide-react-native` → `dist/esm/lucide-react-native.mjs` imports every icon file.

**Fix:** import each icon from its own file. The package supports this officially through its `exports` map:
`"./icons/*": { "react-native": "./dist/esm/icons/*.mjs" }`. Each icon file has a **default export**.

**How to find the right file name for each icon name (do NOT guess, names were renamed over versions):**
Open `node_modules/lucide-react-native/dist/esm/lucide-react-native.mjs` and search for `as <Name>,` or `as <Name> }`.
Example lines from the installed version (1.47.0):
```
export { default as Home, default as HomeIcon, default as House, ... } from './icons/house.mjs';
export { default as BarChart2, default as BarChart2Icon, default as ChartNoAxesColumn, ... } from './icons/chart-no-axes-column.mjs';
```
So `Home` lives in `icons/house`, `BarChart2` lives in `icons/chart-no-axes-column`.

**Do it with a throw-away script (do not commit the script), then review the diff by hand:**
```js
// /tmp/rewrite-lucide.js  — run: node /tmp/rewrite-lucide.js
const fs = require('fs'); const path = require('path');
const root = process.cwd();
const barrel = fs.readFileSync(path.join(root, 'node_modules/lucide-react-native/dist/esm/lucide-react-native.mjs'), 'utf8');
const map = {}; // ExportName -> file stem
for (const line of barrel.split('\n')) {
  const m = line.match(/^export \{ (.+) \} from '\.\/icons\/([a-z0-9-]+)\.mjs';$/);
  if (!m) continue;
  for (const part of m[1].split(',')) { const n = part.trim().replace(/^default as /, ''); map[n] = m[2]; }
}
const files = require('child_process').execSync("grep -rl \"from 'lucide-react-native'\" src App.tsx").toString().trim().split('\n');
for (const f of files) {
  let src = fs.readFileSync(f, 'utf8');
  src = src.replace(/import \{([^}]+)\} from 'lucide-react-native';\n/g, (all, names) => {
    const items = names.split(',').map((s) => s.trim()).filter(Boolean);
    const types = items.filter((n) => n.startsWith('type ') || n === 'LucideIcon' || n === 'LucideProps');
    const values = items.filter((n) => !types.includes(n));
    let out = '';
    for (const v of values) {
      const [orig, alias] = v.split(/\s+as\s+/);
      if (!map[orig]) { console.error('NO MAP', f, orig); return all; }
      out += `import ${alias || orig} from 'lucide-react-native/icons/${map[orig]}';\n`;
    }
    if (types.length) out += `import type { ${types.map((t) => t.replace(/^type /, '')).join(', ')} } from 'lucide-react-native';\n`;
    return out;
  });
  fs.writeFileSync(f, src);
}
```
- The script only rewrites single-statement named imports. **Multi-line imports** (`import {\n A,\n B\n} from ...`) are
  matched too because `[^}]+` spans lines; check every changed file anyway.
- **Skip these two files completely in this task** (they use `import * as LucideIcons` for icons chosen by name at run
  time; OPT-02 handles them): `src/lib/iconUtils.ts`, `src/screens/AddEditCategoryScreen.tsx`.
  After the script, run `git checkout -- src/lib/iconUtils.ts src/screens/AddEditCategoryScreen.tsx` if it touched them.
- Type-only imports (`LucideIcon`, `LucideProps`) stay on the barrel as `import type` — types are erased, so no bundle cost.
- If TypeScript cannot find types for `lucide-react-native/icons/house`, check `tsconfig.json` has
  `"moduleResolution": "bundler"` (or `"node16"/"nodenext"`). If it does not, do **not** change module resolution for
  the whole project; instead add `src/types/lucide-icons.d.ts`:
  ```ts
  declare module 'lucide-react-native/icons/*' {
    import type { LucideIcon } from 'lucide-react-native';
    const Icon: LucideIcon;
    export default Icon;
  }
  ```
- Tests: `vitest` mocks `lucide-react-native` in several test files (`vi.mock('lucide-react-native', ...)`). Deep imports
  bypass that mock. If a test fails because it now loads a real icon, add a matching mock in that test:
  `vi.mock('lucide-react-native/icons/house', () => ({ default: () => null }));` — or, better, one alias in
  `vitest.config.mjs`: `resolve.alias: [{ find: /^lucide-react-native\/icons\/.*/, replacement: '<path to a tiny stub module that exports default () => null>' }]`.
  Put the stub at `tests/__stubs__/lucideIcon.ts`. Do not weaken any assertion.

**Must not change:** which icon is drawn, its size, colour, strokeWidth. A wrong mapping shows the wrong picture,
so after the change open every screen and compare against screenshots taken before.

**Acceptance:**
- `grep -rn "from 'lucide-react-native'" src App.tsx` → only `import type` lines, plus `iconUtils.ts` and
  `AddEditCategoryScreen.tsx` (until OPT-02).
- M2 measurement: bundle size drops. **The full win needs OPT-02 too**, because the `import *` files still pull the barrel.

**Check on device:** take screenshots of every screen BEFORE the change (Home in both modes, History, Insights all 3
periods, Savings, Profile, Expense form, Expense detail, every modal you can open, AutoLog screens). Compare AFTER.

---

### OPT-02. ⚠️ OWNER GATE — Category icon registry (removes the last `import *` of all icons)
**Status:** ✅ Done 23 Oct 2026 — Created category icon registry, eliminated runtime barrel imports of Lucide; Hermes bytecode dropped from 8.07 MB to 6.24 MB (-1.92 MB / -22.7%), Metro modules dropped from 4,050 to 2,309 (-1,741 modules eliminated).

**Problem found:** `src/lib/iconUtils.ts` → `getCategoryIcon(iconName)` does `LucideIcons[iconName]` and
`AddEditCategoryScreen.tsx` does the same. Category icons are stored in the database **by name** (e.g. `'Utensils'`),
so the code needs every possible name at run time. That is why the whole library is imported. As long as this stays,
OPT-01 cannot remove the ~1,850 icons from the bundle.

**Fix:** a fixed registry of every icon name a category can have.

**Why gated:** a user who has a category with an icon name **not** in the registry would see the fallback icon
(`HelpCircle`) instead. No money is affected, but it is a visible change. The owner must provide the real list.

**Owner steps (ask the owner to do these and paste the result into the PR):**
1. In the Supabase SQL editor run:
   ```sql
   select icon, count(*) as n from public.categories group by icon order by n desc;
   ```
2. Paste the full result.

**Agent steps:**
1. Build the name list as the union of:
   - every name in `ICONS_GRID` and `INCOME_ICONS_GRID` in `src/screens/AddEditCategoryScreen.tsx`,
   - every name in `git log -p -S "ICONS_GRID" -- src/screens/AddEditCategoryScreen.tsx` (old versions of the grid),
   - every icon name in `schema.sql` → `handle_new_user()` seed and in `supabase/migrations/*.sql`
     (today: `Utensils, ShoppingBag, Car, FileText, Film, HeartPulse, DollarSign, Briefcase, Laptop, Percent, Gift, Wallet`),
   - every name from the owner's SQL result,
   - `HelpCircle` and `MoreHorizontal` (fallbacks used in code).
2. Create `src/lib/categoryIconRegistry.ts`:
   ```ts
   import type { LucideIcon } from 'lucide-react-native';
   import Utensils from 'lucide-react-native/icons/utensils';
   // ...one import per name, file stem found the same way as OPT-01...
   /** Every icon a category can use, by the name stored in the database. Add new picker icons here. */
   export const CATEGORY_ICONS: Readonly<Record<string, LucideIcon>> = {
     Utensils,
     // ... same keys as the stored names (the OLD names, e.g. 'Home', not 'House') ...
   };
   ```
   **Keys must be the exact strings stored in the database**, including old alias names like `Home`, `BarChart2`.
3. `src/lib/iconUtils.ts`: replace the `import * as LucideIcons` and the body with
   ```ts
   import HelpCircle from 'lucide-react-native/icons/circle-question-mark'; // verify stem in the barrel file
   import { CATEGORY_ICONS } from './categoryIconRegistry';
   export const getCategoryIcon = (iconName: string): IconComponent =>
     (CATEGORY_ICONS[iconName] as unknown as IconComponent) ?? (HelpCircle as unknown as IconComponent);
   ```
   (Look up `HelpCircle`'s real file stem in the barrel; do not trust the comment above.)
4. `src/screens/AddEditCategoryScreen.tsx`: replace both `(LucideIcons as any)[name] || MoreHorizontal` lookups with
   `CATEGORY_ICONS[name] ?? MoreHorizontal`. Remove the `import * as LucideIcons`. Keep `ICONS_GRID` /
   `INCOME_ICONS_GRID` exactly as they are.
5. New test `tests/categoryIconRegistry.test.ts`: every name in `ICONS_GRID`, `INCOME_ICONS_GRID` (export them for the
   test, or copy the arrays into the test with a comment that they must match), every seeded name, resolves to a
   non-undefined component in `CATEGORY_ICONS`.
6. Add to `AGENTS.md` (conventions section): "New category picker icon → add it to `src/lib/categoryIconRegistry.ts`
   too, or it will show as a question mark."

**Acceptance:** `grep -rn "import \* as .* from 'lucide-react-native'" src` → nothing. M2 shows `lucide-react-native`
shrinks to roughly the size of the ~80 icons used.

**Check on device:** Manage Categories (both Expense and Income tabs), Add Category grid, every Home/History row icon,
category chips in the expense form, Insights category list.

---

### OPT-03. Import date-fns functions one by one
**Status:** ✅ Done 23 Oct 2026 — Rewrote 44 source files in `src/` and 17 test suites in `tests/` to single-function date-fns imports; Metro modules dropped from 2,309 to 2,074 (-235 modules), Hermes bytecode dropped from 6.24 MB to 6.01 MB (-237 KB / cumulative -2.06 MB / -25.5% from baseline).

**Problem found:** 44 files do `import { format, parseISO, ... } from 'date-fns'`. Same issue as Lucide: the
`date-fns` barrel pulls ~250 functions into the bundle; the app uses maybe 30.

**Fix:** `date-fns` v3 ships one file per function with official sub-path exports.
```ts
// before
import { format, parseISO, addDays } from 'date-fns';
// after
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
```
- Sub-path name = function name exactly (camelCase), e.g. `date-fns/differenceInCalendarDays`, `date-fns/startOfWeek`.
- Types: `import type { Interval, Locale } from 'date-fns';` stays on the barrel (erased).
- Locales (if any): `import { enIN } from 'date-fns/locale/en-IN';` (check the actual folder under
  `node_modules/date-fns/locale/`).
- Do it with the same throw-away-script approach as OPT-01 (map is trivial: name → `date-fns/<name>`). Include `tests/`
  only if tests import `date-fns` and you want consistency; tests do not affect the app bundle, so leaving tests alone is fine.

**Must not change:** any date result. `date-fns` deep files are the same code as the barrel.

**Acceptance:** `grep -rn "from 'date-fns'" src App.tsx | grep -v "import type"` → nothing. All tests green (the date
tests in `budgetPeriods.test.ts`, `dateFilters`, insights tests are the safety net). M2: `date-fns` shrinks.

**Check on device:** Home date label ("19–25 Oct · till today"), History date headers, Insights period labels for
Weekly / Monthly / Yearly, date picker in the expense form, Savings history dates.

---

### OPT-04. Load rarely used screens lazily
**Status:** ✅ Done 23 Oct 2026 — Moved 18 rarely used screens to `getComponent` lazy loading in `src/navigation/index.tsx`; removed top-level screen module imports so Hermes evaluates screen code on first navigation rather than at cold start. All 131 test files (1,905 tests) and `tsc --noEmit` pass.

**Problem found:** `src/navigation/index.tsx` imports all ~30 screens at the top. On cold start Hermes must run every
screen module (their top-level code, StyleSheets, imports of big helpers) before the first frame, even screens the user
may never open in this session (FAQ, AutoLog setup, Reset Password...).

**Fix:** React Navigation's `getComponent` prop. The screen module is only evaluated the first time that screen opens.

**Keep EAGER (hot path, do not touch):** `Splash`, `Onboarding`, `Auth`, `AppTabs` (and the 4 tab screens),
`AddExpense`/`EditExpense` (`ExpenseFormScreen`), `ExpenseDetail`, `Savings`.

**Make LAZY:** `ResetPassword`, `ProfileSetup`, `GullakDepositDetail`, `CategoryDetail`, `ManageCategories`,
`AddEditCategory`, `Notifications`, `Ledger`, `Profile`, `Faq`, all `AutoLog*` screens.

**How (one example, repeat for each):**
```tsx
// remove: import { FaqScreen } from '../screens/FaqScreen';
<Stack.Screen
  name="Faq"
  getComponent={() => require('../screens/FaqScreen').FaqScreen}
/>
```
- Every screen in this repo uses a **named** export (`export const FaqScreen`). Match the exact name.
- Keep every existing `options={...}` prop exactly as it is.
- Keep the `RootStackParamList` types. If TypeScript complains about the `getComponent` return type, cast:
  `getComponent={() => require('../screens/FaqScreen').FaqScreen as React.ComponentType<any>}`.
- `AutoLogGate` and anything imported by `index.ts` (background tasks) stay as they are.
- Do **not** use `React.lazy` + `Suspense` (it shows a blank frame); `getComponent` is synchronous.

**Must not change:** deep links (`linking` config), notification taps (`App.tsx` → `navigateTo(...)`), back behaviour.

**Acceptance:** M1 marks: `js_start → home_first_layout` is the same or faster. All tests green.

**Check on device:** open every lazy screen once (first open must not flash white), tap a test notification for
AutoLog review and for Notifications, open a password-reset deep link if you can.

---

### OPT-05. Run the connectivity probe and the session read at the same time (Splash)
**Status:** ✅ Done 23 Oct 2026 — Parallelized connectivity check and Supabase session check in `src/screens/SplashScreen.tsx`; results applied in original order (connectivity first, then session). Added `tests/splashParallelProbes.test.ts`. All 132 test files (1,909 tests) and `tsc --noEmit` pass.

**Problem found:** `src/screens/SplashScreen.tsx` step 1 waits up to **1.5 s** for `checkConnectivity()`, then step 2
waits up to **2 s** for `supabase.auth.getSession()`. They do not depend on each other, but run one after the other.
On a bad network the user waits up to 3.5 s before hydration even starts.

**Fix:** start both at once; apply their results in the **same order as today**.
```ts
// 1+2 together
const connectivity = Promise.race([
  useNetworkStore.getState().checkConnectivity(),
  new Promise<void>((resolve) => setTimeout(resolve, 1500)),
]).catch(() => {});
const sessionRace = Promise.race([
  supabase.auth.getSession(),
  new Promise<{ data: { session: null }; error: AuthError | Error | null }>((resolve) =>
    setTimeout(() => resolve({ data: { session: null }, error: new Error('Session timeout') }), 2000)
  ),
]).catch((e) => ({ data: { session: null }, error: e as Error, thrown: true as const }));

await connectivity;              // connectivity result is applied first, exactly as before
let activeUser: User | null = null;
const res = await sessionRace;   // then the session result
if ('thrown' in res) {
  useNetworkStore.getState().setOffline(true);
} else if (res.data?.session) {
  await setSession(res.data.session);
  activeUser = res.data.session.user;
} else if (res.error && isNetworkFailure(res.error)) {
  useNetworkStore.getState().setOffline(true);
}
```
**Why the order matters:** today, a session network error sets offline **after** the probe finished. Awaiting the
connectivity promise first keeps that exact final state.

**Must not change:** the 1.5 s and 2 s caps, step 3 (offline restore), step 4 (hydration), the 5 s cap.

**Acceptance:** M1: `session_ready` arrives earlier on slow networks (test with "Network throttling" on the device or a
weak Wi-Fi). Normal network: same or slightly faster.

**Check on device:** cold open online, cold open in airplane mode (must restore the offline session and reach Home
as before), cold open logged out (must reach Auth/Onboarding as before).

---

### OPT-06. Fetch Gullak deposits in parallel with the other budget data
**Status:** ✅ Done 23 Oct 2026 — Parallelized `gullak_deposits` query with `fetchRemoteBudgetData` in `src/store/dailyBudget/hydrate.ts`; split into `fetchGullakDepositsRaw` and `mergeGullakDeposits`. Added `tests/gullakParallelHydration.test.ts`. All 133 test files (1,913 tests) and `tsc --noEmit` pass.

**Problem found:** `src/store/dailyBudget/hydrate.ts` → `fetchRemoteBudgetData()` runs 4 queries in parallel
(profiles, daily_savings_log, budget_plan_changes, budget_periods). Then, ~200 lines later (around line 571),
`hydrateGullakDeposits()` starts a **5th** query (`gullak_deposits`) only after all the processing. That is one extra
network round trip (often 150–400 ms on Indian 4G) on every cold start and pull-to-refresh.

**Fix:** start the deposits request at the beginning; use its result at the same place as today.

1. Split `hydrateGullakDeposits` into two functions in `hydrate.ts`:
   ```ts
   /** Network part only. Same query, same 3.5 s timeout. */
   export function fetchGullakDepositsRaw(userId: string) {
     return withTimeout(
       supabase
         .from('gullak_deposits')
         .select('id, amount, date, note, source, created_at')
         .eq('user_id', userId)
         .order('created_at', { ascending: false }),
       3500,
       { data: null, error: new Error('timeout') }
     );
   }

   /** Merge part: EXACTLY the old body of hydrateGullakDeposits after the await, unchanged. */
   export async function mergeGullakDeposits(
     userId: string,
     localDeposits: GullakDeposit[],
     raw: Awaited<ReturnType<typeof fetchGullakDepositsRaw>>
   ): Promise<GullakDeposit[]> { /* old code: mapping, missingOnServer upload, sort */ }

   /** Kept for any other caller: same behaviour as before. */
   export async function hydrateGullakDeposits(userId: string, localDeposits: GullakDeposit[]) {
     try { return await mergeGullakDeposits(userId, localDeposits, await fetchGullakDepositsRaw(userId)); }
     catch (depErr) { if (__DEV__) console.log('Error hydrating gullak_deposits from Supabase:', depErr); return localDeposits || []; }
   }
   ```
   Keep the existing `try/catch` behaviour: on any error the result is `localDeposits` (as today).
2. In the hydrate function, right before `const { profileData, logsData, plansData, periodsData } = await fetchRemoteBudgetData(userId);`
   add: `const depositsRawPromise = fetchGullakDepositsRaw(userId).catch((e) => ({ data: null, error: e }));`
3. At the old line `const resolvedDeposits = await hydrateGullakDeposits(userId, get().gullakDeposits || []);` use:
   ```ts
   let resolvedDeposits: GullakDeposit[];
   try {
     resolvedDeposits = await mergeGullakDeposits(userId, get().gullakDeposits || [], await depositsRawPromise);
   } catch (depErr) {
     if (__DEV__) console.log('Error hydrating gullak_deposits from Supabase:', depErr);
     resolvedDeposits = get().gullakDeposits || [];
   }
   ```
   **Important:** `get().gullakDeposits` must still be read at this point (not at the start), so a deposit the user
   added while hydration ran is not lost. That is the same as today.

**Must not change:** the query, the timeout, the merge, the upload of `missingOnServer`, the sort. This is money data:
the existing tests (`gullakReconciliation`, hydrate tests) must pass untouched. Add one test: with a mocked supabase,
`hydrateFromSupabase` calls `from('gullak_deposits')` **before** awaiting the other four (assert call order with
`vi.fn` mocks), and the final `gullakDeposits` equals the old result for the same inputs.

**Check on device:** cold open → Savings shows the same Gullak total and history as before; add a deposit, kill app,
reopen → still there; airplane mode cold open → local deposits shown.

---

### OPT-07. ⚠️ OWNER GATE — Show Home from cache, refresh behind it
**Status:** ⏸️ Deferred by owner (23 Oct 2026) — Deferred to be revisited after Phase 2–6. Requires canonical rule update (`ROL-*`, `BUD-*` rules) and rollover/Gullak write guards before building.

**Problem found:** `SplashScreen.tsx` step 4 waits for the whole hydration chain (`loadPendingExpenses` →
`fetchCategories` → `fetchExpenses` + `hydrateFromSupabase` + `appLock.init`), capped at 5 s, before it navigates.
On good internet that is a few hundred ms; on bad internet the user stares at the splash for up to 5 s, even though the
stores already hold cached data (expense cache, persisted daily-budget state, cached categories) from the last session.

**Proposed fix:** navigate to Home as soon as the **cached** data is in the stores, and let the network refresh finish
while Home is visible (Home updates when fresh data arrives). Typical cold open on any network → about the splash
animation time (~1.5 s).

**Why gated (behaviour change):**
- Home may first show cached numbers and change a moment later.
- Day rollover, auto-renew and Gullak writes must **never** run on stale daily records (`ROL-*`, `BUD-*` rules). The safe
  version must block rollover / auto-renew / Gullak writes until `useDailyBudgetStore.getState().hydratedForUserId === user.id`
  (this flag already exists), and run them right after hydration completes.
- Needs a written rule in `docs/ARTHIK_CANONICAL_RULES.md` first.

**Do not build** until the owner says yes and the rule is added. Leave this entry as a reminder.

---

## Phase 2 — Animations off the JS thread

**Background (read once):** an `Animated` animation with `useNativeDriver: false` is computed on the **JS thread** every
frame. When the JS thread is busy (a fetch finishes, the waterfall recomputes, a screen mounts) those frames are late →
visible stutter. Reanimated runs the animation on the **UI thread**, so it stays smooth even when JS is busy.
Apple, Google and every big app keep all motion on the UI/render thread for this reason.

Rule for every task in this phase: **same duration, same easing, same start and end values, same trigger.**
Only the engine changes. Use the tables in §0.6.

Found today (`grep -rn "useNativeDriver: false" src`):
| File | Count |
|---|---|
| `src/hooks/useFormKeyboard.ts` | 4 |
| `src/screens/insights/PeriodNavigator.tsx` | 2 |
| `src/components/PullToHistoryList.tsx` | 2 |
| `src/components/BottomNavBar.tsx` | 1 |
| `src/screens/SavingsScreen.tsx` | 1 |
| `src/components/AnimatedCategoryDonut.tsx` | 1 |
| `src/screens/ExpenseFormScreen.tsx` | 1 |

Plus `PanResponder` (JS-thread gestures) in `PullToHistoryList.tsx`, `InsightsScreen.tsx`, `ExpenseFormScreen.tsx`.

### OPT-10. Bottom nav tab capsule → Reanimated
**Status:** ✅ Done 23 Oct 2026 — Ported CapsuleTabItem and AnimatedIcon from JS-thread Animated (useNativeDriver: false) to UI-thread Reanimated worklets (withTiming 180ms cubic); added tests/bottomNavBarReanimated.test.ts; all 134 test files (1,917 tests) and tsc pass.
**File:** `src/components/BottomNavBar.tsx` → `CapsuleTabItem` (and its `AnimatedIcon`).
**Today:** `anim` (core `Animated.Value`) animates `backgroundColor`, `borderColor`, `paddingHorizontal`, label
`maxWidth`, `opacity`, `marginLeft`, optional `marginRight`, and the icon cross-fade, with `duration: 180`,
`Easing.out(Easing.cubic)`, `useNativeDriver: false`. Every tab change = 180 ms of JS-thread layout animation, at the
exact moment the new tab screen mounts (the busiest moment) → this is the "tab tap feels heavy" stutter.

**Do:**
1. `import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, interpolate, interpolateColor, Easing as REasing, Extrapolation } from 'react-native-reanimated';`
2. In `CapsuleTabItem`:
   ```ts
   const progress = useSharedValue(active ? 1 : 0);
   useEffect(() => {
     progress.value = withTiming(active ? 1 : 0, { duration: 180, easing: REasing.out(REasing.cubic) });
   }, [active]);
   const capsuleStyle = useAnimatedStyle(() => ({
     backgroundColor: interpolateColor(progress.value, [0, 1], ['rgba(184, 224, 200, 0)', activeBg]),
     borderColor: interpolateColor(progress.value, [0, 1], ['rgba(184, 224, 200, 0)', activeBorder]),
     paddingHorizontal: interpolate(progress.value, [0, 1], [7, 11], Extrapolation.CLAMP),
   }));
   const labelStyle = useAnimatedStyle(() => ({
     maxWidth: interpolate(progress.value, [0, 1], [0, labelMax], Extrapolation.CLAMP),
     opacity: interpolate(progress.value, [0, 0.35, 1], [0, 0, 1], Extrapolation.CLAMP),
     marginLeft: interpolate(progress.value, [0, 1], [0, 5], Extrapolation.CLAMP),
   }));
   const wrapperStyle = useAnimatedStyle(() =>
     activeMarginRight
       ? { marginRight: interpolate(progress.value, [0, 1], [0, activeMarginRight], Extrapolation.CLAMP) }
       : {}
   );
   ```
   where `activeBg` / `activeBorder` are the same strings as today (`isDark ? 'rgba(184, 224, 200, 0.16)' : 'rgba(184, 224, 200, 0.22)'`
   and `isDark ? 'rgba(184, 224, 200, 0.3)' : 'rgba(184, 224, 200, 0.35)'`), computed outside the worklet.
3. `AnimatedIcon`: pass `progress` and use `useAnimatedStyle(() => ({ opacity: progress.value }))` on the active layer.
4. Press scale: either keep core `Animated` with `useNativeDriver: true` (already native, fine) or move to
   `withSpring(0.92, { stiffness: 338.8, damping: 25, mass: 1 })`. Moving is optional; if you move it, move both
   press-in and press-out and the `CenterAddButton` / `IndividualAddButton` the same way.
5. Replace `AnimatedPressable` (core Animated) with `Reanimated.createAnimatedComponent(Pressable)` only for the parts
   whose style is now a Reanimated style. Never mix a core `Animated.Value` and a Reanimated style on the same view.
6. The bar-level `modeAnim` and `translateY` already use `useNativeDriver: true` → leave them.

**Must not change:** sizes (`labelMax`, `minWidth`, paddings 7→11, margin 0→5), colours, timing, haptics, which tab
is active, `pressRetentionOffset`, `hitSlop`, label font scaling (`NAV_LABEL_MAX_FONT_SCALE`).
`tests/navBarLayout.test.ts` must pass unchanged.

**Check on device:** with Perf Monitor on, tap tabs quickly back and forth while Home is loading after a cold start.
UI fps must stay ~60; capsule must look identical (record a screen video before/after, compare frame by frame).
Check both Budget (5-tab) and Pure (3-tab) bars, light/dark, largest font.

### OPT-11. Expense form keypad + save-button morph → Reanimated + RNGH
**Status:** ✅ Done 23 Oct 2026 — Ported keypad animation (height/opacity/translateY), RNGH drag gesture (manualActivation, 60fps UI worklet drag, 180ms cubic dismiss), and save button pill morph + tick spring to Reanimated worklets; eliminated JS-thread PanResponder and useNativeDriver: false across useFormKeyboard.ts and ExpenseFormScreen.tsx; added tests/expenseFormReanimated.test.ts; all 135 test files (1,922 tests) and tsc pass.
**Files:** `src/hooks/useFormKeyboard.ts`, `src/screens/ExpenseFormScreen.tsx`.
**Today:**
- `keypadAnim` (core Animated, JS thread) drives keypad `height` 0↔258, opacity (0, 0.6@0.4, 1), translateY 30→0,
  and save button `marginTop` 0↔14. Show: 220 ms out-cubic. Hide: 200 ms out-cubic. Drag-close: 180 ms out-cubic.
  Drag-cancel: spring tension 70 / friction 8.
- Height animation on the JS thread re-lays out the whole form every frame → the form jitters when the keypad opens,
  exactly when the user starts typing.
- Drag to close uses `PanResponder` (JS thread): activate when `dy > 8 && |dy| > |dx| * 1.2`; close when `dy > 30 || vy > 0.35`.
- Save morph: `morphAnim` 0→1 in 180 ms (linear default `Easing.inOut(Easing.ease)` — check the source: no easing given
  means core Animated default `Easing.inOut(Easing.ease)`), button width `buttonFullWidth → buttonHeight`, text opacity 1→0
  over 0→0.25.

**Do:**
1. `useFormKeyboard.ts`: replace `keypadAnim = useAnimatedValue(1)` with `keypad = useSharedValue(1)` and return it
   (rename in the return type: `keypad: SharedValue<number>`). Port each animation:
   - show: `keypad.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) })`
   - hide: `keypad.value = withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) }, (finished) => { if (finished) scheduleOnRN(setIsKeypadVisible, false); })`
   - drag-close: same with 180 ms.
   - drag-cancel: `withSpring(1, { stiffness: 338.8, damping: 25, mass: 1 })`.
   - `handleKeypadDrag(dy)`: today it sets the value from the finger; keep the same formula, now as `keypad.value = ...`
     (read the current formula in the file and copy it).
   Keep `isKeypadVisibleRef`, `isNoteFocusedRef`, `setIsKeypadVisible` logic exactly.
2. `ExpenseFormScreen.tsx`: replace the `keypadHeight/keypadOpacity/keypadTranslateY/saveButtonMarginTop`
   interpolations with one `useAnimatedStyle` for the keypad container and one for the save button, same input/output
   ranges and `Extrapolation.CLAMP`. Animating `height` with Reanimated runs layout on the UI thread, which is the point.
3. Replace the keypad `PanResponder` with RNGH:
   ```ts
   const keypadPan = Gesture.Pan()
     .manualActivation(true)
     .onTouchesMove((e, state) => {
       // same rule as before: dy > 8 and |dy| > |dx| * 1.2 → activate; clear horizontal → fail
       // (compute dx/dy from the first touch vs. the start point you store in onTouchesDown)
     })
     .onUpdate((e) => { if (e.translationY > 0) scheduleOnRN(handleKeypadDrag, e.translationY); })
     .onEnd((e) => { scheduleOnRN(handleKeypadDragEnd, e.translationY, e.velocityY / 1000); });
   ```
   Note `velocityY / 1000` converts px/s back to px/ms, so `handleKeypadDragEnd` keeps its `vy > 0.35` check unchanged.
   If `handleKeypadDrag` becomes a worklet that writes `keypad.value` directly, skip `scheduleOnRN` there (better).
   Wrap the same view that had `{...panResponder.panHandlers}` in `<GestureDetector gesture={keypadPan}>`.
   The app root is already wrapped in `GestureHandlerRootView` (`App.tsx`), so no extra wrapper is needed.
4. Save morph: `morph = useSharedValue(0)`; the awaited step becomes
   ```ts
   await new Promise<void>((resolve) => {
     morph.value = withTiming(1, { duration: 180, easing: Easing.inOut(Easing.ease) }, () => scheduleOnRN(resolve));
   });
   ```
   Width and text opacity via `useAnimatedStyle` with the same ranges. Tick spring: `withSpring(1, { stiffness: 356.9, damping: 19, mass: 1 })`.
   The 450 ms hold and the error reset (`morph.value = 0; tick.value = 0`) stay the same.

**Must not change:** keypad height 258, every duration, thresholds, the order "save → morph → tick → 450 ms → goBack",
haptics, error shake, the note-focus rule (keypad stays hidden while the note input is focused).
`tests/useExpenseForm.test.ts` must pass unchanged.

**Check on device:** open Add Expense → keypad slides in smoothly; tap Note → keypad hides, system keyboard shows;
tap amount → keypad returns; drag keypad down slowly (follows finger), release below 30 px (springs back), flick down
fast (closes); save an expense (morph + tick identical); save with the server failing (airplane mode → offline path) and
with a validation error (reset to normal button).

### OPT-12. Insights period dots → Reanimated
**Status:** ✅ Done 23 Oct 2026 — Ported elastic period dot indicator (slideLeft and slideWidth) from JS-thread Animated (useNativeDriver: false) to UI-thread Reanimated worklets (withSequence 130ms quad stretch + spring); added tests/periodNavigatorReanimated.test.ts; all 136 test files (1,926 tests) and tsc pass.
**File:** `src/screens/insights/PeriodNavigator.tsx`.
**Today:** `slideLeft` and `slideWidth` (JS thread). Sequence: first a 130 ms `Easing.out(Easing.quad)` stretch, then a
spring tension 100 / friction 16 to the target (`left = to * DOT_SLOT`, width back to the dot width), with
`maxStretch = 16 + distance * DOT_SLOT`.
**Do:** two shared values; on index change:
```ts
left.value = withSequence(withTiming(stretchLeft, { duration: 130, easing: Easing.out(Easing.quad) }), withSpring(targetLeft, { stiffness: 447.4, damping: 49, mass: 1 }));
width.value = withSequence(withTiming(maxStretch, { duration: 130, easing: Easing.out(Easing.quad) }), withSpring(16, { stiffness: 447.4, damping: 49, mass: 1 }));
```
Copy the exact per-direction values from the existing `Animated.sequence` (it branches on `to > from`). Replace
`stopAnimation()` with `cancelAnimation(left); cancelAnimation(width);`.
**Check on device:** swipe through Weekly periods fast; dot stretch looks the same, no stutter while charts recompute.

### OPT-13. Savings progress bar → Reanimated
**Status:** ✅ Done 23 Oct 2026 — Ported Savings allowance card progress bar from JS-thread Animated (useNativeDriver: false) to UI-thread Reanimated worklets (useSharedValue, useAnimatedStyle, withTiming 500ms out-cubic); added tests/savingsProgressBarReanimated.test.ts; all 137 test files (1,930 tests) and tsc pass.
**File:** `src/screens/SavingsScreen.tsx` around `progressAnim` (500 ms, out-cubic, width as a percentage).
**Do:** `const progress = useSharedValue(0)`; in the same `useEffect`:
`progress.value = withTiming(target, { duration: 500, easing: Easing.out(Easing.cubic) })` where `target` is the same
expression as today (`cardIsOver ? 1 : Math.min(1, Math.max(0, cardProgressRatio))`).
Style: `useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }))`.
(Do not switch to `scaleX`: the bar has rounded ends and `scaleX` would squash them.)
**Check:** Savings card bar fills the same, over-budget colour same.

### OPT-14. Insights category donut sweep → `useAnimatedProps`
**Status:** ✅ Done 23 Oct 2026 — Ported category donut sweep from JS-thread Animated (useNativeDriver: false) to UI-thread Reanimated worklets (useSharedValue, useAnimatedProps withTiming 750ms bezier, scheduleOnRN); added tests/animatedCategoryDonutReanimated.test.ts; all 138 test files (1,936 tests) and tsc pass.
**File:** `src/components/AnimatedCategoryDonut.tsx` (`sweepAnim`, 750 ms, `Easing.bezier(0.25, 0.1, 0.25, 1)`, JS thread)
`centerOpacity` already uses `useNativeDriver: true` — leave it on core `Animated`, but it must stay on a different
view than any Reanimated style (never mix both systems on one view).
**Do:** copy the pattern already used in `src/components/DonutChart.tsx` and `src/hooks/useRingSweep.ts`:
a shared value swept with `withTiming(1, { duration: 750, easing: Easing.bezier(0.25, 0.1, 0.25, 1) })` and
`useAnimatedProps` per arc computing `strokeDashoffset` from it. Keep `setIsSweeping(true/false)` on the JS side using
the `withTiming` callback + `scheduleOnRN`. Keep the selected-slice logic exactly.
**Check:** Insights → donut sweeps the same on period change; tapping a slice still selects it; reduce-motion still respected
(if the file checks it today).

### OPT-15. Insights period swipe → RNGH
**Status:** ✅ Done 24 Oct 2026 — Ported Insights hero card period swipe gesture from PanResponder to RNGH Gesture.Pan with manual activation and scheduleOnRN; added tests/insightsPeriodSwipeRngh.test.ts; all 139 test files (1,941 tests) and tsc pass.
**File:** `src/screens/InsightsScreen.tsx` (`PanResponder` on the hero card).
**Today:** claim when `|dx| > 12 && |dx| > |dy| * 1.5`; on release `dx < -40 && offset < 0` → next; `dx > 40 && offset > minOff` → previous.
**Do:**
```ts
const swipe = Gesture.Pan()
  .manualActivation(true)
  .onTouchesDown((e) => { start.value = { x: e.allTouches[0].absoluteX, y: e.allTouches[0].absoluteY }; })
  .onTouchesMove((e, manager) => {
    const dx = e.allTouches[0].absoluteX - start.value.x;
    const dy = e.allTouches[0].absoluteY - start.value.y;
    if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) manager.activate();
    else if (Math.abs(dy) > 12) manager.fail(); // let the ScrollView scroll
  })
  .onEnd((e) => { scheduleOnRN(onSwipeEnd, e.translationX); });
```
`onSwipeEnd(dx)` = the existing release body (reads `navBoundsRef.current`, calls `setSelectedCategoryId(null)` and
`setOffset(...)`). Wrap the same view in `<GestureDetector gesture={swipe}>`.
Make sure the parent vertical ScrollView still scrolls: if vertical scrolling breaks, add
`.simultaneousWithExternalGesture(scrollGestureRef)` or use `Gesture.Native()` for the scroll view.
**Check:** horizontal swipe changes the period; vertical scroll on the card still scrolls the page; diagonal flicks
behave as before.

### OPT-16. ⚠️ OWNER GATE (feel review) — Pull-to-History list → RNGH + Reanimated
**Status:** ✅ Done 24 Oct 2026 — Ported PullToHistoryList from PanResponder + Animated (useNativeDriver: false) to RNGH Gesture.Pan and Reanimated worklets; workletized pullToHistoryPhysics math; updated PullToHistoryIndicator to accept SharedValue; added tests/pullToHistoryReanimated.test.ts; all 140 test files (1,946 tests) and tsc pass.
**File:** `src/components/PullToHistoryList.tsx`, physics in `src/lib/pullToHistoryPhysics.ts` (measured from Instagram,
do NOT change any constant).
**Today:** a `PanResponder` with capture rules (touch slop, "finger moving down at top is not ours"), virtual scroll
`scrollY` + `pullDepth` as core Animated values, `Animated.decay` momentum and `Animated.spring` release
(`RELEASE_SPRING` stiffness/damping/mass) — all `useNativeDriver: false`.
This is the most hand-tuned interaction in the app, so the port must be reviewed by the owner on a device.
**Do (only after Phase 2 tasks above are merged):**
- `Gesture.Pan()` with `manualActivation(true)` reproducing `onMoveShouldSetPanResponderCapture` exactly
  (`|dy| > TOUCH_SLOP && |dy| > |dx|`, and "dy > 0 while at top → fail").
- `scrollY`, `pullDepth` → shared values; every helper from `pullToHistoryPhysics.ts` called inside worklets (mark
  them `'worklet'` or copy their math into worklets; they are pure functions).
- Momentum: `withDecay({ velocity: velocityY, deceleration: MOMENTUM_DECELERATION, clamp: [0, max] })` (clamp replaces
  the manual listener that stopped at 0/max).
- Release: `withSpring(target, { stiffness: RELEASE_SPRING.stiffness, damping: RELEASE_SPRING.damping, mass: RELEASE_SPRING.mass, restDisplacementThreshold: 0.05, restSpeedThreshold: 0.05 })`.
- Commit to History (`onCommit`) via `scheduleOnRN` only after finger-up with the ring armed, as today.
- Keep the `ref` API (`reset()`) used by `HomeScreen`.
**Check on device (owner signs off):** slow pull, fast flick, pull and release just below/above `ARM_PROGRESS`,
hysteresis (no flicker), list with 1, 3, 5 items, Home in both modes, during a background fetch.

### OPT-17. Same press feel everywhere (`TouchableOpacity` → `Pressable`)
**Status:** ✅ Done 24 Oct 2026 — Created `src/components/ui/PressableOpacity.tsx` (drop-in Pressable replacement); replaced TouchableOpacity across all 22 files; grep for TouchableOpacity across src/ now returns 0; added tests/pressableOpacity.test.ts; all 141 test files (1,949 tests) and tsc pass.
**Problem found:** 22 files still use `TouchableOpacity` (JS-driven opacity, slightly different feel), the rest use
`Pressable` with native-driver scale springs. Big apps have **one** press feel across the app.
**Do:**
1. Create `src/components/ui/PressableOpacity.tsx`:
   ```tsx
   import React from 'react';
   import { Pressable, PressableProps, StyleProp, ViewStyle } from 'react-native';
   type Props = Omit<PressableProps, 'style'> & { style?: StyleProp<ViewStyle>; activeOpacity?: number };
   /** Drop-in for TouchableOpacity: same default activeOpacity (0.2), but Pressable-based. */
   export const PressableOpacity: React.FC<Props> = ({ style, activeOpacity = 0.2, ...rest }) => (
     <Pressable {...rest} style={({ pressed }) => [style, pressed && { opacity: activeOpacity }]} />
   );
   ```
2. Replace `TouchableOpacity` → `PressableOpacity` file by file, **keeping each `activeOpacity` value** that the file
   passes today (default 0.2 when none is passed). Keep `hitSlop`, `disabled`, `onPress`, `onLongPress`, accessibility props.
3. Files (from `grep -rl TouchableOpacity src`): `ErrorBoundary`, `ui/BottomSheetModal`, `SyncFailedBanner`,
   `profile/PauseBudgetModal`, `PeriodRenewalModal`, `CadenceSwitchModal`, `MoneyExplainerModal`, `BrandedHeroCard`,
   `DepositGullakModal`, `BudgetEditModal`, `SavingsRecordRow`, `WelcomeBackGapModal`, `savings/SavingsHistorySection`,
   `savings/BudgetHubSection`, `savings/SavingsHeader`, `savings/SavingsHeroCard`, `VaultSpendingGuardModal`,
   `OfflineBanner`, `screens/HomeScreen`, `screens/NotificationsScreen`, `screens/HistoryScreen`, `screens/OnboardingScreen`.
   Re-run the grep: the list must end empty.
**Must not change:** what each press does. Visual difference: none (same opacity), but the fade is instant like native
Android instead of a 150 ms JS fade. Mention that in the CHANGELOG.
**Check:** tap every button in those files once.

---

## Phase 3 — Data flow and re-renders

### OPT-20. Do not replace the expenses list when nothing changed
**Problem found:** `src/store/expenseStore.ts` → `fetchExpenses()` downloads all rows (pages of `BATCH_SIZE`), merges
pending queues, then **always** calls `set({ expenses: combined })` and **always** writes the full JSON cache to
AsyncStorage. Home calls it on focus (60 s throttle), on pull-to-refresh, on app foreground across midnight; App.tsx on
sign-in. When the server data is the same as what is on screen (the normal case), this still:
- creates a new `expenses` array → every subscriber re-renders (Home, History, Insights tab if mounted, Savings),
- Home recomputes `fullWaterfall` (the full lifetime money waterfall, the heaviest calculation in the app),
  `filtered`, totals, `spentByDate`, period summary, hero details,
- `syncWithExpenses` runs again,
- `JSON.stringify` of every expense + an AsyncStorage write (disk I/O on the JS thread).

**Fix:** keep the same array if the content is equal.
1. New pure helper `src/lib/expenseListEquality.ts`:
   ```ts
   import type { Expense } from '../types';
   /** True when both lists have the same expenses in the same order with the same field values. */
   export function sameExpenseList(a: readonly Expense[], b: readonly Expense[]): boolean {
     if (a === b) return true;
     if (a.length !== b.length) return false;
     for (let i = 0; i < a.length; i++) {
       const x = a[i] as unknown as Record<string, unknown>;
       const y = b[i] as unknown as Record<string, unknown>;
       if (x === y) continue;
       const kx = Object.keys(x); const ky = Object.keys(y);
       if (kx.length !== ky.length) return false;
       for (const k of kx) {
         const vx = x[k]; const vy = y[k];
         if (vx === vy) continue;
         if (vx && vy && typeof vx === 'object' && typeof vy === 'object') {
           if (JSON.stringify(vx) !== JSON.stringify(vy)) return false; // e.g. split_allocations
           continue;
         }
         return false;
       }
     }
     return true;
   }
   ```
2. In `fetchExpenses()`, at the line `set({ expenses: combined, isExpensesLoaded: true });` (the network-success path,
   around line 367 today):
   ```ts
   const current = get().expenses;
   if (sameExpenseList(current, combined)) {
     if (!get().isExpensesLoaded) set({ isExpensesLoaded: true });
   } else {
     set({ expenses: combined, isExpensesLoaded: true });
   }
   ```
3. Cache write right after it: keep a module-level `let lastCacheJson: string | null = null;` per user key
   (a `Map<string, string>` keyed by `getCachedStorageKey(user.id)`); compute the JSON once, write only if it differs
   from the last written JSON for that key. Clear the map entry in the store's reset (sign-out).
4. Apply the same equality guard to the **cache-load paths** (`set({ expenses: combined, isExpensesLoaded: true })`
   around lines 231 and 397 today) only if they can run while a list is already on screen. Read each call site; if in
   doubt, leave it.

**Must not change:** the content of `expenses` after a fetch (when different, it is replaced exactly as before); the
pending-queue merge; offline behaviour; the cached content.
**Tests:** new `tests/expenseListEquality.test.ts` (same list, one field changed, one row added, reordered, nested
`split_allocations` changed). Extend an existing expense-store test: two `fetchExpenses()` calls with identical mocked
rows → the `expenses` reference is the same object after the second call.
**Check on device:** go Home → History → Home repeatedly; with React DevTools Profiler (dev) Home should not re-render
from a no-change fetch. Add an expense on another device → pull to refresh → it appears (change still detected).

### OPT-21. AutoLog screens: stop subscribing to the whole store
**Files:** `src/screens/autolog/AutoLogCenterScreen.tsx` (`const s = useAutoLogStore();`) and
`src/screens/autolog/AutoLogInfoScreen.tsx` (same). A whole-store subscription re-renders the screen on **every**
change of any AutoLog field (and AutoLogCenter polls every 20 s).
**Do:** list every `s.<field>` the component reads, then
```ts
import { useShallow } from 'zustand/react/shallow';
const s = useAutoLogStore(useShallow((st) => ({ mode: st.mode, attention: st.attention, /* every field used */ })));
```
Keep the variable name `s` so the JSX does not change. Functions read from the store can be taken with
`useAutoLogStore.getState().fn` inside handlers, or added to the shallow pick.
**Check:** AutoLog Center shows the same data; "Last checked" still updates.

### OPT-22. Refresh quietly when the app comes back after a while (multi-device freshness)
**Problem found:** when the app returns to the foreground, `App.tsx` only flushes the offline queue. Home only refetches
on **focus** (tab change) or across midnight. If the user adds an expense on another device (or the web), then opens
the phone app that was in the background, Home shows old data until they pull to refresh. Google Pay, Splitwise, and
banking apps refresh on resume.
**Do (read-only refresh, no money writes):** in `src/screens/HomeScreen.tsx`, inside the existing `AppState`
`'active'` listener, after the midnight check:
```ts
const STALE_MS = 5 * 60_000;
if (Date.now() - lastFetchTime.current > STALE_MS) loadData(false);
```
`loadData(false)` already respects the 60 s throttle and calls `syncWithExpenses`, so nothing new is introduced.
Because of OPT-20, a no-change refresh costs nothing on screen. Do OPT-20 first.
**Must not change:** midnight behaviour (that branch still calls `loadData(true)`).
**Check:** background the app 6 minutes, add an expense from another device, return → appears without pulling.
Background 1 minute → no extra fetch (check the network log in dev).

### OPT-23. ⚠️ OWNER GATE — Batch AsyncStorage writes of persisted stores
**Problem found:** `dailyBudgetStore` and `notificationStore` use zustand `persist` with `createJSONStorage(() => AsyncStorage)`
and no write batching. Every `set()` serialises the **whole** store (daily records, deposits, plan changes, periods,
metrics) and writes it to disk. A single expense save triggers several sets in a row (optimistic add, sync, server
confirm, sync again) → several full serialisations on the JS thread within ~1 s.
**Proposed fix:** a storage adapter that keeps the latest value in memory and writes it to AsyncStorage after
250 ms of quiet, and **flushes immediately** when `AppState` goes to `background`/`inactive` and before sign-out.
**Why gated:** if the OS kills the app inside that 250 ms window without a background event (rare: crash, force-stop),
the very last local change is not on disk. The server copy and the offline queues (separate AsyncStorage keys, not
batched) still have it, but the owner must accept the trade-off. Do not build without a "yes".
If approved: create `src/lib/batchedStorage.ts` (getItem reads memory first, then AsyncStorage; setItem stores in memory
and schedules a write; removeItem cancels pending write and removes; `flushBatchedStorage()` exported), use it only in
`dailyBudgetStore.ts` and `notificationStore.ts` via `createJSONStorage(() => batchedStorage)`, call
`flushBatchedStorage()` in `App.tsx` `AppState` background branch and in the sign-out path before stores are reset.
Tests: write → read back from memory immediately; flush writes exactly once; remove cancels a pending write.

---

## Phase 4 — Lists

### OPT-30. History: `SectionList` → `FlashList` v2
**Problem found:** `src/screens/HistoryScreen.tsx` renders all transactions with `SectionList`
(`initialNumToRender 12`, `maxToRenderPerBatch 10`, `windowSize 21`). For accounts with 1,000+ rows, `SectionList`
mounts and keeps many row views; fast scrolling shows blank areas and memory grows. `@shopify/flash-list` **2.0.2 is
already in `package.json` and unused**. FlashList v2 is JS-only on the New Architecture (this app is RN 0.86, New
Architecture), so using it is OTA-safe. Swiggy, Zomato and Shopify use recycling lists for exactly this.

**Before you start:** re-confirm FlashList v2 has no native part (checked on 23 Oct 2026: the installed 2.0.2 has no
`android/` folder). `ls node_modules/@shopify/flash-list/android` must fail. If a future version adds one, **stop** and
tell the owner (would need an APK).

**Do:**
1. Flatten sections into one array of items:
   ```ts
   type Row =
     | { type: 'header'; key: string; section: Section }
     | { type: 'item'; key: string; item: HistoryItem; section: Section };
   const rows = useMemo<Row[]>(() => {
     const out: Row[] = [];
     for (const s of displayedSections) {
       out.push({ type: 'header', key: `h-${s.title /* use the same unique field the header uses */}`, section: s });
       for (const it of s.data) out.push({ type: 'item', key: `${it.kind}-${it.data.id}`, item: it, section: s });
     }
     return out;
   }, [displayedSections]);
   const headerIndexBySection = useMemo(() => { /* map section index -> row index */ }, [rows]);
   ```
2. Replace `<SectionList ...>` with
   ```tsx
   <FlashList
     ref={listRef}
     data={rows}
     keyExtractor={(r) => r.key}
     getItemType={(r) => r.type}
     renderItem={({ item: r }) => r.type === 'header' ? renderSectionHeader({ section: r.section }) : renderItem({ item: r.item })}
     refreshControl={<AppRefreshControl refreshing={refreshing} onRefresh={onRefresh} topOffset={0} />}
     contentContainerStyle={{ paddingBottom: navBarInset }}
     onScroll={handleScroll}
     scrollEventThrottle={32}
     ListFooterComponent={renderFooter}
     ListEmptyComponent={renderEmptyState}
     showsVerticalScrollIndicator={false}
   />
   ```
   - `renderItem` / `renderSectionHeader` today may read `section` or `index` from their args: check and pass the same.
   - FlashList v2 does not need `estimatedItemSize`. Remove `initialNumToRender`, `maxToRenderPerBatch`, `windowSize`,
     `updateCellsBatchingPeriod`, `removeClippedSubviews`, `stickySectionHeadersEnabled` (headers were not sticky).
   - `contentContainerStyle` with `flexGrow: 1` for the empty state: FlashList's content container accepts
     padding/background only. Put the empty-state height on `ListEmptyComponent` itself (e.g. a `minHeight` equal to the
     visible area) so it still centres.
3. Scroll APIs:
   - "scroll to top" (`getScrollResponder()?.scrollTo({ y: 0 })`) → `listRef.current?.scrollToOffset({ offset: 0, animated: true })`.
   - `scrollToLocation({ sectionIndex, itemIndex: 0, viewPosition: 0 })` → `listRef.current?.scrollToIndex({ index: headerIndexBySection[sectionIndex], animated: true, viewPosition: 0 })`.
   - `onScrollToIndexFailed` is not needed with FlashList (it can scroll to any index); keep the retry only if testing
     shows a failure.
4. Rows must be stable: `TransactionRow` is already `React.memo`. Make sure `renderItem` passes no new inline objects
   per render (today it is a `useCallback` — keep it).
5. Do **not** use FlashList's `onBlankArea` or other experimental props.

**Must not change:** grouping, sort order, search, category filter, Gullak rows in Budget Mode, date jump, pull to
refresh, footer, empty state text, nav-bar hide/show on scroll (`handleScroll`).
**Check on device:** an account with many transactions (owner's real account or seed 2,000 rows in a test account):
fast fling top→bottom→top (no blank rows that stay), search, filter by category, jump to a date, pull to refresh, empty
search result, light/dark. Compare memory in Android Studio profiler before/after (optional).

### OPT-31. Other long lists (only if they can be long)
Check `CategoryDetailScreen` (all transactions of one category, can be long) and `NotificationsScreen` (capped at 50
by `notificationStore`, so leave it). If `CategoryDetailScreen` uses `FlatList`/`ScrollView` + `.map` for unbounded
data, move it to `FlashList` the same way (simpler: no sections). `ManageCategoriesScreen`, `OnboardingScreen`,
`BouncyCategoryFilter` are short/horizontal lists: leave them.

---

## Phase 5 — Perceived speed and polish (big-app patterns)

### OPT-40. ⚠️ OWNER GATE — Instant save (close the form before the server answers)
**Problem found:** `useExpenseForm.handleSave` → `await addExpense(...)`. `expenseStore.addExpense` updates the list
optimistically at once (good) but then **awaits the Supabase upsert** before returning. The form shows the morph + tick
and closes only after that. On slow 4G this is 1–3 s of a spinning button, even though the expense is already in the
list and the offline queue would protect it.
Google Pay, Paytm, Splitwise, Uber close immediately and confirm in the background.
**Proposed behaviour:** after the optimistic insert, save the row to the pending queue first (same as the offline path,
`savePendingOffline`), return immediately (form morphs, ticks, closes), then upsert in the background; on success remove
it from the queue (existing sync path); on a real validation error roll back as today **and** show a toast/banner
"Couldn't save <amount> <category>. Tap to retry" that reopens the form with the data.
**Why gated:** this changes when errors are shown (after the form has closed) and touches the money write path
(`TXN-*`, `SEC-001` guard, AutoLog `reconcileExpenseSaved`). Needs the owner's yes and a canonical rule. Do not build
without it.

### OPT-41. Skeletons instead of spinners for content loading
**Problem found:** 30 `ActivityIndicator` uses. Spinners inside buttons are fine (keep: `AppButton`, save buttons,
modal confirm buttons). Spinners that replace **content** while data loads make the app feel slower than it is.
Big apps show grey placeholder shapes (skeletons) of the coming layout.
**Do:**
1. Create `src/components/ui/Skeleton.tsx`: a `View` with the theme's `cardSubtle` colour, given width/height/radius,
   with a gentle opacity pulse on the UI thread:
   `withRepeat(withSequence(withTiming(0.55, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false)`;
   if reduce motion is on (`useReducedMotion()` from Reanimated) → no pulse, static at 0.8.
2. Replace content-loading spinners (not button spinners) in: `StreakCalendarModal.tsx` (calendar grid while loading →
   7×5 grid of small rounded skeleton squares), `ProfileScreen.tsx` (if a spinner covers profile content),
   `AutoLogSetupScreen.tsx` / `AutoLogWelcomeBackScreen.tsx` (only where a spinner stands in for a list/card).
   Read each `ActivityIndicator` site and decide with this rule: *inside a button or next to a short label → keep;
   replacing a block of content → skeleton of that block's shape.*
**Must not change:** when loading starts/ends; the data shown after.

### OPT-42. Large text safety pass (accessibility, like Apple/Google review)
**Problem found:** only 9 places set `maxFontSizeMultiplier`. Users in India often set a large system font. Fixed-height
containers (pills, chips, nav, cards, keypad keys, hero amounts) can clip or overlap.
**Do:**
1. Set the device to the largest font + "Display size" largest. Walk every screen, list every clipped/overlapping text.
2. For each: if the container can grow → let it grow (remove fixed `height`, use `minHeight`). If it cannot (pill,
   chip, keypad key, nav) → `maxFontSizeMultiplier={1.3}` on that `Text` (1.15 for nav labels is already used, keep it).
   For amounts that already use `RollingText` with `fitWidth`, check they shrink correctly.
3. Never use `allowFontScaling={false}`.
**Must not change:** layout at normal font size (take screenshots at default size before/after; must be identical).

### OPT-43. One reduce-motion source
**Problem found:** `AmbientBackground.tsx` has its own `useReduceMotion()` (AccessibilityInfo), Reanimated has
`useReducedMotion()`, some animations check, some do not.
**Do:** create `src/hooks/useReduceMotion.ts` that re-exports Reanimated's `useReducedMotion` (single source), replace
the local copy in `AmbientBackground.tsx`, and for every Reanimated `withTiming/withSpring` added in Phase 2 pass
`reduceMotion: ReduceMotion.System` (Reanimated option) so the system setting is respected automatically.
**Check:** Accessibility → Remove animations ON → app still works, no stuck half-states (keypad, sheets, rings end at
their final values).

### OPT-44. Haptics map (consistency)
**Today:** `selectionAsync` ×22, `impactAsync` ×10, `notificationAsync` ×7 — mostly right. Big apps use haptics with
fixed meaning. Audit every call against this map and fix only the ones that break it:
| Event | Haptic |
|---|---|
| Tab change, pill/segment change, toggle, picker step | `selectionAsync()` (tab change today uses `impactAsync(Light)` in `BottomNavBar` — leave it, it is a deliberate choice; only note it) |
| Primary button press (+ add) | `impactAsync(Medium)` (already) |
| Save success (expense, deposit, budget) | `notificationAsync(Success)` |
| Blocked action / validation error / guard sheet | `notificationAsync(Warning)` or `(Error)` |
| Destructive confirm (delete) | `impactAsync(Heavy)` once, on confirm |
Write the final table into `docs/design-system.md` (Haptics section). Never add haptics to scroll or to every keypad key
(keypad: check what it does today and keep it).

### OPT-45. Keep "today" right while the app stays open past midnight (UI only)
**Problem found:** `HomeScreen` updates `todayKey` on focus, foreground, and pull-to-refresh. If the app is open and in
front at 23:59 and the user keeps looking at Home, it shows yesterday's "Daily" numbers until they leave and come back.
**⚠️ OWNER GATE** because a new day also triggers rollover/Gullak logic elsewhere (`ROL-*`). The safe UI-only version:
schedule a `setTimeout` to the next local midnight (+1 s) that calls the **same** code as the foreground branch
(`setTodayKey` + `loadData(true)`), re-armed after it fires, cleared on unmount and when the screen blurs (use
`useFocusEffect`). It must not call rollover functions directly; it only does what returning to the app already does.
Ask the owner before building.

### OPT-46. Design suggestion for the owner (do not build without a yes)
- **Add Expense opens from the bottom.** Today `AddExpense` uses `slide_from_right` like a detail page. Money apps
  (Google Pay "Pay", Splitwise "Add expense", Apple Wallet) open "create" flows from the bottom, which tells the user
  "this is a task, swipe down to cancel". Option: `options={{ animation: 'slide_from_bottom' }}` for `AddExpense` and
  `EditExpense` in `src/navigation/index.tsx`. Pure JS, OTA-safe. **Owner decides.**
- **Hide amounts toggle** (eye icon on the Home card, like banking apps) for use in public. New feature → owner decides.

---

## Phase 6 — Clean-up (zero risk)

### OPT-50. Delete dead files
Verify each has zero imports, then delete:
```bash
grep -rn "ui/AppInput'" src tests App.tsx        # must be empty
grep -rn "useMoneyWaterfall'" src tests App.tsx  # must be empty
git rm src/components/ui/AppInput.tsx src/hooks/useMoneyWaterfall.ts
```
Remove both from `docs/CODEBASE_GUIDE.md` and the `AGENTS.md` repo map if they are listed there.
(`src/lib/moneyWaterfall.ts` is used — keep it.)

### OPT-51. Release-build logs
Run `grep -rn "console\.\(log\|warn\|info\|debug\|error\)" src App.tsx` and open each hit. Every call must be inside
`if (__DEV__)` (directly, or the enclosing block). Known ones to check: `src/store/dailyBudget/expenseBridge.ts`
(`console.warn`), `src/lib/notificationService.ts` (`console.log` "Native module not found"), the `console.error`
calls in `planActions.ts`, `rollover.ts`, `dailyBudgetStore.ts` (Gullak insert/delete/update). Wrap only the ones
that are not guarded. Do not delete error handling, only the logging.

### OPT-52. Unused repo asset
`assets/google.png` (107 KB) is referenced nowhere (`grep -rn "google.png" .` excluding node_modules → nothing; the
Google button uses `GoogleIcon.tsx`). Delete it. **Keep** `assets/virustotal-scan.png` (used by `README.md`).

### OPT-53. Dead exports
These exports were found used nowhere in the app or tests (audit of 21 Oct 2026, re-check before touching):

| Export | File (verified 23 Oct 2026, only hit = its own definition) |
|---|---|
| `localDbExists` | `src/features/autoLog/db.ts` |
| `processNotification` | `src/features/autoLog/engine.ts` |
| `ProrationPreview` (type alias) | `src/lib/budgetModeUtils.ts` |
| `InsightTakeawayStatus` | `src/lib/insightsCommon.ts` |
| `pureDeficitBalancedCopy` | `src/lib/notificationPolicy.ts` |
| `GLYPH_STRIP` | `src/lib/rollingText.ts` |
| `knownPeopleNames` | `src/lib/splitLedger.ts` |
| `PRESS_IN_SPRING` | `src/lib/toggleMotion.ts` |
| `DailyBudgetGet`, `DailyBudgetSet` (types) | `src/store/dailyBudget/types.ts` |

**Do NOT touch** `dailyBudgetAllowanceOnDate` (`src/money/budgetAllowance.ts`) and `incomeTotalsByDateKey`
(`src/money/ledger.ts`): they are money functions and are used by tests in `tests/money/`. Keep them exported.

For each name run `grep -rn "\b<name>\b" src tests App.tsx index.ts`. If the only hit is its own definition,
remove the `export` keyword (or the whole symbol if it is unused even inside its file). If it is used anywhere, leave it
and note it in the PR.
Money-related names (`dailyBudgetAllowanceOnDate`, `incomeTotalsByDateKey`, anything in `src/money/`): remove only if
truly unreferenced, never "merge" them with similar functions.

---

## Phase 7 — ⚠️ OWNER GATE (optional) — React Compiler
**What:** React Compiler automatically memoises components and hooks at build time, removing most useless re-renders
without hand-written `useMemo`/`useCallback`. It is a Babel plugin, so it is JS-only and ships with OTA.
**Why last and gated:** it assumes components follow the Rules of React (no mutation of props/state, no reading refs
during render). Code that breaks a rule can behave differently after compilation. Arthik has money UI; one subtle
stale value is not acceptable.
**If the owner says yes:**
1. `npm i -D babel-plugin-react-compiler eslint-plugin-react-compiler` (devDependencies only).
2. Run the ESLint rule over `src` and fix or opt out (`'use no memo'` at the top of the function) every component it reports.
3. Enable in `app.json` → `"experiments": { "reactCompiler": true }` (build-time setting; check the Expo SDK 57 docs
   for the exact key and whether it is honoured by `eas update` — if it is not honoured for updates, stop).
4. Start with `sources` limited to `src/components/` (plugin option), then screens, never `src/store`/`src/money`/`src/lib`.
5. Full test suite + full manual pass of every screen in both modes.

---

## Appendix A — Things found that need a NEW APK (do NOT do them in this file)
Keep for the next native release:
- Native splash hand-off with `expo-splash-screen` (removes the last colour flash), and `app.json` splash colour
  `#F8FAF9` → `#F8F9FB` to match the theme background.
- Screenshot/recents privacy (`FLAG_SECURE` via `expo-screen-capture`) — standard for finance apps.
- `react-native-keyboard-controller` for frame-perfect keyboard + input movement.
- Crash and performance monitoring SDK (Sentry or Firebase Performance) for real-user startup and screen timings.
- Android predictive back (`predictiveBackGestureEnabled`).

## Appendix B — Already good (do not "fix")
So the agent does not waste time re-doing finished work:
- Tabs use `freezeOnBlur: true`; hidden tabs do not render or animate.
- `AmbientBackground` uses native-driver animations, stops in background and on hidden tabs, respects reduce motion.
- `BottomSheetModal` already uses RNGH + Reanimated.
- `DonutChart` + `useRingSweep` already sweep on the UI thread, blink-free.
- Home filter pills commit after the pill lands (`commitOnSettle`); History and segmented controls use `startTransition`.
- Home `fullWaterfall` is memoised separately from the pill switch.
- `syncWithExpenses` only writes when today's record really changed.
- Supabase token auto-refresh pauses in background.
- Expense add is optimistic in the list (only the form waits — see OPT-40).
- Notifications are capped at 50.
- History search is debounced.

## Appendix C — PR description template (copy for every task)
```
## OPT-XX <title>
**Problem:** <one paragraph, with the file and line>
**Change:** <what you did, file by file>
**Not changed (verified):** <list from the task's "Must not change">
**Numbers:** <M1/M2 before → after, or "n/a">
**Tests:** typecheck 0 errors · <N> files / <M> tests passing · new tests: <list>
**Device check:** <each item from "Check on device" with ✅>
**OTA-safe:** git diff shows no native files, no new dependencies, app.json only highlights
**Docs updated:** <list>
**Found, not fixed:** <anything else you noticed>
```
