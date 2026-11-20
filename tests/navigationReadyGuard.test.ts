import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

/**
 * The Supabase auth listener in App.tsx can fire (INITIAL_SESSION, or SIGNED_OUT for a session that
 * expired while the app was closed) before the NavigationContainer is mounted. Calling
 * navigationRef.getCurrentRoute() / reset() then logs "The 'navigation' object hasn't been
 * initialized yet" (seen as a red Console Error on the dev build) and does nothing.
 * Every direct use must check navigationRef.isReady() first; navigateTo() already polls.
 */
const app = readFileSync(path.resolve(__dirname, '../App.tsx'), 'utf8');

describe('App.tsx: navigationRef is only used once the navigator is ready', () => {
  it('INITIAL_SESSION reads the current route only when ready (not ready = still on Splash)', () => {
    expect(app).toContain(
      'const currentRoute = navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined;'
    );
    // Same decision as before: no route yet means the splash handles start-up.
    expect(app).toContain("if (event === 'INITIAL_SESSION' && (!currentRoute || currentRoute === 'Splash')) {");
  });

  it('SIGNED_OUT resets to Auth only when the navigator is ready', () => {
    expect(app).toMatch(/if \(navigationRef\.isReady\(\)\) \{\s*navigationRef\.reset\(\{\s*index: 0,\s*routes: \[\{ name: 'Auth' \}\],/);
  });

  it('no unguarded getCurrentRoute / reset / dispatch on navigationRef in App.tsx', () => {
    const lines = app.split('\n');
    lines.forEach((line, i) => {
      if (!/navigationRef\.(getCurrentRoute|reset|dispatch)\(/.test(line)) return;
      const context = lines.slice(Math.max(0, i - 2), i + 1).join('\n');
      expect(context, `App.tsx:${i + 1}`).toMatch(/navigationRef\.isReady\(\)/);
    });
  });
});
