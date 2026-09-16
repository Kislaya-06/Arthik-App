import { createNavigationContainerRef, CommonActions } from '@react-navigation/native';
import { RootStackParamList } from '../types';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

/**
 * Safely navigates to any screen in the root stack navigator,
 * polling briefly if the navigation container is not yet ready.
 */
export function navigateTo<RouteName extends keyof RootStackParamList>(
  name: RouteName,
  params?: RootStackParamList[RouteName]
) {
  if (navigationRef.isReady()) {
    navigationRef.dispatch(CommonActions.navigate({ name, params }));
    return;
  }

  let attempts = 0;
  const interval = setInterval(() => {
    attempts++;
    if (navigationRef.isReady()) {
      clearInterval(interval);
      navigationRef.dispatch(CommonActions.navigate({ name, params }));
    } else if (attempts >= 30) {
      clearInterval(interval);
      if (__DEV__) console.warn('[Navigation] Could not navigate to', name, '- navigationRef never became ready');
    }
  }, 100);
}
