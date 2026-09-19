import { Expense } from '../store/expenseStore';

export interface NoteSuggestionOptions {
  currentCategoryId?: string | null;
  limit?: number;
}

/**
 * Derives unique, ranked note suggestions from past expenses based on query,
 * recency, frequency, and optional category affinity.
 * Returns empty array if query is blank or only whitespace.
 */
export function getNoteSuggestions(
  expenses: Expense[],
  query = '',
  options: NoteSuggestionOptions = {}
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const limit = options.limit ?? 4;
  const currentCat = options.currentCategoryId;

  const noteStats = new Map<
    string,
    { canonical: string; count: number; lastIndex: number; hasCatMatch: boolean }
  >();

  for (let i = 0; i < expenses.length; i++) {
    const rawNote = expenses[i].note?.trim();
    if (!rawNote) continue;

    const key = rawNote.toLowerCase();
    if (key === q || !key.includes(q)) continue;

    const existing = noteStats.get(key);
    if (!existing) {
      noteStats.set(key, {
        canonical: rawNote,
        count: 1,
        lastIndex: i,
        hasCatMatch: Boolean(currentCat && expenses[i].category_id === currentCat),
      });
    } else {
      existing.count += 1;
      if (currentCat && expenses[i].category_id === currentCat) {
        existing.hasCatMatch = true;
      }
    }
  }

  const results: { canonical: string; score: number }[] = [];

  for (const [key, stat] of noteStats.entries()) {
    const matchScore = key.startsWith(q) ? 3 : 2;
    const catBonus = stat.hasCatMatch ? 2 : 0;
    const recencyBonus = Math.max(0, 5 - stat.lastIndex * 0.1);
    const score = matchScore * 10 + catBonus * 3 + stat.count * 2 + recencyBonus;

    results.push({ canonical: stat.canonical, score });
  }

  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit).map((r) => r.canonical);
}
