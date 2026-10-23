import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('OPT-13: Savings Progress Bar Reanimated Parity', () => {
  const savingsScreenPath = path.resolve(__dirname, '../src/screens/SavingsScreen.tsx');
  const budgetHubSectionPath = path.resolve(__dirname, '../src/components/savings/BudgetHubSection.tsx');

  const savingsScreenSource = fs.readFileSync(savingsScreenPath, 'utf8');
  const budgetHubSectionSource = fs.readFileSync(budgetHubSectionPath, 'utf8');

  it('SavingsScreen imports and utilizes Reanimated primitives for UI-thread animation', () => {
    expect(savingsScreenSource).toMatch(/from 'react-native-reanimated'/);
    expect(savingsScreenSource).toMatch(/useSharedValue/);
    expect(savingsScreenSource).toMatch(/useAnimatedStyle/);
    expect(savingsScreenSource).toMatch(/withTiming/);
  });

  it('SavingsScreen eliminates progressAnim and useNativeDriver: false for the progress bar', () => {
    expect(savingsScreenSource).not.toContain('useNativeDriver: false');
    expect(savingsScreenSource).not.toContain('progressAnim');
    expect(savingsScreenSource).not.toContain('animatedProgressWidth = progressAnim.interpolate');
  });

  it('preserves exact 500ms duration, out-cubic easing, and target clamping calculation', () => {
    // 500ms timing with Easing.out(Easing.cubic)
    expect(savingsScreenSource).toMatch(/progress\.value = withTiming\(target,\s*\{\s*duration:\s*500,\s*easing:\s*Easing\.out\(Easing\.cubic\),?\s*\}\)/);
    // Target clamping: cardIsOver ? 1 : Math.min(1, Math.max(0, cardProgressRatio))
    expect(savingsScreenSource).toContain('cardIsOver ? 1 : Math.min(1, Math.max(0, cardProgressRatio))');
    // Percentage width via useAnimatedStyle
    expect(savingsScreenSource).toContain('width: `${progress.value * 100}%`');
  });

  it('BudgetHubSection utilizes Reanimated Animated.View without core Animated', () => {
    expect(budgetHubSectionSource).toMatch(/import Animated from 'react-native-reanimated'/);
    expect(budgetHubSectionSource).not.toMatch(/import\s*\{[^}]*\bAnimated\b[^}]*\}\s*from\s*'react-native'/);
    expect(budgetHubSectionSource).toContain('animatedProgressStyle');
    expect(budgetHubSectionSource).toContain('<Animated.View');
  });
});
