import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PILL_SETTLE_MS } from '../src/lib/segmentedMotion';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('Home filter pill: heavy update lands only after the pill has landed', () => {
  const home = read('src/screens/HomeScreen.tsx');

  it('Home asks the pill to report the change only after it settles', () => {
    expect(home).toMatch(/<BouncyFilterToggle[\s\S]*?commitOnSettle[\s\S]*?\/>/);
  });

  it('Home no longer runs its own short timer that overlapped the glide (the jitter cause)', () => {
    expect(home).not.toMatch(/FILTER_DECOUPLE_DELAY_MS/);
    expect(home).not.toMatch(/filterTimerRef/);
  });

  it('pill and numbers switch in the same render once reported', () => {
    expect(home).toMatch(/setSelectedFilter\(newFilter\);\s*setActiveFilter\(newFilter\);/);
  });

  it('the settle wait is longer than the old 220ms overlap window but still snappy', () => {
    expect(PILL_SETTLE_MS).toBeGreaterThan(220);
    expect(PILL_SETTLE_MS).toBeLessThanOrEqual(400);
  });
});
