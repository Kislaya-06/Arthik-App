import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Structural guard: the splash screen must stay offline-first. It opens after the data saved on the phone is loaded
 * and never waits for the server (behaviour is tested in tests/startupLoad.test.ts and the store tests).
 */
const splash = readFileSync(join(__dirname, '..', 'src', 'screens', 'SplashScreen.tsx'), 'utf8');

describe('SplashScreen is offline-first', () => {
  it('starts through runLocalFirstStartup', () => {
    expect(splash).toContain('runLocalFirstStartup');
  });

  it('loads only saved data before opening (no direct server fetch in the local step)', () => {
    const localStep = splash.slice(splash.indexOf('loadLocalData'), splash.indexOf('refreshFromServer'));
    expect(localStep).toContain('loadCachedCategories');
    expect(localStep).toContain('loadCachedExpenses');
    expect(localStep).not.toMatch(/fetchExpenses|fetchCategories|hydrateFromSupabase/);
  });

  it('does not hold the splash on the connectivity check or on a fixed network race any more', () => {
    expect(splash).not.toContain('await connectivity; // connectivity result applied first');
    expect(splash).not.toContain('Promise.race([hydrationChain()');
  });

  it('keeps the app lock ready before the first screen (it is locked on exit when enabled)', () => {
    const localStep = splash.slice(splash.indexOf('loadLocalData'), splash.indexOf('refreshFromServer'));
    expect(localStep).toContain('useAppLockStore.getState().init');
  });
});
