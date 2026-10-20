import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import {
  MIN_THUMB_RATIO,
  PRESS_OUT_SPRING,
  SLIDE_SPRING,
  thumbLayout,
  toggleGeometry,
} from '../src/lib/toggleMotion';

const read = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

// Every size used in the app today.
const SIZES: Array<[number, number]> = [
  [58, 30], // default (Profile)
  [50, 26], // Split
  [52, 26], // Budget Hub
];

describe('toggleMotion: squish switch geometry', () => {
  it('keeps the exact resting look of the old toggle (padding, thumb size, travel)', () => {
    const g = toggleGeometry(58, 30);
    expect(g.padding).toBe(3);
    expect(g.thumbSize).toBe(22); // 30 - 2 - 6
    expect(g.travelSpace - g.thumbSize).toBe(58 - 2 - 22 - 6); // old maxTranslate = 28
    const small = toggleGeometry(50, 26);
    expect(small.padding).toBe(2.5);
    expect(small.thumbSize).toBe(19); // 26 - 2 - 5
  });

  it.each(SIZES)('%ix%i: at rest the thumb is the old round ball, glued to the correct end', (w, h) => {
    const g = toggleGeometry(w, h);
    const off = thumbLayout(0, 0, g);
    expect(off.width).toBe(g.thumbSize);
    expect(off.left).toBe(g.padding);
    const on = thumbLayout(1, 0, g);
    expect(on.width).toBe(g.thumbSize);
    expect(on.left + on.width).toBeCloseTo(g.padding + g.travelSpace, 6); // right padding mirrors left
    expect(on.left - off.left).toBeCloseTo(g.travelSpace - g.thumbSize, 6); // same travel as before
  });

  it.each(SIZES)('%ix%i: pressing stretches toward the middle and keeps the resting edge on the track', (w, h) => {
    const g = toggleGeometry(w, h);
    const pressedOff = thumbLayout(0, 1, g);
    expect(pressedOff.width).toBeGreaterThan(g.thumbSize);
    expect(pressedOff.left).toBe(g.padding); // left edge does not move
    const pressedOn = thumbLayout(1, 1, g);
    expect(pressedOn.left + pressedOn.width).toBeCloseTo(g.padding + g.travelSpace, 6); // right edge does not move
  });

  it.each(SIZES)('%ix%i: longest in the middle of the trip, normal again at both ends', (w, h) => {
    const g = toggleGeometry(w, h);
    const mid = thumbLayout(0.5, 0, g).width;
    expect(mid).toBeGreaterThan(g.thumbSize + 2);
    expect(thumbLayout(0.1, 0, g).width).toBeLessThan(mid);
    expect(thumbLayout(0.9, 0, g).width).toBeLessThan(mid);
    expect(thumbLayout(0, 0, g).width).toBe(g.thumbSize);
    expect(thumbLayout(1, 0, g).width).toBe(g.thumbSize);
  });

  it.each(SIZES)('%ix%i: the thumb never leaves the track, for any progress / press combination', (w, h) => {
    const g = toggleGeometry(w, h);
    for (let p = -0.2; p <= 1.2; p += 0.05) {
      for (const press of [-0.15, 0, 0.5, 1, 1.2]) {
        const l = thumbLayout(p, press, g);
        expect(l.left).toBeGreaterThanOrEqual(g.padding - 1e-9);
        expect(l.left + l.width).toBeLessThanOrEqual(g.padding + g.travelSpace + 1e-9);
        expect(l.width).toBeGreaterThanOrEqual(g.thumbSize * MIN_THUMB_RATIO - 1e-9);
      }
    }
  });

  it('front edge runs ahead of the back edge mid-trip (the liquid feel)', () => {
    const g = toggleGeometry(58, 30);
    const rigidLeft = (p: number) => g.padding + p * (g.travelSpace - g.thumbSize);
    const l = thumbLayout(0.5, 0, g);
    expect(l.left).toBeLessThan(rigidLeft(0.5)); // back edge lags
    expect(l.left + l.width).toBeGreaterThan(rigidLeft(0.5) + g.thumbSize); // front edge leads
  });

  it('slide spring is clamped (no overshoot past the track end) and the release spring only squashes a little', () => {
    expect(SLIDE_SPRING.overshootClamping).toBe(true);
    // Underdamped release: overshoot of the press spring, in px, must stay under ~1px for the biggest stretch.
    const { stiffness, damping } = PRESS_OUT_SPRING;
    const zeta = damping / (2 * Math.sqrt(stiffness));
    const overshoot = Math.exp((-Math.PI * zeta) / Math.sqrt(1 - zeta * zeta)); // share of the stretch
    const g = toggleGeometry(58, 30);
    expect(overshoot * g.stretch).toBeLessThan(1.5);
  });
});

describe('AnimatedToggle: one component, whole-app coverage', () => {
  const src = read('src/components/AnimatedToggle.tsx');

  it('runs on Reanimated (UI thread) and not on the old JS-thread colour interpolation', () => {
    expect(src).toMatch(/from 'react-native-reanimated'/);
    expect(src).not.toMatch(/useNativeDriver:\s*false/);
    expect(src).not.toMatch(/interpolateColor/);
  });

  it('keeps the public API every existing caller uses', () => {
    for (const prop of ['value', 'onValueChange', 'width', 'height', 'onColor', 'offColor', 'trackColor']) {
      expect(src).toMatch(new RegExp(`\\b${prop}\\??:`));
    }
    expect(src).toMatch(/accessibilityRole="switch"/);
    expect(src).toMatch(/accessibilityState=\{\{ checked: value \}\}/);
  });

  it('honours reduce-motion and fires a selection haptic', () => {
    expect(src).toMatch(/useReducedMotion/);
    expect(src).toMatch(/Haptics\.selectionAsync/);
  });

  it('no screen uses a native <Switch/> (so every on/off gets the squish)', () => {
    const files = [
      'src/screens/ProfileScreen.tsx',
      'src/components/savings/BudgetHubSection.tsx',
      'src/components/split/SplitExtras.tsx',
      'src/components/transfer/TransferExtras.tsx',
      'src/screens/autolog/AutoLogAccountsScreen.tsx',
    ];
    for (const f of files) {
      const code = read(f);
      expect(code).not.toMatch(/<Switch[\s>]/);
      expect(code).toMatch(/<AnimatedToggle/);
    }
  });
});
