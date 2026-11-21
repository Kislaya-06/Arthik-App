import { useRef, useCallback } from 'react';
import { NativeSyntheticEvent, NativeScrollEvent } from 'react-native';
import { useNavBarStore } from '../store/navBarStore';
import { useFocusEffect } from '@react-navigation/native';

/** Within this many px of the end of the list counts as "at the end". */
const END_SLOP = 24;

export function useScrollDirection() {
  const showNavBar = useNavBarStore((s) => s.showNavBar);
  const hideNavBar = useNavBarStore((s) => s.hideNavBar);
  const lastScrollY = useRef(0);
  const scrollThreshold = 15; // minimum scroll distance to trigger state change

  // Reset to visible when screen gains focus
  useFocusEffect(
    useCallback(() => {
      if (!useNavBarStore.getState().isVisible) {
        showNavBar();
      }
    }, [showNavBar])
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const currentScrollY = event.nativeEvent.contentOffset.y;

      // Always show at the very top
      if (currentScrollY <= 0) {
        if (!useNavBarStore.getState().isVisible) {
          showNavBar();
        }
        lastScrollY.current = currentScrollY;
        return;
      }

      // Also show at the very end: after the last row there is nothing left to read, and the tabs must be reachable.
      const { contentSize, layoutMeasurement } = event.nativeEvent;
      if (contentSize && layoutMeasurement && currentScrollY + layoutMeasurement.height >= contentSize.height - END_SLOP) {
        if (!useNavBarStore.getState().isVisible) {
          showNavBar();
        }
        lastScrollY.current = currentScrollY;
        return;
      }

      const delta = currentScrollY - lastScrollY.current;

      if (delta > scrollThreshold) {
        // Scrolling down
        if (useNavBarStore.getState().isVisible) {
          hideNavBar();
        }
        lastScrollY.current = currentScrollY;
      } else if (delta < -scrollThreshold) {
        // Scrolling up
        if (!useNavBarStore.getState().isVisible) {
          showNavBar();
        }
        lastScrollY.current = currentScrollY;
      }
    },
    [showNavBar, hideNavBar]
  );

  return handleScroll;
}
