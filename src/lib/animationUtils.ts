import { Platform, UIManager, LayoutAnimation, LayoutAnimationConfig } from 'react-native';

const isFabric = !!(global as any).nativeFabricUIManager;

let isExperimentalEnabled = false;

/**
 * Safely enables LayoutAnimation on Android when running in Old Architecture (Paper).
 * In New Architecture (Fabric), LayoutAnimation is supported natively and calling
 * setLayoutAnimationEnabledExperimental emits a no-op warning.
 */
export function enableLayoutAnimationOnAndroid(): void {
  if (Platform.OS === 'android' && !isFabric && !isExperimentalEnabled) {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
      try {
        UIManager.setLayoutAnimationEnabledExperimental(true);
        isExperimentalEnabled = true;
      } catch {}
    }
  }
}

/**
 * Configures the next layout animation, safely ensuring Android Old Architecture compatibility
 * without triggering no-op warnings under New Architecture.
 */
export function configureLayoutAnimation(
  config: LayoutAnimationConfig = LayoutAnimation.Presets.easeInEaseOut
): void {
  enableLayoutAnimationOnAndroid();
  LayoutAnimation.configureNext(config);
}
