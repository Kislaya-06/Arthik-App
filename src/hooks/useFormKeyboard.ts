import { useRef, useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Keyboard,
  Animated,
  Easing,
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
  handleNoteBlur: () => void;
  handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  handleScrollBeginDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  showKeypad: () => void;
  hideKeypad: () => void;
}

export function useFormKeyboard(): UseFormKeyboardReturn {
  const scrollRef = useRef<ScrollView>(null);
  // Tracks the Y offset of the Note section inside the ScrollView so the
  // keyboard-show listener can scroll the note field into view.
  const noteSectionY = useRef(0);
  const dragStartY = useRef(0);

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
    if (isKeypadVisibleRef.current) return;
    isKeypadVisibleRef.current = true;
    setIsKeypadVisible(true);
    Animated.timing(keypadAnim, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [keypadAnim]);

  const hideKeypad = useCallback(() => {
    if (!isKeypadVisibleRef.current) return;
    isKeypadVisibleRef.current = false;
    setIsKeypadVisible(false);
    Animated.timing(keypadAnim, {
      toValue: 0,
      duration: 200,
      easing: Easing.in(Easing.cubic),
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
  }, [hideKeypad]);

  const handleNoteBlur = useCallback(() => {
    isNoteFocusedRef.current = false;
  }, []);

  // ─── Scroll-driven keypad toggle ──────────────────────────────────────────
  // Scrolling down (into form fields) hides the keypad to give more room.
  // Scrolling back to top restores it.
  const handleScrollBeginDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      dragStartY.current = event.nativeEvent.contentOffset.y;
    },
    []
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentY = event.nativeEvent.contentOffset.y;
      const dragDelta = currentY - dragStartY.current;

      if (isKeypadVisibleRef.current && (dragDelta > 10 || currentY > 15)) {
        hideKeypad();
      } else if (!isKeypadVisibleRef.current && !isKeyboardOpenRef.current && !isNoteFocusedRef.current && currentY <= 5 && dragDelta < -15) {
        showKeypad();
      }
    },
    [hideKeypad, showKeypad]
  );

  return {
    scrollRef,
    isKeypadVisible,
    isKeyboardOpen,
    keypadAnim,
    handleAmountPress,
    handleNoteLayout,
    handleNoteFocus,
    handleNoteBlur,
    handleScroll,
    handleScrollBeginDrag,
    showKeypad,
    hideKeypad,
  };
}
