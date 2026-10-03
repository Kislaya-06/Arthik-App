import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';

/**
 * Returns `value`, but every time the screen comes into focus it first rests at 0 and then switches to the real
 * value shortly after, so a <RollingText/> / `rolling` AmountText rolls up on every visit (a tab switch does not
 * change the number by itself, so nothing would animate otherwise).
 *
 * While the screen stays focused, later changes of `value` are shown immediately (they roll by themselves).
 */
export function useRollOnFocus(value: number, delayMs = 220): number {
  const isFocused = useIsFocused();
  const [shown, setShown] = useState(0);
  const wasFocused = useRef(false);
  const entering = useRef(true);

  // Runs before the screen is painted on (re)entry: start from 0.
  useLayoutEffect(() => {
    if (isFocused && !wasFocused.current) {
      entering.current = true;
      setShown(0);
    }
    wasFocused.current = isFocused;
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused) return;
    // Wait a beat on entry (the tab transition), but follow later changes right away.
    const wait = entering.current ? delayMs : 0;
    const t = setTimeout(() => {
      entering.current = false;
      setShown(value);
    }, wait);
    return () => clearTimeout(t);
  }, [isFocused, value, delayMs]);

  return shown;
}
