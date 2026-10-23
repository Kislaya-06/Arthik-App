import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OPT-16: PullToHistoryList Reanimated + RNGH Port', () => {
  const listFile = fs.readFileSync(
    path.join(__dirname, '../src/components/PullToHistoryList.tsx'),
    'utf-8'
  );
  const indicatorFile = fs.readFileSync(
    path.join(__dirname, '../src/components/PullToHistoryIndicator.tsx'),
    'utf-8'
  );
  const physicsFile = fs.readFileSync(
    path.join(__dirname, '../src/lib/pullToHistoryPhysics.ts'),
    'utf-8'
  );

  it('eliminates PanResponder and useNativeDriver: false from PullToHistoryList', () => {
    expect(listFile).not.toContain('PanResponder');
    expect(listFile).not.toContain('useNativeDriver');
    expect(listFile).not.toContain('Animated.decay');
    expect(listFile).not.toContain('useAnimatedValue');
  });

  it('imports and uses RNGH GestureDetector and Gesture.Pan with manualActivation', () => {
    expect(listFile).toContain("from 'react-native-gesture-handler'");
    expect(listFile).toContain('Gesture.Pan()');
    expect(listFile).toContain('.manualActivation(true)');
    expect(listFile).toContain('<GestureDetector gesture={panGesture}>');
  });

  it('drives momentum and release springs via UI-thread Reanimated worklets', () => {
    expect(listFile).toContain("from 'react-native-reanimated'");
    expect(listFile).toContain('withDecay(');
    expect(listFile).toContain('withSpring(');
    expect(listFile).toContain('useAnimatedStyle(');
    expect(listFile).toContain('useAnimatedReaction(');
    expect(listFile).toContain('scheduleOnRN(');
  });

  it('preserves measured Instagram physics constants and workletizes math helpers', () => {
    expect(physicsFile).toContain("'worklet';");
    expect(physicsFile).toContain('export const PULL_CURVE_EXPONENT = 1.5;');
    expect(physicsFile).toContain('export const MOMENTUM_DECELERATION = 0.997;');
    expect(physicsFile).toContain('stiffness: 42, damping: 11.6, mass: 1');
  });

  it('updates PullToHistoryIndicator to support SharedValue with useAnimatedReaction', () => {
    expect(indicatorFile).toContain('useAnimatedReaction(');
    expect(indicatorFile).toContain("import type { SharedValue } from 'react-native-reanimated'");
    expect(indicatorFile).toContain('pullDepth?: SharedValue<number>');
  });
});
