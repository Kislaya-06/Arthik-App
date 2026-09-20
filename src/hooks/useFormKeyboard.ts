import { useRef, useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Keyboard,
  Animated,
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';

export interface UseFormKeyboardReturn {
  scrollRef: React.RefObject<ScrollView | null>;
  isKeypadVisible: boolean;
  isKeyboardOpen: boolean;
  keypadAnim: Animated.Value;
  handleAmountPress: () => void;
  handleNoteLayout: (e: LayoutChangeEvent) => void;
  handleNoteFocus: () => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleScrollBeginDrag: () => void;
  showKeypad: () => void;
  hideKeypad: () => void;
}

export function useFormKeyboard(): UseFormKeyboardReturn {
  const scrollRef = useRef<ScrollView>(null);
  // Tracks the Y offset of the Note section inside the ScrollView so the
  // keyboard-show listener can scroll the note field into view.
  const noteSectionY = useRef(0);
  const lastScrollY = useRef(0);

  // Keypad animation value: 1 = fully visible, 0 = collapsed/hidden downwards
  const keypadAnim = useRef(new Animated.Value(1)).current;
  const isKeypadVisibleRef = useRef(true);
  const isKeyboardOpenRef = useRef(false);

  const [isKeypadVisible, setIsKeypadVisible] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // ─── Keypad spring animations (physics matching AGENTS.md rule 9.7) ────────
  const showKeypad = useCallback(() => {
    isKeypadVisibleRef.current = true;
    setIsKeypadVisible(true);
    Animated.spring(keypadAnim, {
      toValue: 1,
      tension: 70,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [keypadAnim]);

  const hideKeypad = useCallback(() => {
    isKeypadVisibleRef.current = false;
    setIsKeypadVisible(false);
    Animated.spring(keypadAnim, {
      toValue: 0,
      tension: 70,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [keypadAnim]);

  // ─── Keyboard listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      isKeyboardOpenRef.current = true;
      setIsKeyboardOpen(true);
      if (isKeypadVisibleRef.current) {
        hideKeypad();
      }
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      isKeyboardOpenRef.current = false;
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
    hideKeypad();
    isKeyboardOpenRef.current = true;
    setIsKeyboardOpen(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, noteSectionY.current - 10),
        animated: true,
      });
    });
  }, [hideKeypad]);

  // ─── Drag initiation listener ───────────────────────────────────────────
  // Triggers the instant the user begins touching and dragging the ScrollView,
  // regardless of drag speed (slow, gentle drags collapse keypad immediately).
  const handleScrollBeginDrag = useCallback(() => {
    if (isKeyboardOpenRef.current) {
      Keyboard.dismiss();
    }
    if (isKeypadVisibleRef.current) {
      hideKeypad();
    }
  }, [hideKeypad]);

  // ─── Scroll listener ─────────────────────────────────────────────────────
  // Collapses keypad on any downward scroll movement past the top boundary.
  // Never calls Keyboard.dismiss() directly here to prevent programmatic
  // auto-scrolls (e.g. note focus) from erroneously dismissing the keyboard.
  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const delta = currentY - lastScrollY.current;

      if (isKeypadVisibleRef.current && delta > 0.5 && currentY > 2) {
        hideKeypad();
      }

      lastScrollY.current = currentY;
    },
    [hideKeypad]
  );

  return {
    scrollRef,
    isKeypadVisible,
    isKeyboardOpen,
    keypadAnim,
    handleAmountPress,
    handleNoteLayout,
    handleNoteFocus,
    handleScroll,
    handleScrollBeginDrag,
    showKeypad,
    hideKeypad,
  };
}
