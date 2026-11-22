import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { isLockScreenShown } from '../src/lib/appLockGate';

const src = fs.readFileSync(path.join(__dirname, '../src/components/AppLockOverlay.tsx'), 'utf8');

describe('App Lock overlay (cold start & lock transition)', () => {
  const base = { hasUser: true, enabled: true, rendered: true, route: 'AppTabs' };

  it('covers the app whenever a signed-in user has App Lock on and the overlay is mounted', () => {
    expect(isLockScreenShown(base)).toBe(true);
  });

  it('stays hidden only on the splash, without a user, or with App Lock off', () => {
    expect(isLockScreenShown({ ...base, route: 'Splash' })).toBe(false);
    expect(isLockScreenShown({ ...base, hasUser: false })).toBe(false);
    expect(isLockScreenShown({ ...base, enabled: false })).toBe(false);
    expect(isLockScreenShown({ ...base, rendered: false })).toBe(false);
  });

  it('re-renders when the route changes, so leaving the splash shows the lock (no fail-open)', () => {
    expect(src).toMatch(/navigationRef\.addListener\('state'/);
  });

  it('draws the lock in its own Modal window so open sheets and dialogs cannot sit above it', () => {
    expect(src).toMatch(/<Modal[\s\S]*?visible[\s\S]*?<Animated\.View/);
  });

  it('calls every hook before any early return (no hook-order crash on lock)', () => {
    const firstReturn = src.indexOf('return null');
    expect(firstReturn).toBeGreaterThan(-1);
    expect(src.indexOf('useAnimatedStyle(')).toBeLessThan(firstReturn);
    expect(src.lastIndexOf('useEffect(')).toBeLessThan(firstReturn);
  });
});
