import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const updates = vi.hoisted(() => ({
  isEnabled: true,
  checkForUpdateAsync: vi.fn(),
  fetchUpdateAsync: vi.fn(),
  reloadAsync: vi.fn(),
}));
vi.mock('expo-updates', () => updates);
vi.mock('expo-constants', () => ({
  default: { expoConfig: { version: '9.9.9', extra: {} } },
}));
vi.mock('../src/components/OtaUpdateModal', () => ({}));

import { useOtaStore } from '../src/store/otaStore';

const reset = () =>
  useOtaStore.setState({ visible: false, info: null, isDownloading: false, downloadText: 'Downloading update...', error: null });

describe('otaStore (the "new update available" modal)', () => {
  beforeEach(() => {
    reset();
    vi.clearAllMocks();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('showUpdateModal', () => {
    it('opens with the info it is given', () => {
      useOtaStore.getState().showUpdateModal({ version: '2.0.0', title: 'Hello', highlights: ['a', 'b'] });
      const s = useOtaStore.getState();
      expect(s.visible).toBe(true);
      expect(s.info).toEqual({ version: '2.0.0', title: 'Hello', highlights: ['a', 'b'] });
      expect(s.isDownloading).toBe(false);
      expect(s.error).toBeNull();
    });

    it('with no info it falls back to built-in release notes (never an empty modal)', () => {
      useOtaStore.getState().showUpdateModal();
      const info = useOtaStore.getState().info!;
      expect(useOtaStore.getState().visible).toBe(true);
      expect(typeof info.version).toBe('string');
      expect((info.version ?? '').length).toBeGreaterThan(0);
      expect((info.title ?? '').length).toBeGreaterThan(0);
      expect(Array.isArray(info.highlights)).toBe(true);
      expect((info.highlights ?? []).length).toBeGreaterThan(0);
    });

    it('clears an old error and any download flag when it opens again', () => {
      useOtaStore.setState({ error: 'old', isDownloading: true });
      useOtaStore.getState().showUpdateModal();
      expect(useOtaStore.getState().error).toBeNull();
      expect(useOtaStore.getState().isDownloading).toBe(false);
    });
  });

  describe('hideUpdateModal', () => {
    it('closes the modal and clears the error', () => {
      useOtaStore.setState({ visible: true, error: 'x' });
      useOtaStore.getState().hideUpdateModal();
      expect(useOtaStore.getState().visible).toBe(false);
      expect(useOtaStore.getState().error).toBeNull();
    });

    it('can NOT be closed while an update is downloading', () => {
      useOtaStore.setState({ visible: true, isDownloading: true });
      useOtaStore.getState().hideUpdateModal();
      expect(useOtaStore.getState().visible).toBe(true);
    });
  });

  describe('applyUpdate (development build path)', () => {
    it('shows "Downloading", then "Restarting", then closes the modal and stops the spinner', async () => {
      useOtaStore.setState({ visible: true });
      const run = useOtaStore.getState().applyUpdate();

      expect(useOtaStore.getState().isDownloading).toBe(true);
      expect(useOtaStore.getState().downloadText).toBe('Downloading update...');

      await vi.advanceTimersByTimeAsync(1000);
      expect(useOtaStore.getState().downloadText).toBe('Restarting Arthik...');
      expect(useOtaStore.getState().visible).toBe(true);

      await vi.advanceTimersByTimeAsync(800);
      await run;
      expect(useOtaStore.getState().visible).toBe(false);
      expect(useOtaStore.getState().isDownloading).toBe(false);
      expect(useOtaStore.getState().error).toBeNull();
    });

    it('never touches the real update service in a development build', async () => {
      const run = useOtaStore.getState().applyUpdate();
      await vi.advanceTimersByTimeAsync(2000);
      await run;
      expect(updates.fetchUpdateAsync).not.toHaveBeenCalled();
      expect(updates.reloadAsync).not.toHaveBeenCalled();
    });
  });

  describe('checkForUpdates', () => {
    it('does nothing in a development build (no network call, modal stays closed)', async () => {
      await useOtaStore.getState().checkForUpdates();
      expect(updates.checkForUpdateAsync).not.toHaveBeenCalled();
      expect(useOtaStore.getState().visible).toBe(false);
    });
  });
});
