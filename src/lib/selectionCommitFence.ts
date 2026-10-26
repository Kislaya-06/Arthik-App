/**
 * selectionCommitFence.ts
 *
 * The problem it solves:
 *   Pills (Home filter, Expense | Income, History categories) tell their screen about a tap only when
 *   the pill has LANDED (~300-500ms later), so the screen's heavy re-render can never freeze the glide.
 *   But a deferred value is dangerous on a form: tap "Income", then tap "Save" 200ms later, and the
 *   form would still save an EXPENSE. Real money, wrong type.
 *
 * The fix ("touch fence"):
 *   Every deferred selection registers a flush function here. The app root listens to onTouchStart.
 *   The moment ANY new touch starts somewhere else, every pending selection is delivered at once,
 *   synchronously. A button's onPress only fires on touch END, so by then React has already applied
 *   the selection and the press handler sees the new value. Nothing the user can tap can ever read a
 *   stale pill value.
 *
 *   A touch that starts on the SAME pill (rapid re-taps) is "claimed" by that pill first (touch events
 *   bubble from the pill up to the root), so re-tapping never forces an early commit mid-glide.
 *
 * No React / React Native imports: deterministic and unit-testable.
 */

type Flush = () => void;

const pending = new Map<number, Flush>();
let nextOwnerId = 1;

// The touch event (by identity) that a pill claimed, and which pill claimed it.
let claimedEvent: unknown = null;
let claimedOwner = 0;

/** A unique id for one pill instance. */
export function createFenceOwner(): number {
  return nextOwnerId++;
}

/** Register (or replace) the deferred selection of `owner`. */
export function setPendingSelection(owner: number, flush: Flush): void {
  pending.set(owner, flush);
}

/** The selection was delivered normally (or dropped): forget it. */
export function clearPendingSelection(owner: number): void {
  pending.delete(owner);
}

export function hasPendingSelection(owner?: number): boolean {
  return owner === undefined ? pending.size > 0 : pending.has(owner);
}

/** Called by a pill from its own onTouchStart, before the event reaches the app root. */
export function claimTouch(owner: number, event: unknown): void {
  claimedEvent = event ?? null;
  claimedOwner = owner;
}

/**
 * Deliver every pending selection now (except the one owned by the pill that this very touch started
 * on). Returns how many were delivered. Each flush runs at most once; one throwing flush can never stop
 * the others.
 */
export function flushPendingSelections(event?: unknown): number {
  const skipOwner = event !== undefined && event !== null && event === claimedEvent ? claimedOwner : 0;
  claimedEvent = null;
  claimedOwner = 0;
  if (pending.size === 0) return 0;

  let delivered = 0;
  for (const [owner, flush] of Array.from(pending.entries())) {
    if (owner === skipOwner) continue;
    pending.delete(owner);
    try {
      flush();
      delivered++;
    } catch (e) {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.error('[selectionCommitFence] flush failed', e);
      }
    }
  }
  return delivered;
}

/** Test helper: reset module state. */
export function __resetSelectionFenceForTests(): void {
  pending.clear();
  claimedEvent = null;
  claimedOwner = 0;
}
