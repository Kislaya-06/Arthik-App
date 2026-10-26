import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('pull-to-refresh: one smooth drop, no blink', () => {
  const hook = read('src/hooks/usePullRefresh.ts');

  it('holds the circle for a minimum time so a fast reload cannot flip it mid-animation', () => {
    expect(hook).toMatch(/MIN_REFRESH_VISIBLE_MS = 700/);
    expect(hook).toMatch(/MIN_REFRESH_VISIBLE_MS - \(Date\.now\(\) - startedAt\)/);
  });

  it('turns the circle on first, before any work starts', () => {
    const iSet = hook.indexOf('setRefreshing(true)');
    const iWork = hook.indexOf('await latestWork.current()');
    expect(iSet).toBeGreaterThan(-1);
    expect(iSet).toBeLessThan(iWork);
  });

  it('ignores a second pull while one is running and always stops the circle', () => {
    expect(hook).toMatch(/if \(busy\.current\) return;/);
    expect(hook).toMatch(/finally \{/);
  });

  it.each([
    'src/screens/HomeScreen.tsx',
    'src/screens/HistoryScreen.tsx',
    'src/screens/InsightsScreen.tsx',
    'src/hooks/useSavingsDashboard.ts',
  ])('%s uses the shared handler instead of its own set-true / set-false', (file) => {
    const src = read(file);
    expect(src).toMatch(/usePullRefresh\(/);
    expect(src).not.toMatch(/setRefreshing\(/);
  });

  it('the Home shell never switches the circle off while it is refreshing', () => {
    expect(read('src/components/RefreshScrollShell.tsx')).toMatch(/enabled=\{refreshing \|\| !locked\}/);
  });

  it('the circle colours are a stable array', () => {
    const src = read('src/components/AppRefreshControl.tsx');
    expect(src).toMatch(/useMemo\(\(\) => \[accent\], \[accent\]\)/);
    expect(src).toMatch(/colors=\{spinnerColors\}/);
  });
});
