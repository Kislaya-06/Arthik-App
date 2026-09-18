# AGENTS.md

Guide for AI coding agents working on **Arthik** (personal expense + savings tracker).
Read this fully before touching code. If a rule here conflicts with a user instruction, the user wins — but say out loud which rule you are breaking and why.

---

# 1. Project Overview

Arthik is a personal finance, expense and daily-savings tracking app.

| Layer | Tech |
| --- | --- |
| Framework | React Native 0.86 + Expo SDK 57 (`expo-dev-client`, no Expo Go) |
| Language | TypeScript (`strict: true`) |
| State | Zustand (some stores use `persist` + AsyncStorage) |
| Backend | Supabase (Postgres + Auth + RLS) |
| Navigation | React Navigation (native-stack + bottom-tabs) |
| Dates | `date-fns` |
| Icons / Charts | `lucide-react-native`, `react-native-svg` |
| Fonts | Quicksand via `@expo-google-fonts/quicksand` |
| Updates | `expo-updates` (EAS Update, OTA) |
| Offline | `@react-native-community/netinfo` + AsyncStorage pending queues |

Android is the only shipped platform today (package `com.kislaya_agarwal.arthik`). iOS config exists but is untested — do not claim iOS support.

Follow the existing architecture, patterns and conventions. This codebase is opinionated; match it instead of importing habits from elsewhere.

---

# 2. Repository Map

Know where things live before you grep blindly.

```
App.tsx                 # fonts, theme boot, OTA update listener, network listener, deep links
index.ts                # entry
app.json                # expo config: version, runtimeVersion, updates URL, android perms, extra.*
eas.json                # build profiles: development | preview | production
schema.sql              # full Supabase DDL + RLS policies (source of truth for DB)
CHANGELOG.md            # user-facing change log — keep it updated
src/
├── components/   BottomNavBar, CustomDatePickerModal, KeyButton, ErrorBoundary,
│                 OfflineBanner, SyncFailedBanner, StreakCalendarModal, GoogleIcon, PiggyBankCoinIcon
├── config/       supabase.ts (client + env), theme.ts (LightColors / DarkColors)
├── hooks/        useScrollDirection.ts
├── lib/          formatters.ts, paymentUtils.ts, iconUtils.ts,
│                 notificationService.ts, authLinkHandler.ts
├── navigation/   index.tsx (Root stack + tabs), navigationRef.ts
├── screens/      Splash, Onboarding, Auth, ProfileSetup, Home, History, Insights,
│                 Savings, ExpenseForm (add+edit), ExpenseDetail, CategoryDetail,
│                 ManageCategories, AddEditCategory, Notifications, Profile, ResetPassword
├── store/        authStore, expenseStore, categoryStore, dailyBudgetStore,
│                 notificationStore, networkStore, navBarStore, themeStore
└── types/        index.ts (RootStackParamList, TabParamList)
```

**Hot files** — heavy, high blast-radius, read fully before editing:
`src/store/dailyBudgetStore.ts` (~1.1k lines), `src/store/expenseStore.ts` (~1.1k), `src/screens/ExpenseFormScreen.tsx` (~1.2k), `src/screens/SavingsScreen.tsx` (~1.3k), `src/screens/HomeScreen.tsx` (~1.1k).

---

# 3. Commands

```bash
npm install                      # install
npm run dev                      # adb reverse + expo start (dev client)
npm run android                  # adb reverse + expo start --android
npx tsc --noEmit                 # THE type check — run after every change
```

There is **no ESLint, no Prettier, no test runner** in this repo. Do not invent `npm run lint` or `npm test` and do not claim you ran them. `npx tsc --noEmit` plus a manual trace is the check.

Do not add a test framework, linter or formatter unless explicitly asked.

---

# 4. Expo Version & Documentation

When touching Expo/React Native APIs, native modules, `app.json`, plugins or build config, consult the exact versioned docs for **Expo SDK 57**: <https://docs.expo.dev/versions/v57.0.0/>

For pure UI, styling, text or app-level logic changes, skipping the docs is fine.

Installed Expo modules: `expo-auth-session`, `expo-constants`, `expo-crypto`, `expo-dev-client`, `expo-font`, `expo-linking`, `expo-notifications`, `expo-status-bar`, `expo-updates`, `expo-web-browser`.

---

# 5. Project Understanding

Before writing any code, understand the problem and the code it touches.

1. Read the task carefully.
2. Read the relevant files and understand the existing implementation.
3. Trace the real flow end to end (UI → store action → Supabase/AsyncStorage → back into state).
4. Identify the existing data flow and dependencies.
5. Check existing components, hooks, stores, utilities and patterns.
6. Reuse existing code wherever possible.
7. Do not assume a file, feature or dependency exists. Verify it first.
8. Make the smallest change that solves the actual problem.

The smallest change in the wrong place isn't lazy, it's a second bug.

---

# 6. Architecture Rules

## 6.1 Existing Code First

- Reuse existing Zustand stores, hooks, utilities and components.
- Do not introduce a new state management pattern without explicit approval.
- Do not duplicate existing business logic.
- Keep UI, business logic and data access separated the way the project already does it: screens render + call store actions; stores own Supabase calls, AsyncStorage and derived state; `lib/` holds pure helpers.
- Cross-store wiring in this repo is done through explicit registration callbacks (`registerSyncCallback`, `registerExpenseGetter`, `registerStoreResetCallback`). Follow that pattern instead of importing stores in circles.

## 6.2 Dependencies

- No new dependency if it can be avoided.
- Use an already-installed dependency if it solves the problem.
- Nothing new for what the stdlib, the native platform or an existing dependency already covers (dates → `date-fns`, icons → `lucide-react-native`, charts → `react-native-svg`, storage → AsyncStorage).
- Any new dependency with native code forces a new APK build. Say so before adding one.
- Do not bump versions, run `expo upgrade` or edit `package-lock.json` unless the task is the upgrade itself.

## 6.3 Supabase & Data Access

- `schema.sql` is the source of truth for the database. If a change needs new columns/tables, update `schema.sql` in the same change and hand over the SQL for the user to run in the Supabase SQL Editor — agents cannot migrate the live DB.
- Every table is protected by **RLS** scoped to `auth.uid()`. Every insert/update must carry the correct `user_id`; never write a query that assumes RLS is off.
- Only the **anon** key is used client-side (`Constants.expoConfig.extra` with `EXPO_PUBLIC_*` env fallback). Never put a service-role key or any secret in the app bundle, `app.json` or a committed `.env`.
- Do not change schema or Supabase logic unless explicitly requested.
- Preserve existing data-access and sync patterns; do not duplicate fetching logic.

---

# 7. Offline-First & Sync Invariants

This is the most fragile part of the app. Treat it as load-bearing.

- Writes made while offline go into per-user AsyncStorage queues: `@arthik_pending_expenses_<userId>`, `@arthik_pending_updates_<userId>`, `@arthik_pending_deletes_<userId>`, with failures parked in `@arthik_failed_sync_<userId>`.
- Optimistic rows are marked `pending: true`. Any new UI that lists expenses must handle the pending state and not treat a local id as a server id.
- `networkStore` owns connectivity + banner state and calls the registered sync callback on reconnect. `OfflineBanner` and `SyncFailedBanner` are the only UI for this — reuse them.
- If you change the shape of a queued item, you must handle items already sitting in storage from an older app version. Migrate or defensively parse; never crash on an old payload.
- Never silently drop a queued item. A failed sync goes to the failed list where the user can retry or discard.
- On sign-out, every store must reset (`resetCategories`, `resetExpenses`, budget/notification state). Adding a new store with user data means adding it to the reset path — otherwise the next account sees the previous user's data.

---

# 8. Dates, Money & Formatting

- Store and compare dates as `yyyy-MM-dd` strings. Parse with `parseISO`, never `new Date('...')` — raw parsing shifts the day across timezones.
- Use `date-fns` (`format`, `isToday`, `isYesterday`, `subDays`) instead of hand-rolled date math.
- Render money only through `formatCurrency` / `formatAmountWithCommas` from `src/lib/formatters.ts` (Indian grouping, `₹`). Do not inline `toLocaleString` in a screen.
- Keep amounts as numbers in state; the keypad holds a raw string and converts once.
- "Today" in this app means the user's local day. Daily budget/streak logic depends on it — changing a boundary changes the user's savings history, so trace `dailyBudgetStore` before touching it.

---

# 9. UI Styling Rules

## 9.1 Theme

- All colours come from `src/config/theme.ts` (`LightColors` / `DarkColors`) via `themeStore`. No new hardcoded hex in screens — if a shade is missing, add it to `ThemeColors` so both themes stay in sync.
- Brand accents: mint green `#B8E0C8` (primary/positive), peach coral `#F4B8AE` (secondary/spending), navy `#1A2B4C` / `#0B111E` surfaces.
- Verify **both light and dark** whenever a screen changes.

## 9.2 Design Language

- Pill/stadium shapes (`borderRadius: 9999`) for interactive controls; form rows at `height: 56`, primary CTAs at `height: 60`, `fontSize: 18`, `Quicksand_700Bold`.
- Spacing rhythm between form blocks is `16`.
- Typography is Quicksand only (`Quicksand_400Regular/500Medium/600SemiBold/700Bold`). No system fonts (monospace is permitted for developer-facing diagnostic output rendered under `__DEV__`, such as the stack trace in `ErrorBoundary`).
- Reuse existing components and animation physics (spring `tension: 70, friction: 8`, `extrapolate: 'clamp'` with `overflow: 'hidden'`).
- Keep layouts responsive on small screens; the expense form must stay fully visible without scroll-jank.

## 9.3 Currency Symbol Alignment

When a large amount sits next to a smaller `₹`, use `alignItems: 'center'` on the wrapping `flexDirection: 'row'` container. Do **not** use `alignItems: 'flex-end'` or bottom margins on the symbol — it sinks and looks misaligned.

## 9.4 Safe Area Insets

Always use `useSafeAreaInsets` from `react-native-safe-area-context` (e.g. `paddingTop: insets.top`). Never hardcode `marginTop: 56` and never use `SafeAreaView` from `react-native`.

## 9.5 Navigation

- Every route is typed in `src/types/index.ts` (`RootStackParamList`, `TabParamList`). A new screen means a new entry there — no untyped `navigate('X' as any)`.
- Imperative navigation goes through `navigationRef`.
- Guard back buttons with `navigation.canGoBack()`.
- `BottomNavBar` is a custom floating capsule bar driven by `navBarStore` + `useScrollDirection`. Don't replace it with stock tab bar styling.

---

# 10. Notifications

- Local notifications go through `src/lib/notificationService.ts` and `notificationStore`; Android permissions (`POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `VIBRATE`) are already declared in `app.json`.
- Ask for permission at a moment that makes sense, handle denial without breaking the flow, and never schedule a notification loop that can fire repeatedly on re-render.

---

# 11. Deployment, Versioning & OTA Updates

Arthik ships as a direct APK via **EAS Build**, patched via **EAS Update**.

## 11.1 Build profiles (`eas.json`)

| Profile | Use | Output |
| --- | --- | --- |
| `development` | dev client for emulator/device debugging | debug APK |
| `preview` | internal test / distributed APK, channel `preview` | APK |
| `production` | store-style release, channel `production`, auto-increments | AAB |

## 11.2 Full APK build — required when

- native code, a new native plugin, or a dependency with native code changes
- `app.json` changes (package name, permissions, plugins, splash, icon)
- the app version changes

```bash
eas build -p android --profile preview
```

## 11.3 OTA update — JS/TS, UI and logic only

```bash
eas update --branch preview --message "Your update description"
```

## 11.4 Version rules (easy to get wrong)

- `runtimeVersion.policy` is `appVersion`. An OTA only reaches devices running the **same** `expo.version`. So: bump `app.json` `expo.version` **only** when you intend to cut a new binary, and keep `package.json` `version` in step. Bumping the version and then pushing an OTA ships an update nobody receives.
- Update `CHANGELOG.md` in the same change as a version bump.

## 11.5 Update listener

`App.tsx` checks for updates on launch and prompts the user to reload. Do not modify this listener unless explicitly requested.

---

# 12. Development Build & Android Emulator Workflow

## 12.1 Install a dev APK

```bash
adb install -r <path_to_apk>
adb -s emulator-5554 install -r "arthik-dev.apk"
```

Android overwrites older builds with the same package name: `com.kislaya_agarwal.arthik`.

## 12.2 Port forwarding for Metro

```bash
adb reverse tcp:8081 tcp:8081
```

## 12.3 Launch dev client & connect

```bash
adb shell am start -n com.kislaya_agarwal.arthik/.MainActivity

adb shell am start -a android.intent.action.VIEW \
  -d "arthik://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081" \
  com.kislaya_agarwal.arthik
```

## 12.4 Clean emulator state

```bash
adb uninstall host.exp.exponent        # Expo Go not used with dev client
adb shell pm clear com.kislaya_agarwal.arthik   # clears AsyncStorage + session
adb logcat *:S ReactNative:V ReactNativeJS:V    # JS logs
```

`pm clear` wipes pending offline queues too — don't suggest it while debugging a sync bug with real unsynced data.

Heavy dirt in the emulator → **Wipe Data** in Android Studio Device Manager.

---

# 13. Lazy Senior Dev Mode

You are a lazy senior developer. Lazy means efficient, not careless. The best code is the code never written.

## 13.1 Before writing any code

Stop at the first rung that holds:

1. Does this need to be built at all? (YAGNI)
2. Does it already exist in this codebase? Reuse the helper, util or pattern that's already here.
3. Does the standard library already do it? Use it.
4. Does a native platform feature cover it? Use it.
5. Does an already-installed dependency solve it? Use it.
6. Can this be one line? Make it one line.
7. Only then: write the minimum code that works.

The ladder runs after you understand the problem, not instead of it.

## 13.2 Bug fixing

Bug fix = root cause, not symptom. A report names a symptom. Grep every caller of the function you touch and fix the shared function once — one guard there is a smaller diff than one per caller, and patching only the path the ticket names leaves a sibling caller broken.

## 13.3 Code rules

- No abstractions that weren't requested. No boilerplate nobody asked for.
- Deletion over addition. Boring over clever. Fewest files possible.
- Shortest working diff wins — but only once you understand the problem.
- Question complex requests: "Do you actually need X, or does Y cover it?"
- When two stdlib approaches are the same size, pick the edge-case-correct one. Lazy means less code, not the flimsier algorithm.
- Mark deliberate simplifications with a known ceiling (naive heuristic, O(n²) scan, global lock) with a `ponytail:` comment naming the ceiling and the upgrade path.

---

# 14. Change Scope

- Modify only the files necessary for the task.
- Do not refactor unrelated code.
- Do not rename files, components, variables or functions without a reason.
- Do not change project configuration unless required.
- Do not modify working features to match personal preference.
- Never commit `.env`, keys, APKs or `node_modules`.

---

# 15. Data Integrity

- Never silently delete or overwrite user data.
- Before modifying expense, savings, budget or category logic, trace the complete data flow.
- Preserve existing offline data and sync behaviour (section 7).
- Handle loading, error, empty and offline states for every new surface.
- Destructive actions (delete expense, delete category, sign out with unsynced data) need a confirm step and must say what will be lost.
- Deleting a category must not orphan the expenses pointing at it — check the existing behaviour before changing it.
- Error handling must prevent data loss.

---

# 16. Not Lazy About

- Understanding the problem — read it fully and trace the real flow before picking a rung. A small diff you don't understand is laziness dressed up as efficiency.
- Input validation at trust boundaries (amount parsing, note length, auth forms, deep-link params in `authLinkHandler`).
- Error handling that prevents data loss.
- Security: no secrets in the bundle, no logging of tokens/emails, respect RLS.
- Accessibility: touch targets ≥ 44dp, readable contrast in both themes, labels on icon-only buttons.
- Real-device reality: clocks drift, networks flap, storage is slow, the timezone is not UTC.
- Anything explicitly requested.

Never trade security, accessibility or data integrity for a smaller diff.

---

# 17. Validation & Definition of Done

Lazy code without its check is unfinished.

Before reporting done:

1. `npx tsc --noEmit` passes — no new type errors, no broken imports.
2. Re-read the modified files top to bottom.
3. Manually verify the affected screen where possible, in **both themes**.
4. For anything touching data: check online **and** offline paths, and the empty/zero state.
5. Confirm unrelated features were not changed.
6. State plainly what was tested and what could not be tested (native builds, real-device behaviour, Supabase writes).
7. Flag if the change needs a new APK rather than an OTA (section 11.2).

Non-trivial logic leaves ONE runnable check behind — the smallest thing that fails if the logic breaks (an assert-based self-check or one small file). No frameworks, no fixtures. Trivial one-liners need no test.

---

# 18. Communication

- Always converse with the user in **Hinglish** (Roman-script Hindi + English mix). Code, comments, commit messages and this file stay in English.
- Be direct about trade-offs and about what you did not verify.
- If a request seems to conflict with a rule here, say so before writing the code, not after.

---

# 19. Commits & Changelog

- Small, focused commits. Imperative subject line, e.g. `fix(savings): stop streak resetting on timezone rollover`.
- User-visible changes get a `CHANGELOG.md` entry in the same commit.
- Never commit generated APKs, `.env` files or credentials.

---

# 20. Scope of This File

This file applies to every agent working in this repository, including work on the agent tooling and on this file itself.

---

## Agent skills

### Issue tracker

Issues and specs live as local markdown files in `.scratch/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context repo layout (`CONTEXT.md` and `docs/adr/` at repo root). See `docs/agents/domain.md`.
