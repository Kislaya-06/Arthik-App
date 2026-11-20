/**
 * whileVisibleSelector.ts
 *
 * A popup that stays mounted while closed (Savings keeps BudgetEditModal / DepositGullakModal mounted, and the
 * Savings tab stays warm) still runs its store subscriptions and memos on every store change. When those read
 * the whole expense list, every expense add / edit / refresh re-ran full-history calculations for a popup
 * nobody could see.
 *
 * `whileVisibleSelector` wraps a store selector: while `visible` it returns the live value; while hidden it
 * returns the last value it returned. A store change then yields the same reference, so Zustand does not
 * re-render the hidden popup and its memos do not run. On open the live value comes back at once, and while the
 * popup is closing its numbers do not change (it keeps the last shown value).
 */
export interface LastValueRef<T> {
  current: { value: T } | null;
}

export function whileVisibleSelector<S, T>(
  selector: (state: S) => T,
  visible: boolean,
  last: LastValueRef<T>
): (state: S) => T {
  return (state: S) => {
    if (visible || last.current === null) {
      const value = selector(state);
      last.current = { value };
      return value;
    }
    return last.current.value;
  };
}
