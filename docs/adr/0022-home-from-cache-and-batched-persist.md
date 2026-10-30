# 0022. Home From Cache and Batched Persist Writes

## Status
Accepted (30 October 2026). OTA-only (no native change, no SQL). Tasks OPT-07 and OPT-23 in `docs/optimisation.md`. Canonical rule `ROL-005`.

## Context
1. **Cold start waited for the network.** Splash waited for the whole startup chain (pending expenses, categories, expenses, budget hydration, app lock), capped at 5 s, before opening Home, although every store already held the last session's data. On a bad connection that is up to 5 s of splash.
2. **The existing hydration guard is weaker than it looks.** `checkAndRollover` and `uploadPendingDailyRecords` return unless `hydratedForUserId === user.id`. That field is saved to disk with the rest of the budget state (no `partialize`), so after a restart it is already equal to the user id before any server fetch. Showing Home early with only this guard would let a rollover finalize days, and upload them, from a copy that another device may already have changed.
3. **Every `set()` wrote the whole store.** `dailyBudgetStore` and `notificationStore` use zustand `persist`. `createJSONStorage` runs `JSON.stringify` on the whole state on EVERY `set()` and then writes it, so one expense save (optimistic add, sync, confirm, sync) serialised the same large state several times within a second.

## Decision
1. **Warm start (OPT-07).** `canShowHomeFromCache` allows it only when the saved budget state belongs to this user and was fully hydrated before, already has today's record, and the expense and category caches exist. The first open of a day, a first login and a wiped cache keep the old blocking start, so day-boundary work (`ROL-001` to `ROL-004`, Welcome Back) always runs on complete data. `startHomeFromCache` loads pending expenses, categories (cache), expenses (cache) and app lock, then returns; categories, expenses and budget hydration continue behind Home in the original order.
2. **Money-write hold (`ROL-005`).** A memory-only hold (`hydrationHold.ts`) makes `checkAndRollover`, `uploadPendingDailyRecords` and `syncPendingGullakDeposits` do nothing until the budget hydration has finished. It is released at the end of `runHydrateFromSupabase` (online: right before the normal rollover call; offline or failed: in `finally`, followed by `runHeldBackMoneyWork`) and by a 12 s watchdog. Not held (the default) = no guard does anything, so every other start is unchanged.
3. **Batched persist storage (OPT-23).** `createBatchedPersistStorage` is a zustand `PersistStorage` (it receives the state OBJECT, unlike `createJSONStorage`), keeps the newest object in memory and serialises + writes it once after 250 ms without a change, or 1.5 s after the first unwritten change. `getItem` returns the pending object first. `flushBatchedStorage()` runs when the app goes to background / inactive (`App.tsx`). Store resets call `removeBatchedItem`, which cancels a pending write.

## Consequences
- **Accepted by the owner:** if the OS kills the app inside the write window without a background event (crash, force-stop), the very last local change of these two stores is not on disk. The server copy and the offline queues (separate keys, not batched) still have it.
- The first open of every day is as slow as before on a bad connection (by design, see decision 1). Repeat opens the same day show Home in about the splash animation time.
- Home may show saved numbers first and change a moment later when the server copy differs (`ROL-005` #3).
- Sign-out needs no extra flush: the reset removes both keys and cancels any pending write.
- Tests: `tests/opt23BatchedStorage.test.ts`, `tests/opt07MoneyWritesHold.test.ts`, `tests/opt07WarmStart.test.ts`.
