import { useRef, useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Keyboard,
  LayoutChangeEvent,
} from 'react-native';
import {
  useSharedValue,
  withTiming,
  withSpring,
  Easing as REasing,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

export interface UseFormKeyboardReturn {
  scrollRef: React.RefObject<ScrollView | null>;
  isKeypadVisible: boolean;
  isKeyboardOpen: boolean;
  keypad: SharedValue<number>;
  keypadAnim: SharedValue<number>;
  handleAmountPress: () => void;
  handleNoteLayout: (e: LayoutChangeEvent) => void;
  handleNoteFocus: () => void;
  handleNoteBlur: () => void;
  handleSplitLayout: (e: LayoutChangeEvent) => void;
  handleSplitFocus: (relativeY?: number) => void;
  showKeypad: () => void;
  hideKeypad: () => void;
  handleKeypadDrag: (dy: number) => void;
  handleKeypadDragEnd: (dy: number, vy: number) => void;
}

export function useFormKeyboard(): UseFormKeyboardReturn {
  const scrollRef = useRef<ScrollView>(null);
  // Tracks the Y offset of the Note section inside the ScrollView so the
  // keyboard-show listener can scroll the note field into view.
  const noteSectionY = useRef(0);
  const splitSectionY = useRef(0);
  const activeSplitY = useRef(0);

  // Keypad animation value: 1 = fully visible, 0 = collapsed/hidden downwards
  const keypad = useSharedValue(1);
  const isKeypadVisibleRef = useRef(true);
  const isKeyboardOpenRef = useRef(false);
  const isNoteFocusedRef = useRef(false);
  const isSplitFocusedRef = useRef(false);

  const [isKeypadVisible, setIsKeypadVisible] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // ─── Keypad show/hide animations ──────────────────────────────────────────
  const showKeypad = useCallback(() => {
    if (isNoteFocusedRef.current) return;
    isKeypadVisibleRef.current = true;
    setIsKeypadVisible(true);
    keypad.value = withTiming(1, {
      duration: 220,
      easing: REasing.out(REasing.cubic),
    });
  }, [keypad]);

  const hideKeypad = useCallback(() => {
    if (!isKeypadVisibleRef.current) return;
    isKeypadVisibleRef.current = false;
    keypad.value = withTiming(
      0,
      {
        duration: 200,
        easing: REasing.out(REasing.cubic),
      },
      (finished) => {
        'worklet';
        if (finished) {
          scheduleOnRN(setIsKeypadVisible, false);
        }
      }
    );
  }, [keypad]);

  const handleKeypadDrag = useCallback(
    (dy: number) => {
      if (!isKeypadVisibleRef.current) return;
      // Map drag distance down (0 to 258) to normalized progress (1 to 0)
      const progress = Math.max(0, Math.min(1, 1 - dy / 258));
      keypad.value = progress;
    },
    [keypad]
  );

  const handleKeypadDragEnd = useCallback(
    (dy: number, vy: number) => {
      if (!isKeypadVisibleRef.current) return;
      if (dy > 30 || vy > 0.35) {
        // Drag confirmed: complete close
        isKeypadVisibleRef.current = false;
        keypad.value = withTiming(
          0,
          {
            duration: 180,
            easing: REasing.out(REasing.cubic),
          },
          (finished) => {
            'worklet';
            if (finished) {
              scheduleOnRN(setIsKeypadVisible, false);
            }
          }
        );
      } else {
        // Drag cancelled: spring back to open
        keypad.value = withSpring(1, {
          stiffness: 338.8,
          damping: 25,
          mass: 1,
        });
      }
    },
    [keypad]
  );

  // ─── Keyboard listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      isKeyboardOpenRef.current = true;
      setIsKeyboardOpen(true);
      if (isKeypadVisibleRef.current) {
        hideKeypad();
      }
      if (isNoteFocusedRef.current && noteSectionY.current > 0) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, noteSectionY.current - 12),
            animated: true,
          });
        });
      } else if (isSplitFocusedRef.current && activeSplitY.current > 0) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({
            y: Math.max(0, activeSplitY.current - 24),
            animated: true,
          });
        });
      }
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardOpenRef.current = false;
      isNoteFocusedRef.current = false;
      isSplitFocusedRef.current = false;
      setIsKeyboardOpen(false);
      // Keyboard dismissed: keep keypad collapsed so the user can easily
      // view Category, Note, Date, and Payment mode without clutter.
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, [hideKeypad]);

  // Tapping the amount display brings the keypad back and scrolls to top
  const handleAmountPress = useCallback(() => {
    isNoteFocusedRef.current = false;
    isSplitFocusedRef.current = false;
    Keyboard.dismiss();
    showKeypad();
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, [showKeypad]);

  const handleNoteLayout = useCallback((e: LayoutChangeEvent) => {
    noteSectionY.current = e.nativeEvent.layout.y;
  }, []);

  const handleNoteFocus = useCallback(() => {
    isNoteFocusedRef.current = true;
    isSplitFocusedRef.current = false;
    isKeyboardOpenRef.current = true;
    setIsKeyboardOpen(true);
    hideKeypad();
    if (noteSectionY.current > 0) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, noteSectionY.current - 12),
          animated: true,
        });
      });
    }
  }, [hideKeypad]);

  const handleNoteBlur = useCallback(() => {
    isNoteFocusedRef.current = false;
  }, []);

  const handleSplitLayout = useCallback((e: LayoutChangeEvent) => {
    splitSectionY.current = e.nativeEvent.layout.y;
  }, []);

  const handleSplitFocus = useCallback(
    (relativeY = 0) => {
      isNoteFocusedRef.current = false;
      isSplitFocusedRef.current = true;
      isKeyboardOpenRef.current = true;
      setIsKeyboardOpen(true);
      hideKeypad();
      activeSplitY.current = splitSectionY.current + relativeY;
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, activeSplitY.current - 24),
          animated: true,
        });
      });
    },
    [hideKeypad]
  );

  return {
    scrollRef,
    isKeypadVisible,
    isKeyboardOpen,
    keypad,
    keypadAnim: keypad,
    handleAmountPress,
    handleNoteLayout,
    handleNoteFocus,
    handleNoteBlur,
    handleSplitLayout,
    handleSplitFocus,
    showKeypad,
    hideKeypad,
    handleKeypadDrag,
    handleKeypadDragEnd,
  };
}
