# 0001. Offline-First Architecture with AsyncStorage Queues

## Context
Arthik is a personal finance app running on mobile devices in India, where network connectivity is frequently intermittent, high-latency, or completely unavailable. Users log expenses at the point of sale (e.g. paying at a grocery store or roadside stall via UPI/cash) and expect instant UI feedback (0ms latency). Waiting for a round-trip network response before reflecting a transaction causes user friction and perceived sluggishness.

## Decision
We adopted an offline-first architecture where the client-side Zustand state and per-user AsyncStorage queues serve as the primary write path, with Supabase serving as an asynchronous synchronization target.

1. **Optimistic Updates**: All mutations (`addExpense`, `updateExpense`, `deleteExpense`) update the Zustand store immediately using client-generated UUIDs (`Crypto.randomUUID()`).
2. **Persistent Queues**: If offline or if a network error occurs, mutations are serialized to disk in separate per-user queues:
   - `@arthik_pending_expenses_<userId>` for pending creates
   - `@arthik_pending_updates_<userId>` for pending updates
   - `@arthik_pending_deletes_<userId>` for pending deletes
3. **Exponential Backoff & Failure Isolation**: Background sync retries failed network calls using exponential backoff up to 5 attempts. Permanent database rejections or exhausted retries move the item to `@arthik_failed_sync_<userId>` rather than silently discarding user data.
4. **Offline Cache**: Confirmed server data is cached locally (`@arthik_cached_expenses_<userId>`) for instant cold starts without network requests.

## Consequences
- **Positive**: Transactions display immediately without network latency. The app remains fully functional offline. User data is resilient against crashes and network drops.
- **Negative**: High complexity in queue orchestration, cache reconciliation on reconnect, conflict resolution, and optimistic rollback logic. Store files become heavy and load-bearing.

## What Would Have to Be True to Revisit
We would revisit this decision only if:
- Arthik transitions to a multi-user real-time collaborative workspace where simultaneous concurrent edits to the same budget require distributed conflict resolution (CRDTs or Operational Transforms) rather than local single-user queues.
- An off-the-shelf, battle-tested local-first database library (e.g., PowerSync, WatermelonDB, ElectricSQL) is integrated that eliminates the need for manual queue management without bloating bundle size or introducing unstable native dependencies.
