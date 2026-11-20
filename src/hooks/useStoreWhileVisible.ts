import { useRef } from 'react';
import { whileVisibleSelector, LastValueRef } from '../lib/whileVisibleSelector';

type BoundStore<S> = <U>(selector: (state: S) => U) => U;

/**
 * Subscribe to a store value only while a popup is visible (see src/lib/whileVisibleSelector.ts).
 * Hidden: returns the last value, so store changes do not re-render the hidden popup.
 */
export function useStoreWhileVisible<S, T>(useStore: BoundStore<S>, selector: (state: S) => T, visible: boolean): T {
  const last = useRef<LastValueRef<T>['current']>(null);
  return useStore(whileVisibleSelector(selector, visible, last));
}
