import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OPT-12: PeriodNavigator Reanimated Elastic Dot Parity', () => {
  const filePath = path.resolve(__dirname, '../src/screens/insights/PeriodNavigator.tsx');
  const source = fs.readFileSync(filePath, 'utf8');

  it('imports Reanimated primitives for UI-thread animation', () => {
    expect(source).toMatch(/from 'react-native-reanimated'/);
    expect(source).toMatch(/useSharedValue/);
    expect(source).toMatch(/useAnimatedStyle/);
    expect(source).toMatch(/withSequence/);
    expect(source).toMatch(/withTiming/);
    expect(source).toMatch(/withSpring/);
    expect(source).toMatch(/cancelAnimation/);
  });

  it('completely eliminates useNativeDriver: false and core Animated from PeriodNavigator', () => {
    expect(source).not.toContain('useNativeDriver: false');
    expect(source).not.toContain('Animated.sequence');
    expect(source).not.toContain('Animated.timing');
    expect(source).not.toContain('Animated.spring');
    expect(source).not.toContain('useAnimatedValue');
    expect(source).not.toContain('<Animated.View');
  });

  it('preserves exact 130ms quad stretch duration and spring physics constants', () => {
    // 130ms quad easing
    expect(source).toContain('duration: 130');
    expect(source).toMatch(/REasing\.out\(REasing\.quad\)/);
    // Stiffness 447.4, damping 49 (matches tension 100, friction 16)
    expect(source).toContain('stiffness: 447.4');
    expect(source).toContain('damping: 49');
    expect(source).toContain('DOT_SLOT = 14');
  });

  it('binds pill left and width via Reanimated useAnimatedStyle', () => {
    expect(source).toContain('left: slideLeft.value');
    expect(source).toContain('width: slideWidth.value');
    expect(source).toContain('<Reanimated.View');
  });
});
