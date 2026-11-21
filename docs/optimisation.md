# Arthik — Performance, Offline-Safety & Security Record

What each `OPT-*` / `SEC-*` item changed, what is still open, and what needs a new APK. Every item below is **done**;
the old step-by-step task instructions were removed on 21 Nov 2026 (they are in git history). Other docs and code
comments refer to these IDs, so the IDs never change and are never reused.

New optimisation work follows the normal rules in `AGENTS.md` (OTA-safe unless the owner approves an APK, behaviour
unchanged, tests + docs in the same change). Add a new row here when it is done.

---

## Starting point (23 Oct 2026)

Hermes bytecode 8.07 MB, 4,050 Metro modules (`lucide-react-native` 1.58 MB = 14.8 %, `date-fns` 507 KB = 4.6 %).
After Phase 1: 6.01 MB, 2,074 modules (−25.5 %). Dev-only timing marks live in `src/lib/perfMarks.ts` (M1).

## Done items

### Phase 1 — Startup and bundle size (23 Oct 2026)
| ID | What changed | Where |
|---|---|---|
| OPT-01 | Lucide icons imported one by one (`lucide-react-native/icons/<stem>`), never the barrel | 70 files; AGENTS.md §9.11 |
| OPT-02 | Category icon registry replaced the last `import *` of all icons | `src/lib/categoryIconRegistry.ts` |
| OPT-03 | `date-fns` functions imported one by one | `src/`, `tests/` |
| OPT-04 | 18 rarely used screens load on first visit (`getComponent`) | `src/navigation/index.tsx` |
| OPT-05 | Splash runs the connectivity probe and session read at the same time | `SplashScreen.tsx` (now via OPT-71) |
| OPT-06 | Gullak deposits fetched in parallel with the other budget data | `src/store/dailyBudget/hydrateRemote.ts` |

### Phase 2 — Animations off the JS thread (23–25 Oct 2026)
| ID | What changed |
|---|---|
| OPT-10 | Bottom nav capsule → Reanimated |
| OPT-11 | Add Transaction keypad, drag-to-dismiss (RNGH) and Save button morph → Reanimated |
| OPT-12 | Insights period dots → Reanimated |
| OPT-13 | Savings progress bar → Reanimated |
| OPT-14 | Insights category donut sweep → `useAnimatedProps` |
| OPT-15 | Insights period swipe → RNGH |
| OPT-16 | Pull-to-History list and its countdown ring → RNGH + Reanimated |
| OPT-17 | `TouchableOpacity` replaced everywhere by `PressableOpacity` (`src/components/ui/PressableOpacity.tsx`) |

### Phase 3 — Data flow and re-renders (24 Oct 2026)
| ID | What changed | Where |
|---|---|---|
| OPT-20 | `fetchExpenses` keeps the same list (and skips the cache write) when the server data did not change | `src/lib/expenseListEquality.ts`, `src/lib/expenseCacheMemo.ts` |
| OPT-21 | Automatic Logging Center / Info read only the fields they use (`useShallow`) | `src/screens/autolog/` |
| OPT-22 | Home refreshes quietly on resume after 5+ minutes away | `HomeScreen.tsx` |

### Phase 4 — Lists (24 Oct 2026)
| ID | What changed |
|---|---|
| OPT-30 | History uses FlashList v2 with flat header / item rows (`src/lib/historyRows.ts`) |
| OPT-31 | Category Detail (the only unbounded list) uses FlashList; the other lists are short and stay as they are |

### Phase 5 — Perceived speed and polish (24 Oct 2026)
| ID | What changed |
|---|---|
| OPT-41 | `Skeleton` (`src/components/ui/Skeleton.tsx`) used where a spinner replaced a whole card (Automatic Logging setup result); buttons and small spinners stay |
| OPT-42 | Text inside fixed-size shapes capped at 1.3x font scale (`FIXED_SHAPE_MAX_FONT_SCALE`, `src/lib/fontScale.ts`); never `allowFontScaling={false}` |
| OPT-43 | One live reduce-motion source (`src/hooks/useReduceMotion.ts`, `src/lib/reduceMotionStore.ts`) |
| OPT-44 | Haptics map audited and fixed; the map lives in `docs/design-system.md` |
| OPT-46 | Add / Edit Transaction open from the bottom (`fade_from_bottom`) |

### Phase 6 — Clean-up (24 Oct 2026)
| ID | What changed |
|---|---|
| OPT-50 | Dead files deleted (`AppInput.tsx`, `useMoneyWaterfall.ts`) |
| OPT-51 | Every `console.*` is dev-only; a guard test fails on a new one that is not |
| OPT-52 | Unused `assets/google.png` deleted |
| OPT-53 | Nine dead exports removed |

### Phase 8 — Offline safety (31 Oct 2026)
| ID | What changed | Where |
|---|---|---|
| OPT-60 | Write-ahead queue: every online add / edit / delete is queued BEFORE the request and removed only when the server confirms an unchanged entry; the form waits at most `SAVE_TIMEOUT_MS` (10 s) | `src/store/expense/pendingQueues.ts`, `mutationActions.ts` |
| OPT-61 | Queue lock: one writer per key (`runExclusive`) | `src/lib/queueLock.ts` |
| OPT-62 | Idempotent add; the on-phone copy is refreshed after a confirmed save | `mutationActions.ts`, `syncPending.ts` |
| OPT-63 | Server rows computed from expenses are written only when expenses are fresh from the server (`areExpensesFreshFromServer`) | `expenseBridge.ts`, `hydrate.ts` |
| OPT-64 | No silent 1,000-row cut (`fetchAllPages`) | `src/lib/supabasePaging.ts` |
| OPT-65 | SQL: expenses list index | `supabase/migrations/20261031120000_expenses_list_index.sql`, `schema.sql` |

### Phase 9 — Security hardening (16 Nov 2026)
| ID | What changed | Where |
|---|---|---|
| SEC-01 | Log Out removes this phone's copies of the user's server data (never the unsynced queues) | `src/lib/signOutCleanup.ts` |
| SEC-02 | Login session stored encrypted (AES-256-GCM, key in secure storage) | `src/lib/secureSessionStorage.ts`, `expoSessionCipher.ts`, `sessionCodec.ts` |
| SEC-03 | Update links trusted only inside Arthik's own GitHub repository | `src/lib/versionCheck.ts`, `src/lib/apkInstaller.ts` |
| SEC-04 | Sign-up cannot fail on a long or blank name (database only) | `supabase/migrations/20261116120000_signup_name_safety_and_expense_counter.sql` (Part 1), `schema.sql` |

### Phase 10 — Sync efficiency (16–19 Nov 2026)
| ID | What changed | Where |
|---|---|---|
| OPT-69 | Expense download skipped when the server change counter did not change (read BEFORE the download) | `src/store/expense/versionProbe.ts` |
| OPT-70 | Unique last sort key (`id`) for the paged expense download | `expenseStore.ts` (`fetchExpenses`) |
| OPT-71 | The splash opens from the phone; nothing waits for the server (`OFL-001`) | `src/lib/startupLoad.ts` |
| OPT-72 | Offline queues never lose a change: locked list changes, flushes remove only confirmed items, settings patch sent whole | `src/lib/asyncStorageList.ts`, `src/store/dailyBudget/pendingStorage.ts`, `syncPending.ts` |
| OPT-73 | Remembered self-transfer notes work offline and sync before the expense queues | `src/store/transferRulesStore.ts` |

### Phase 11 — Re-render cost and code health (20 Nov 2026)
| ID | What changed | Where |
|---|---|---|
| OPT-74 | Hidden popups keep their last store value, so they do not recompute on every expense change | `src/hooks/useStoreWhileVisible.ts`, `src/lib/whileVisibleSelector.ts` |
| OPT-75 | One money waterfall per state (reuses one of the last 4 results when every input is the same reference); `WAT-001` math untouched | `src/lib/moneyWaterfall.ts` |
| OPT-76 | History rows re-render only when they change (stable handlers) | `HistoryScreen.tsx`, `screens/history/HistoryRows.tsx` |
| OPT-77 | No whole-list stringify for a list that was already written | `src/lib/expenseCacheMemo.ts` |
| OPT-78 | Facade split of the oversized stores, libs and screens (code moved verbatim, old import paths re-exported) | ADR 0013, AGENTS.md §6.1 |

---

## Removed for good (owner decision, 31 Oct 2026)
Each could change what a user sees or what is saved. **Do not build them or suggest them again** unless the owner
brings them back:
- **OPT-07** Show Home from cache, refresh behind it (numbers would change a moment later; rollover risk).
- **OPT-23** Batch AsyncStorage writes of persisted stores (a crash in the 250 ms window could lose the last change).
- **OPT-40** Close the form before the server answers (errors would appear after the form closed). OPT-60 gives the
  safety part without changing when the form closes.
- **OPT-45** Midnight timer for "today" while the app stays open (touches the day-change path `ROL-*` depends on).
- **"Hide amounts"** toggle (a new feature, not an optimisation).
- **React Compiler** (could silently change behaviour of money screens).

## Still open
- **OPT-42 phone check:** walk every screen with the largest system font and display size; anything clipped becomes a
  new task.
- **Left as is (owner decision):** `mergeGullakDeposits` re-inserts a local deposit the server does not have, so a
  deposit deleted on another phone can come back; rollover can run on cached expenses at startup (`ROL-*`, timing
  visible); `selfHealDefaultBudget` writes `profiles.daily_budget` (legacy fix).
- **Needs a decision or a measurement first:**
  - The main bodies of History / Home / Add Transaction / Review sheet (~700–850 lines each) and `useExpenseForm`
    (~950 lines): splitting them into sub-hooks changes structure, not only location. Only with a feel review.
  - `fetchExpenses` stays in `expenseStore.ts`: its download counters are shared with `resetExpenses`.
  - The Budget Edit, Deposit, Streak, Money Explainer, Date picker and Update popups each have their own motion; one
    shared shell would change how they move.
  - Insights stays warm with ~55 memos on the expense list: profile on a real phone before changing anything.
  - `RawNotification` (`src/features/autoLog/engine.ts`) is exported but used nowhere.

## Needs a new APK (do not do in an OTA)
- Native splash hand-off with `expo-splash-screen`, and `app.json` splash colour `#F8FAF9` → `#F8F9FB` (theme background).
- Screenshot / recents privacy (`FLAG_SECURE` via `expo-screen-capture`).
- `react-native-keyboard-controller` for frame-perfect keyboard movement.
- Crash and performance monitoring SDK (Sentry or Firebase Performance).
- Android predictive back (`predictiveBackGestureEnabled` is `false` today).
- Remove the unused native `@react-native-community/datetimepicker` (no JS import; the app has `CustomDatePickerModal`)
  from `package.json` and the `app.json` plugins.
- Release shrinking: `expo-build-properties` with R8 minify + `shrinkResources`.

## Already good (do not "fix")
- Tabs use `freezeOnBlur: false` on purpose; every core tab stays warm.
- `AmbientBackground` uses native-driver animations, stops in background and on hidden tabs, respects reduce motion.
- `BottomSheetModal` uses RNGH + Reanimated.
- `DonutChart` + `useRingSweep` sweep on the UI thread; the sweep runs only on first show and on value change
  (`UX-004`, second lap `max = 2`).
- Home, Expense | Income and History pills commit only after the pill has landed (`commitOnSettle`, ADR 0020).
- Home `fullWaterfall` is memoised separately from the pill switch.
- `syncWithExpenses` writes only when today's record really changed.
- Supabase token auto-refresh pauses in background.
- Notifications are capped at 50; History search is debounced.
