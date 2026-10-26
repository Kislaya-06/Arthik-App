import { create } from 'zustand';
import { Alert, Keyboard } from 'react-native';

export interface AlertButton {
  text?: string;
  onPress?: (() => void | Promise<void>) | null;
  style?: 'default' | 'cancel' | 'destructive';
  isPreferred?: boolean;
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export interface AlertConfig {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  options?: AlertOptions;
}

interface AlertState {
  isOpen: boolean;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
  showAlert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  isOpen: false,
  title: '',
  message: undefined,
  buttons: [],
  options: undefined,
  showAlert: (title, message, buttons, options) => {
    try {
      Keyboard.dismiss();
    } catch {}

    const resolvedButtons: AlertButton[] =
      buttons && buttons.length > 0
        ? buttons
        : [{ text: 'OK', style: 'default' }];

    set({
      isOpen: true,
      title,
      message,
      buttons: resolvedButtons,
      options,
    });
  },
  hideAlert: () => {
    set({ isOpen: false });
  },
}));

/**
 * Imperative helper to trigger the themed Arthik alert dialog.
 */
export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
): void {
  useAlertStore.getState().showAlert(title, message, buttons, options);
}

// Preserve original React Native Alert.alert reference
export const originalNativeAlert = Alert.alert;

/**
 * Intercepts React Native Alert.alert calls across the app to use Arthik's
 * themed, accessible, spring-animated dialog on Light, Dark, and AMOLED themes.
 */
export function patchNativeAlert(): void {
  Alert.alert = ((
    title: string,
    message?: string,
    buttons?: any[],
    options?: any
  ) => {
    showAlert(title, message, buttons, options);
  }) as typeof Alert.alert;
}
