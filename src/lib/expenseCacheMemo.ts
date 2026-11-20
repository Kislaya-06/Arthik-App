/**
 * Remembers the last JSON written to each expense cache key, so identical writes can be skipped.
 * Every code path that writes the expense cache must call `rememberExpenseCache` (or `forgetExpenseCache`)
 * so this memory never disagrees with what is on disk.
 *
 * It can also remember the in-memory list that JSON was made from (`source`). The store never changes a list
 * in place (every change builds a new array), so the same list reference means the same JSON: a later save
 * with the very same list skips `JSON.stringify` of the whole list. A write that does not pass its source
 * (for example the sync) clears the remembered source, so a stale reference can never skip a needed write.
 */
const lastJsonByKey = new Map<string, string>();
const lastSourceByKey = new Map<string, readonly unknown[]>();

export function isExpenseCacheUnchanged(key: string, json: string): boolean {
  return lastJsonByKey.get(key) === json;
}

/** True when `source` is the exact list the remembered JSON for `key` was made from. */
export function isExpenseSourceUnchanged(key: string, source: readonly unknown[]): boolean {
  return lastJsonByKey.has(key) && lastSourceByKey.get(key) === source;
}

export function rememberExpenseCache(key: string, json: string, source?: readonly unknown[]): void {
  lastJsonByKey.set(key, json);
  if (source) lastSourceByKey.set(key, source);
  else lastSourceByKey.delete(key);
}

export function forgetExpenseCache(key?: string): void {
  if (key === undefined) {
    lastJsonByKey.clear();
    lastSourceByKey.clear();
  } else {
    lastJsonByKey.delete(key);
    lastSourceByKey.delete(key);
  }
}
