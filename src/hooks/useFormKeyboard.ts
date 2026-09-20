import { useRef, useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Keyboard,
  Animated,
  Easing,
  LayoutChangeEvent,
} from 'react-native';

export interface UseFormKeyboardReturn {
  scrollRef: React.RefObject<ScrollView | null>;
  isKeypadVisible: boolean;
  isKeyboardOpen: boolean;
  keypadAnim: Animated.Value;
  handleAmountPress: () => void;
  handleNoteLayout: (e: LayoutChangeEvent) => void;
  handleNoteFocus: () => void;
  handleNoteBlur: () => void;
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

  // Keypad animation value: 1 = fully visible, 0 = collapsed/hidden downwards
  const keypadAnim = useRef(new Animated.Value(1)).current;
  const isKeypadVisibleRef = useRef(true);
  const isKeyboardOpenRef = useRef(false);
  const isNoteFocusedRef = useRef(false);

  const [isKeypadVisible, setIsKeypadVisible] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // ─── Keypad show/hide animations ──────────────────────────────────────────
  const showKeypad = useCallback(() => {
    if (isNoteFocusedRef.current) return;
    isKeypadVisibleRef.current = true;
    setIsKeypadVisible(true);
    Animated.timing(keypadAnim, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [keypadAnim]);

  const hideKeypad = useCallback(() => {
    if (!isKeypadVisibleRef.current) return;
    isKeypadVisibleRef.current = false;
    Animated.timing(keypadAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start(({ finished }) => {
      if (finished) {
        setIsKeypadVisible(false);
      }
    });
  }, [keypadAnim]);

  const handleKeypadDrag = useCallback(
    (dy: number) => {
      if (!isKeypadVisibleRef.current) return;
      // Map drag distance down (0 to 258) to normalized progress (1 to 0)
      const progress = Math.max(0, Math.min(1, 1 - dy / 258));
      keypadAnim.setValue(progress);
    },
    [keypadAnim]
  );

  const handleKeypadDragEnd = useCallback(
    (dy: number, vy: number) => {
      if (!isKeypadVisibleRef.current) return;
      if (dy > 30 || vy > 0.35) {
        // Drag confirmed: smoothly continue closing to 0
        isKeypadVisibleRef.current = false;
        Animated.timing(keypadAnim, {
          toValue: 0,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }).start(({ finished }) => {
          if (finished) {
            setIsKeypadVisible(false);
          }
        });
      } else {
        // Drag cancelled: spring back to open using AGENTS.md 9.7 physics
        Animated.spring(keypadAnim, {
          toValue: 1,
          tension: 70,
          friction: 8,
          useNativeDriver: false,
        }).start();
      }
    },
    [keypadAnim]
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
      }
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardOpenRef.current = false;
      isNoteFocusedRef.current = false;
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

  return {
    scrollRef,
    isKeypadVisible,
    isKeyboardOpen,
    keypadAnim,
    handleAmountPress,
    handleNoteLayout,
    handleNoteFocus,
    handleNoteBlur,
    showKeypad,
    hideKeypad,
    handleKeypadDrag,
    handleKeypadDragEnd,
  };
}
