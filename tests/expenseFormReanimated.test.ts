import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OPT-11: ExpenseForm & useFormKeyboard Reanimated + RNGH Parity', () => {
  const hookPath = path.resolve(__dirname, '../src/hooks/useFormKeyboard.ts');
  const screenPath = path.resolve(__dirname, '../src/screens/ExpenseFormScreen.tsx');

  const hookSource = fs.readFileSync(hookPath, 'utf8');
  const screenSource = fs.readFileSync(screenPath, 'utf8');

  it('useFormKeyboard imports and utilizes Reanimated shared values and worklets', () => {
    expect(hookSource).toMatch(/from 'react-native-reanimated'/);
    expect(hookSource).toMatch(/from 'react-native-worklets'/);
    expect(hookSource).toMatch(/useSharedValue/);
    expect(hookSource).toMatch(/withTiming/);
    expect(hookSource).toMatch(/withSpring/);
    expect(hookSource).not.toContain('useNativeDriver: false');
  });

  it('ExpenseFormScreen imports and utilizes RNGH Gesture and Reanimated', () => {
    expect(screenSource).toMatch(/from 'react-native-gesture-handler'/);
    expect(screenSource).toMatch(/from 'react-native-reanimated'/);
    expect(screenSource).toMatch(/from 'react-native-worklets'/);
    expect(screenSource).toContain('GestureDetector');
    expect(screenSource).toContain('Gesture.Pan()');
    expect(screenSource).not.toContain('PanResponder.create');
  });

  it('preserves exact keypad animation timing and height constants', () => {
    // Show: 220ms out cubic
    expect(hookSource).toMatch(/withTiming\(1,\s*\{\s*duration:\s*220/);
    // Hide: 200ms out cubic
    expect(hookSource).toMatch(/withTiming\(\s*0,\s*\{\s*duration:\s*200/);
    // Drag-close: 180ms out cubic
    expect(hookSource).toMatch(/withTiming\(\s*0,\s*\{\s*duration:\s*180/);
    // Drag-cancel spring: 338.8 stiffness / 25 damping (matches tension 70 / friction 8)
    expect(hookSource).toContain('stiffness: 338.8');
    expect(hookSource).toContain('damping: 25');
    // Keypad height 258 interpolation
    expect(screenSource).toContain('[0, 258]');
  });

  it('preserves exact save button morph timing and tick spring physics', () => {
    // Save button morph 180ms
    expect(screenSource).toMatch(/morph\.value = withTiming\(\s*1,\s*\{\s*duration:\s*180/);
    // Tick spring physics: 356.9 stiffness / 19 damping (matches tension 75 / friction 6)
    expect(screenSource).toContain('stiffness: 356.9');
    expect(screenSource).toContain('damping: 19');
    // Button margin top 0..14
    expect(screenSource).toContain('[0, 14]');
  });

  it('completely eliminates useNativeDriver: false across both files', () => {
    expect(hookSource).not.toContain('useNativeDriver: false');
    expect(screenSource).not.toContain('useNativeDriver: false');
  });
});
