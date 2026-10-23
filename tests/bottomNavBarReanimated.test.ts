import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OPT-10: BottomNavBar Reanimated Tab Capsule Parity', () => {
  const navBarPath = path.resolve(__dirname, '../src/components/BottomNavBar.tsx');
  const source = fs.readFileSync(navBarPath, 'utf8');

  it('imports Reanimated primitives for UI-thread animation', () => {
    expect(source).toMatch(/from 'react-native-reanimated'/);
    expect(source).toMatch(/useSharedValue/);
    expect(source).toMatch(/useAnimatedStyle/);
    expect(source).toMatch(/interpolateColor/);
  });

  it('completely eliminates useNativeDriver: false from CapsuleTabItem', () => {
    const capsuleItemSection = source.slice(
      source.indexOf('const CapsuleTabItem ='),
      source.indexOf('const CenterAddButton =')
    );
    expect(capsuleItemSection).not.toContain('useNativeDriver: false');
    expect(capsuleItemSection).not.toContain('Animated.timing');
  });

  it('uses 180ms out-cubic timing for active capsule transitions', () => {
    expect(source).toMatch(/withTiming\(\s*active \? 1 : 0,\s*\{\s*duration:\s*180,\s*easing:\s*REasing\.out\(REasing\.cubic\)/);
  });

  it('preserves exact capsule padding and margin interpolation ranges', () => {
    expect(source).toContain('paddingHorizontal: interpolate(progress.value, [0, 1], [7, 11], Extrapolation.CLAMP)');
    expect(source).toContain('marginLeft: interpolate(progress.value, [0, 1], [0, 5], Extrapolation.CLAMP)');
  });
});
