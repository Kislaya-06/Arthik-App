/**
 * heroRing.ts — what the Home spent ring draws and says (UX-004). Pure, no React.
 *
 * The ring shows the REAL share of the period's money that was spent: ₹460 spent of ₹250 is 184%, never a
 * capped 100%. Display only: the numbers come from the card (spent, money of the period); nothing is re-derived.
 */

/** The ring draws at most two laps: from 200% on, the second lap is simply full. */
const MAX_LAPS = 2;
/** Above this the text no longer fits the ring. */
const MAX_PERCENT_TEXT = 999;

export interface HeroRingProgress {
  /** spent / money of the period, drawn up to 2. 1 = one full lap; 1.84 = one lap plus 84% of a second one. */
  ratio: number;
  /** Text in the middle of the ring, e.g. "184%". */
  percentLabel: string;
  /** More was spent than the period had. */
  isOver: boolean;
}

export function heroRingProgress(spent: number, available: number): HeroRingProgress {
  if (!(available > 0)) {
    // No money came in this period, so no real percent exists: spending shows one full lap, nothing shows empty.
    return spent > 0
      ? { ratio: 1, percentLabel: '100%', isOver: true }
      : { ratio: 0, percentLabel: '0%', isOver: false };
  }
  const ratio = Math.max(0, spent / available);
  const percent = Math.round(ratio * 100);
  return {
    ratio: Math.min(ratio, MAX_LAPS),
    percentLabel: percent > MAX_PERCENT_TEXT ? `${MAX_PERCENT_TEXT}%+` : `${percent}%`,
    isOver: spent > available,
  };
}
