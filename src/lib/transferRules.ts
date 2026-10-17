/**
 * Pure logic for self-transfer rules (canonical rule TXN-003, docs/ARTHIK_CANONICAL_RULES.md).
 * A "rule" lets the user ask Arthik to remember that a note like "HDFC to SBI savings" is a transfer
 * between their own accounts. No React / Supabase imports so everything here is unit-testable.
 */

export interface SelfTransferRule {
  id: string;
  user_id: string;
  descriptor: string;
  label?: string | null;
}

/** Stable, narrow descriptor. Never derived from the amount. Returns null when too weak to remember. */
export const normalizeTransferDescriptor = (text?: string | null): string | null => {
  const d = (text || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // Need something identifying (e.g. "hdfc to sbi 1234"); bare words/numbers are too broad.
  if (d.length < 5 || !/[a-z]/.test(d)) return null;
  return d.slice(0, 120);
};

export const findMatchingTransferRule = (
  rules: SelfTransferRule[],
  text?: string | null
): SelfTransferRule | null => {
  const d = normalizeTransferDescriptor(text);
  if (!d) return null;
  return rules.find((r) => r.descriptor === d) ?? null;
};
