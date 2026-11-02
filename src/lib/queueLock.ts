/**
 * Per-key async lock for AsyncStorage queues (OPT-61).
 *
 * Every offline queue (pending adds / updates / deletes) is a JSON list that is changed with
 * "read → change → write". Two of those running at the same time on the same key can lose an item
 * (the second write overwrites the first). This lock makes them run one after another, in the order
 * they were called. It never changes WHAT is written, only that writers do not overlap.
 *
 * Rules:
 * - Keep the work inside `fn` short (storage reads/writes only). Never call the network inside a lock.
 * - Never take the same key again from inside `fn` (that would wait for itself).
 * - An error inside `fn` is passed to the caller and does not block the next writer.
 */
const tails = new Map<string, Promise<unknown>>();

export function runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = tails.get(key) ?? Promise.resolve();
  const run = previous.then(() => fn());
  // The next writer waits for this one, whether it succeeded or failed.
  const tail = run.then(
    () => undefined,
    () => undefined
  );
  tails.set(key, tail);
  tail.then(() => {
    if (tails.get(key) === tail) tails.delete(key);
  });
  return run;
}
