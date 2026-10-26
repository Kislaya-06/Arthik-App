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
  /** Increases every time a new alert is shown. The dialog plays its entrance once per id. */
  id: number;
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
  /** Alerts asked for while another one is on screen. Shown one after another, never dropped. */
  queue: AlertConfig[];
  showAlert: (title: string, message?: string, buttons?: AlertButton[], options?: AlertOptions) => void;
  hideAlert: () => void;
}

const normalizeButtons = (buttons?: AlertButton[]): AlertButton[] =>
  buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

const sameAlert = (a: { title: string; message?: string }, b: { title: string; message?: string }) =>
  a.title === b.title && (a.message ?? '') === (b.message ?? '');

export const useAlertStore = create<AlertState>((set, get) => ({
  isOpen: false,
  id: 0,
  title: '',
  message: undefined,
  buttons: [],
  options: undefined,
  queue: [],
  showAlert: (title, message, buttons, options) => {
    try {
      Keyboard.dismiss();
    } catch {}

    const resolvedButtons = normalizeButtons(buttons);
    const state = get();
    const queue = state.queue ?? [];

    if (state.isOpen) {
      // Same dialog asked for twice (double tap on "Delete"): show it once, so it can't be confirmed twice.
      if (sameAlert(state, { title, message }) || queue.some((q) => sameAlert(q, { title, message }))) {
        return;
      }
      // Another dialog is on screen: wait for it. Replacing it would silently drop its buttons' callbacks
      // (e.g. a swiped row would never get its Cancel).
      set({ queue: [...queue, { title, message, buttons: resolvedButtons, options }] });
      return;
    }

    set({
      isOpen: true,
      id: (state.id ?? 0) + 1,
      title,
      message,
      buttons: resolvedButtons,
      options,
    });
  },
  hideAlert: () => {
    const state = get();
    const queue = state.queue ?? [];
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      set({
        isOpen: true,
        id: (state.id ?? 0) + 1,
        title: next.title,
        message: next.message,
        buttons: normalizeButtons(next.buttons),
        options: next.options,
        queue: rest,
      });
      return;
    }
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
