# 0009. Vitest Unit Test Coverage for Store & Library Seams

## Status
Accepted (September 2026).

## Context
Until v1.2.4, Arthik's test suite covered only pure library functions in `src/lib/` (formatters, budget calculations, amount keypad, date filters). This left the most failure-prone and highest blast-radius areas of the codebase completely untested:

- **Zustand store actions** with offline/online branching paths
- **Per-user AsyncStorage queue correctness** (pending creates, updates, deletes, failed sync items)
- **Multi-user isolation guards** (hydration guards, sign-out resets, per-user key scoping)
- **Cross-store callback registration correctness** (sync trigger, expense getter, category delete callback)
- **App lock biometric toggle and persistence**
- **Deep link session token parsing and validation**

The absence of tests meant that regressions in these areas (e.g. a sign-out reset leaking one user's expenses to the next account, or a rollover firing before hydration completes) were only caught by manual device testing — a slow, incomplete, and inconsistent feedback loop.

## Decision
We adopted Vitest as the unit test framework and established a test coverage policy covering all critical business-logic seams.

### Setup choices
1. **Vitest over Jest**: Vitest supports native ES modules (used by Expo SDK 57) without Babel transform configuration. It is already in the devDependencies.
2. **Node environment**: Tests run in `node` environment (`vitest.config.mjs`), not `jsdom`, because there is no DOM in React Native. RN/Expo module imports are replaced by `vi.mock()` declarations.
3. **Module aliases**: `vitest.config.mjs` defines `resolve.alias` entries for Expo and React Native modules that are not importable in Node (e.g. `expo-crypto`, `react-native`, `expo-local-authentication`).
4. **In-memory AsyncStorage**: Tests mock `@react-native-async-storage/async-storage` with a `Map<string, string>` to give deterministic, synchronous-to-the-test storage reads without hitting the filesystem.

### Testability seam pattern
Where a Zustand store action calls Supabase or AsyncStorage internally, a minimal `_set<Noun>` escape hatch is exported to allow test setup without going through the full async action:
```typescript
// Minimal: allows tests to seed state without calling real Supabase
_setExpenses: (expenses: Expense[]) => set({ expenses }),
_setCategories: (categories: Category[]) => set({ categories }),
```
These are test-only escape hatches and are not part of the public store interface used by screens.

### Coverage policy (see AGENTS.md §21.1 for full table)
Every new store action with offline branching, sync queue behavior, user isolation, or financial calculation must ship with a corresponding test file in `tests/`.

## Consequences
- **Positive**: Regressions in offline queueing, multi-user isolation, rollover guards, and income classification are caught automatically on every `npm test` run (645 ms median). Confidence to merge changes to hot store files is significantly higher.
- **Negative**: Store tests require more mock boilerplate than pure function tests. Mock setup must be kept in sync with store interfaces as action signatures evolve. The test suite covers logic paths, not native biometric hardware, live Supabase writes, or real-device AsyncStorage performance.

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- A native testing framework (Detox, Maestro) is introduced for end-to-end device testing that covers the same paths. At that point, some unit tests could be retired in favour of the higher-fidelity E2E coverage.
- The Vitest version requires significant configuration changes for future Expo SDK upgrades that cannot be resolved within the existing `vitest.config.mjs` alias approach.
