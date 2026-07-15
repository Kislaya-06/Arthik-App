import { useRef, useCallback } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useNavBarStore } from '../store/navBarStore';
import { useFocusEffect } from '@react-navigation/native';

export function useScrollDirection() {
  const { showNavBar, hideNavBar } = useNavBarStore();
  const lastScrollY = useRef(0);
  const scrollThreshold = 15; // minimum scroll distance to trigger state change

  // Reset to visible when screen gains focus
  useFocusEffect(
    useCallback(() => {
      showNavBar();
    }, [showNavBar])
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;

      // Always show at the very top
      if (currentScrollY <= 0) {
        showNavBar();
        lastScrollY.current = currentScrollY;
        return;
      }

      const delta = currentScrollY - lastScrollY.current;

      if (delta > scrollThreshold) {
        // Scrolling down
        hideNavBar();
        lastScrollY.current = currentScrollY;
      } else if (delta < -scrollThreshold) {
        // Scrolling up
        showNavBar();
        lastScrollY.current = currentScrollY;
      }
    },
    [showNavBar, hideNavBar]
  );

  return handleScroll;
}
