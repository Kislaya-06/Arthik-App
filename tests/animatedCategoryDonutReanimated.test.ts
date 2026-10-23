import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OPT-14: AnimatedCategoryDonut Reanimated Parity', () => {
  const filePath = path.resolve(__dirname, '../src/components/AnimatedCategoryDonut.tsx');
  const source = fs.readFileSync(filePath, 'utf8');

  it('imports Reanimated and Worklet primitives for UI-thread animation', () => {
    expect(source).toMatch(/from 'react-native-reanimated'/);
    expect(source).toMatch(/from 'react-native-worklets'/);
    expect(source).toMatch(/useSharedValue/);
    expect(source).toMatch(/useAnimatedProps/);
    expect(source).toMatch(/withTiming/);
    expect(source).toMatch(/scheduleOnRN/);
  });

  it('completely eliminates useNativeDriver: false and sweepAnim from AnimatedCategoryDonut', () => {
    expect(source).not.toContain('useNativeDriver: false');
    expect(source).not.toContain('sweepAnim');
    expect(source).not.toContain('sweepAnim.interpolate');
  });

  it('preserves exact 750ms duration and bezier sweep easing curve', () => {
    expect(source).toMatch(/duration:\s*750/);
    expect(source).toMatch(/REasing\.bezier\(0\.25,\s*0\.1,\s*0\.25,\s*1\)/);
  });

  it('binds strokeDashoffset mask via useAnimatedProps on Reanimated AnimatedCircle', () => {
    expect(source).toContain('Reanimated.createAnimatedComponent(Circle)');
    expect(source).toMatch(/useAnimatedProps\(\(\)\s*=>\s*\(\{/);
    expect(source).toContain('strokeDashoffset: circumference *');
    expect(source).toContain('animatedProps={animatedMaskProps}');
  });

  it('bridges isSweeping completion back to JS thread via scheduleOnRN', () => {
    expect(source).toMatch(/scheduleOnRN\(setIsSweeping,\s*false\)/);
  });

  it('keeps centerOpacity animation on native driver (useNativeDriver: true)', () => {
    expect(source).toContain('duration: 350');
    expect(source).toContain('useNativeDriver: true');
  });
});
