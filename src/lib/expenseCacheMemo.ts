/**
 * Remembers the last JSON written to each expense cache key, so identical writes can be skipped.
 * Every code path that writes the expense cache must call `rememberExpenseCache` (or `forgetExpenseCache`)
 * so this memory never disagrees with what is on disk.
 */
const lastJsonByKey = new Map<string, string>();

export function isExpenseCacheUnchanged(key: string, json: string): boolean {
  return lastJsonByKey.get(key) === json;
}

export function rememberExpenseCache(key: string, json: string): void {
  lastJsonByKey.set(key, json);
}

export function forgetExpenseCache(key?: string): void {
  if (key === undefined) lastJsonByKey.clear();
  else lastJsonByKey.delete(key);
}
