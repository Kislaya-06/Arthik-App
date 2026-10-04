import { describe, it, expect, vi, beforeEach } from 'vitest';

const mem: Record<string, string> = {};
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (k: string) => (k in mem ? mem[k] : null)),
    setItem: vi.fn(async (k: string, v: string) => { mem[k] = v; }),
    removeItem: vi.fn(async (k: string) => { delete mem[k]; }),
  },
}));

import { useAmbientStore } from '../src/store/ambientStore';

beforeEach(async () => {
  Object.keys(mem).forEach((k) => delete mem[k]);
  useAmbientStore.setState({ enabled: true, hydrated: false });
});

describe('ambientStore (Profile -> Ambient Background switch)', () => {
  it('is ON by default', () => {
    expect(useAmbientStore.getState().enabled).toBe(true);
  });

  it('can be switched off and on', () => {
    useAmbientStore.getState().setEnabled(false);
    expect(useAmbientStore.getState().enabled).toBe(false);
    useAmbientStore.getState().setEnabled(true);
    expect(useAmbientStore.getState().enabled).toBe(true);
  });

  it('is saved under its own key, and only the choice itself is saved', async () => {
    expect(useAmbientStore.persist.getOptions().name).toBe('arthik-ambient-preference');
    useAmbientStore.getState().setEnabled(false);
    await new Promise((r) => setTimeout(r, 10));
    const saved = JSON.parse(mem['arthik-ambient-preference']);
    expect(saved.state).toEqual({ enabled: false });
  });

  it('a saved OFF is restored on the next start, and `hydrated` only becomes true after that (no flash of the effect)', async () => {
    mem['arthik-ambient-preference'] = JSON.stringify({ state: { enabled: false }, version: 0 });
    expect(useAmbientStore.getState().hydrated).toBe(false);
    await useAmbientStore.persist.rehydrate();
    await new Promise((r) => setTimeout(r, 10));
    expect(useAmbientStore.getState().enabled).toBe(false);
    expect(useAmbientStore.getState().hydrated).toBe(true);
  });
});
