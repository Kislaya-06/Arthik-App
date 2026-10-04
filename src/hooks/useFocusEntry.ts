import { useLayoutEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

/** `useIsFocused` that also works outside a navigator (always true there). */
export function useSafeIsFocused(): boolean {
  try {
    return useIsFocused();
  } catch {
    return true;
  }
}

/**
 * Counts how many times the screen has been ENTERED: once on mount, then again every time the user comes back
 * (tab switch, returning from another screen, a frozen `freezeOnBlur` tab being revealed).
 *
 * Use it as an effect dependency to replay an entrance animation on every visit.
 *
 * Why two layout effects: React re-runs LAYOUT effects (not passive ones) when a frozen tab is revealed, even though
 * no dependency changed. And a tab can be frozen without the "blurred" render ever being committed, so `isFocused`
 * alone can not tell a return from a plain re-render. The first effect forgets the previous focus on mount and on
 * every reveal; the second one then sees "focused and was not focused" and counts an entry.
 */
export function useFocusEntryCount(): number {
  const isFocused = useSafeIsFocused();
  const [count, setCount] = useState(0);
  const wasFocused = useRef(false);

  useLayoutEffect(() => {
    wasFocused.current = false;
  }, []);

  useLayoutEffect(() => {
    if (isFocused && !wasFocused.current) setCount((c) => c + 1);
    wasFocused.current = isFocused;
  }, [isFocused]);

  return count;
}
