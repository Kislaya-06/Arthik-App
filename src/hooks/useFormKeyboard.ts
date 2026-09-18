import { useRef, useState, useEffect, useCallback } from 'react';
import {
  ScrollView,
  Keyboard,
  LayoutAnimation,
  LayoutChangeEvent,
} from 'react-native';

export interface UseFormKeyboardReturn {
  scrollRef: React.RefObject<ScrollView | null>;
  isKeypadVisible: boolean;
  isKeyboardOpen: boolean;
  handleAmountPress: () => void;
  handleNoteLayout: (e: LayoutChangeEvent) => void;
  handleNoteFocus: () => void;
}

export function useFormKeyboard(): UseFormKeyboardReturn {
  const scrollRef = useRef<ScrollView>(null);
  // Tracks the Y offset of the Note section inside the ScrollView so the
  // keyboard-show listener can scroll the note field into view (edit mode
  // needs this because the category list adds extra height above the note).
  const noteSectionY = useRef(0);

  const [isKeypadVisible, setIsKeypadVisible] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // ─── Keyboard listeners ───────────────────────────────────────────────────
  // Using requestAnimationFrame so the scroll fires AFTER the layout has
  // settled (matches EditExpenseScreen behaviour — more reliable on Android).
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsKeypadVisible(false);
      setIsKeyboardOpen(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, noteSectionY.current - 10),
          animated: true,
        });
      });
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsKeypadVisible(true);
      setIsKeyboardOpen(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const handleAmountPress = useCallback(() => {
    Keyboard.dismiss();
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsKeypadVisible(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    });
  }, []);

  const handleNoteLayout = useCallback((e: LayoutChangeEvent) => {
    noteSectionY.current = e.nativeEvent.layout.y;
  }, []);

  const handleNoteFocus = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsKeypadVisible(false);
    setIsKeyboardOpen(true);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({
        y: Math.max(0, noteSectionY.current - 10),
        animated: true,
      });
    });
  }, []);

  return {
    scrollRef,
    isKeypadVisible,
    isKeyboardOpen,
    handleAmountPress,
    handleNoteLayout,
    handleNoteFocus,
  };
}
