/**
 * Merchant names → one stable key, so "Zomato", "ZOMATO LTD" and "zomato.payu" share one remembered category.
 * Pure (unit-tested in tests/autoLogHelpers.test.ts).
 */

/** Company words, payment gateways and web parts that say nothing about who was paid. */
const NOISE_WORDS = new Set([
  'ltd', 'limited', 'pvt', 'private', 'llp', 'inc', 'co', 'company', 'india', 'technologies', 'technology', 'tech',
  'services', 'service', 'solutions', 'payu', 'razorpay', 'rzp', 'cashfree', 'ccavenue', 'billdesk', 'pg', 'www', 'com', 'in',
]);

/** The key older versions saved preferences under (kept so nothing remembered is lost). */
export const legacyMerchantKey = (m: string): string => (m || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** "Zomato Private Limited" / "zomato.payu" / "www.zomato.com" → "zomato". Falls back to the old key if nothing is left. */
export const merchantKey = (m: string): string => {
  const words = (m || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w && !NOISE_WORDS.has(w) && !/^\d+$/.test(w));
  return words.join('') || legacyMerchantKey(m);
};

export interface HistoryRow {
  note?: string | null;
  category_id?: string | null;
  type?: string | null;
}

/**
 * The category the user usually gives this merchant, learned from their own entries: at least 2 entries of the
 * same type with this merchant as the note, and one category on at least 60% of them. Otherwise null (ask).
 */
export const categoryFromHistory = (rows: HistoryRow[], merchant: string | null | undefined, type: 'expense' | 'income'): string | null => {
  if (!merchant) return null;
  const key = merchantKey(merchant);
  if (!key) return null;
  const counts = new Map<string, number>();
  let total = 0;
  for (const r of rows) {
    if ((r.type || 'expense') !== type || !r.note || merchantKey(r.note) !== key) continue;
    total++;
    if (r.category_id) counts.set(r.category_id, (counts.get(r.category_id) ?? 0) + 1);
  }
  let best: [string, number] | null = null;
  for (const entry of counts) if (!best || entry[1] > best[1]) best = entry;
  if (!best || best[1] < 2 || best[1] / total < 0.6) return null;
  return best[0];
};
