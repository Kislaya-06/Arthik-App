import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OPT-15: Insights Period Swipe RNGH Parity', () => {
  const filePath = path.resolve(__dirname, '../src/screens/InsightsScreen.tsx');
  const source = fs.readFileSync(filePath, 'utf8');

  it('imports RNGH, Reanimated and Worklet primitives for UI-thread gesture handling', () => {
    expect(source).toMatch(/from 'react-native-gesture-handler'/);
    expect(source).toMatch(/from 'react-native-reanimated'/);
    expect(source).toMatch(/from 'react-native-worklets'/);
    expect(source).toContain('GestureDetector');
    expect(source).toContain('Gesture.Pan()');
    expect(source).toContain('useSharedValue');
    expect(source).toContain('scheduleOnRN');
  });

  it('completely eliminates PanResponder and panHandlers from InsightsScreen', () => {
    expect(source).not.toContain('PanResponder.create');
    expect(source).not.toContain('panHandlers');
    expect(source).not.toMatch(/import\s*\{[^}]*\bPanResponder\b[^}]*\}\s*from\s*'react-native'/);
  });

  it('wraps the hero card in GestureDetector', () => {
    expect(source).toContain('<GestureDetector gesture={swipeGesture}>');
    expect(source).toContain('styles.heroCard');
    expect(source).toContain('</GestureDetector>');
  });

  it('preserves exact gesture activation and vertical scroll failure thresholds', () => {
    // Horizontal dominance: |dx| > 12 && |dx| > |dy| * 1.5
    expect(source).toMatch(/Math\.abs\(dx\)\s*>\s*12\s*&&\s*Math\.abs\(dx\)\s*>\s*Math\.abs\(dy\)\s*\*\s*1\.5/);
    // Vertical scroll priority: |dy| > 12 fails pan so parent ScrollView scrolls freely
    expect(source).toMatch(/Math\.abs\(dy\)\s*>\s*12/);
    expect(source).toContain('state.fail()');
    expect(source).toContain('state.activate()');
  });

  it('preserves swipe-to-navigate bounds and triggers onSwipeEnd via scheduleOnRN', () => {
    expect(source).toMatch(/dx\s*<\s*-40\s*&&\s*curOffset\s*<\s*0/);
    expect(source).toMatch(/dx\s*>\s*40\s*&&\s*curOffset\s*>\s*curMinOff/);
    expect(source).toMatch(/scheduleOnRN\(onSwipeEnd,\s*e\.translationX\)/);
  });
});
