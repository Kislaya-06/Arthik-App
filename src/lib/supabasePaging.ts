/**
 * OPT-64: read every row of a list query, not only the first 1,000.
 *
 * Supabase (PostgREST) returns at most 1,000 rows per request and does NOT tell you when it cut the list.
 * For a list shorter than 1,000 rows this sends ONE request that returns exactly what the query returned
 * before (same rows, same order). Only when the first page is full does it read the rest, page by page,
 * adding a unique tie-breaker column so no row is skipped or repeated between pages.
 * If any later page fails, the first page is returned, which is exactly what the app got before this change.
 */
export interface PagedResult<T> {
  data: T[] | null;
  error: unknown;
}

interface RangeQuery<T> extends PromiseLike<PagedResult<T>> {
  range: (from: number, to: number) => PromiseLike<PagedResult<T>>;
  order: (column: string, options?: { ascending?: boolean }) => RangeQuery<T>;
}

export const PAGE_SIZE = 1000;

export async function fetchAllPages<T>(
  build: () => RangeQuery<T>,
  options: { tieBreaker?: string; pageSize?: number } = {}
): Promise<PagedResult<T>> {
  const size = options.pageSize ?? PAGE_SIZE;
  const first = await build().range(0, size - 1);
  if (first.error || !first.data || first.data.length < size) return first;

  try {
    const rows: T[] = [];
    for (let from = 0; ; from += size) {
      let query = build();
      if (options.tieBreaker) query = query.order(options.tieBreaker, { ascending: true });
      const page = await query.range(from, from + size - 1);
      if (page.error || !page.data) return first;
      rows.push(...page.data);
      if (page.data.length < size) break;
    }
    return { data: rows, error: null };
  } catch {
    return first;
  }
}
