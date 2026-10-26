import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockNativeAlert, mockKeyboardDismiss } = vi.hoisted(() => ({
  mockNativeAlert: {
    alert: vi.fn(),
  },
  mockKeyboardDismiss: vi.fn(),
}));

vi.mock('react-native', () => ({
  Alert: mockNativeAlert,
  Keyboard: {
    dismiss: mockKeyboardDismiss,
  },
  Platform: { OS: 'android' },
}));

import { Alert } from 'react-native';
import {
  useAlertStore,
  showAlert,
  patchNativeAlert,
  originalNativeAlert,
} from '../src/store/alertStore';

describe('AppAlertModal and Alert System', () => {
  beforeEach(() => {
    useAlertStore.setState({
      isOpen: false,
      title: '',
      message: undefined,
      buttons: [],
      options: undefined,
    });
    vi.clearAllMocks();
  });

  it('starts with closed alert state', () => {
    const state = useAlertStore.getState();
    expect(state.isOpen).toBe(false);
    expect(state.title).toBe('');
    expect(state.buttons).toEqual([]);
  });

  it('sets open state and populates defaults when showAlert is called', () => {
    showAlert('Delete Item?');

    expect(mockKeyboardDismiss).toHaveBeenCalledTimes(1);
    const state = useAlertStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.title).toBe('Delete Item?');
    expect(state.message).toBeUndefined();
    expect(state.buttons.length).toBe(1);
    expect(state.buttons[0].text).toBe('OK');
    expect(state.buttons[0].style).toBe('default');
  });

  it('dismisses keyboard when useAlertStore.getState().showAlert is called directly', () => {
    useAlertStore.getState().showAlert('Direct Title');
    expect(mockKeyboardDismiss).toHaveBeenCalled();
  });

  it('preserves multi-button configurations and styles', () => {
    const onCancel = vi.fn();
    const onDelete = vi.fn();

    showAlert(
      'Delete Income?',
      'Delete this ₹100 transaction?',
      [
        { text: 'Cancel', style: 'cancel', onPress: onCancel },
        { text: 'Delete', style: 'destructive', onPress: onDelete },
      ],
      { cancelable: true }
    );

    const state = useAlertStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.title).toBe('Delete Income?');
    expect(state.message).toBe('Delete this ₹100 transaction?');
    expect(state.buttons.length).toBe(2);
    expect(state.buttons[0].text).toBe('Cancel');
    expect(state.buttons[0].style).toBe('cancel');
    expect(state.buttons[1].text).toBe('Delete');
    expect(state.buttons[1].style).toBe('destructive');
    expect(state.options?.cancelable).toBe(true);

    // Trigger button actions
    state.buttons[1].onPress?.();
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('hides alert when hideAlert is called', () => {
    showAlert('Notice', 'Some warning message');
    expect(useAlertStore.getState().isOpen).toBe(true);

    useAlertStore.getState().hideAlert();
    expect(useAlertStore.getState().isOpen).toBe(false);
  });

  it('routes Alert.alert calls to useAlertStore when patchNativeAlert is applied', () => {
    patchNativeAlert();

    const onConfirm = vi.fn();
    Alert.alert('Native Title', 'Native Message', [
      { text: 'Confirm', onPress: onConfirm },
    ]);

    const state = useAlertStore.getState();
    expect(state.isOpen).toBe(true);
    expect(state.title).toBe('Native Title');
    expect(state.message).toBe('Native Message');
    expect(state.buttons.length).toBe(1);
    expect(state.buttons[0].text).toBe('Confirm');

    state.buttons[0].onPress?.();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    // Restore original Alert.alert reference
    Alert.alert = originalNativeAlert;
  });
});
