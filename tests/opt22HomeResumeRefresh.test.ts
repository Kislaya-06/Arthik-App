import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const src = readFileSync(join(__dirname, '..', 'src/screens/HomeScreen.tsx'), 'utf8');

describe('OPT-22: Home refreshes quietly after a long time in the background', () => {
  it('uses a 5 minute stale limit', () => {
    expect(src).toMatch(/HOME_RESUME_STALE_MS = 5 \* 60_000/);
  });

  it('refreshes on resume without force (keeps the 60 s throttle)', () => {
    // OPT-60: the stale check reads the one shared fetch clock (was a Home-only ref).
    expect(src).toMatch(/Date\.now\(\) - getLastExpensesFetchAt\(\) > HOME_RESUME_STALE_MS/);
    expect(src).toMatch(/loadData\(false\);\s*\}\s*\}\s*\}\);/);
  });

  it('keeps the midnight branch forced and does not double-fetch across midnight', () => {
    expect(src).toMatch(/loadData\(true\);\s*return nowKey;/);
    expect(src).toMatch(/!crossedMidnight/);
  });
});
