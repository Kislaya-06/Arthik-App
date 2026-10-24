import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  SKELETON_PULSE_HIGH, SKELETON_PULSE_LOW, SKELETON_PULSE_MS, SKELETON_STATIC_OPACITY,
} from '../src/lib/skeletonMotion';
import { FIXED_SHAPE_MAX_FONT_SCALE } from '../src/lib/fontScale';

const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8');

describe('OPT-41: skeletons only where they replace content', () => {
  it('pulse numbers match the guide', () => {
    expect(SKELETON_PULSE_LOW).toBe(0.55);
    expect(SKELETON_PULSE_HIGH).toBe(1);
    expect(SKELETON_PULSE_MS).toBe(700);
    expect(SKELETON_STATIC_OPACITY).toBe(0.8);
  });

  it('Skeleton pulses opacity forever on the UI thread, uses cardSubtle, and is still when motion is reduced', () => {
    const src = read('src/components/ui/Skeleton.tsx');
    expect(src).toMatch(/withRepeat\(/);
    expect(src).toMatch(/-1,\s*false/);
    expect(src).toMatch(/colors\.cardSubtle/);
    expect(src).toMatch(/useReduceMotion\(\)/);
    expect(src).toMatch(/if \(reduceMotion\) \{[\s\S]*?SKELETON_STATIC_OPACITY[\s\S]*?return;/);
    expect(src).toMatch(/cancelAnimation\(opacity\)/);
  });

  it('AutoLog setup shows a card-shaped skeleton for the result card, and keeps the scan spinner on the Continue slot', () => {
    const src = read('src/screens/autolog/AutoLogSetupScreen.tsx');
    expect(src).toMatch(/<Skeleton height=\{14\}/);
    expect(src).toMatch(/accessibilityLabel="Finishing setup"/);
    expect(src).toMatch(/accessibilityState=\{\{ busy: true \}\}/);
    // scanning: spinner stays where the Continue button will appear
    expect(src).toMatch(/\(\s*<View style=\{styles\.waiting\}><ActivityIndicator/);
  });

  it('spinners that sit in buttons or next to a label are untouched', () => {
    expect(read('src/components/StreakCalendarModal.tsx')).toMatch(/<ActivityIndicator size="small"/);
    expect(read('src/screens/ExpenseFormScreen.tsx')).toMatch(/Loading categories/);
    expect(read('src/screens/ProfileScreen.tsx')).toMatch(/<ActivityIndicator size="small" color="#DC2626"/);
    expect(read('src/screens/autolog/AutoLogWelcomeBackScreen.tsx')).toMatch(/<ActivityIndicator/);
  });
});

describe('OPT-42: large text safety on fixed-size shapes', () => {
  it('cap is 1.3 (nav labels keep their own 1.15)', () => {
    expect(FIXED_SHAPE_MAX_FONT_SCALE).toBe(1.3);
    expect(read('src/lib/navBarLayout.ts')).toMatch(/NAV_LABEL_MAX_FONT_SCALE = 1\.15/);
  });

  const capped: Array<[string, number]> = [
    ['src/components/ui/StatusBadge.tsx', 1],
    ['src/components/ui/SegmentedControl.tsx', 2],
    ['src/components/BouncyCategoryFilter.tsx', 2],
    ['src/components/KeyButton.tsx', 1],
    ['src/components/StreakCalendarModal.tsx', 2],
    ['src/components/CustomDatePickerModal.tsx', 4],
  ];
  for (const [file, count] of capped) {
    it(`${file} caps ${count} text node(s) with the shared constant`, () => {
      const src = read(file);
      const uses = src.match(/maxFontSizeMultiplier=\{FIXED_SHAPE_MAX_FONT_SCALE\}/g) ?? [];
      expect(uses.length).toBe(count);
      expect(src).toMatch(/from '(\.\.\/)+lib\/fontScale'/);
    });
  }

  it('the category pill keeps the invisible width placeholder and the visible label on the SAME cap', () => {
    const src = read('src/components/BouncyCategoryFilter.tsx');
    const blocks = src.match(/maxFontSizeMultiplier=\{FIXED_SHAPE_MAX_FONT_SCALE\}/g) ?? [];
    expect(blocks.length).toBe(2);
    expect(src).toMatch(/hiddenPlaceholder/);
  });

  it('never turns font scaling off in new code (only the three RollingText digit layers do, as before)', () => {
    for (const f of ['src/components/ui/StatusBadge.tsx', 'src/components/KeyButton.tsx', 'src/components/StreakCalendarModal.tsx', 'src/components/CustomDatePickerModal.tsx', 'src/components/ui/Skeleton.tsx']) {
      expect(read(f)).not.toMatch(/allowFontScaling=\{false\}/);
    }
    expect((read('src/components/RollingText.tsx').match(/allowFontScaling=\{false\}/g) ?? []).length).toBe(3);
  });
});

describe('OPT-43: one reduce-motion source', () => {
  it('the shared hook is live (AccessibilityInfo store) and starts from the startup value', () => {
    const src = read('src/hooks/useReduceMotion.ts');
    expect(src).toMatch(/createReduceMotionStore\(AccessibilityInfo\)/);
    expect(src).toMatch(/useSyncExternalStore/);
    expect(src).toMatch(/useReducedMotion\(\)/);
  });

  it('AmbientBackground and RollingText use it and no longer talk to AccessibilityInfo themselves', () => {
    for (const f of ['src/components/AmbientBackground.tsx', 'src/components/RollingText.tsx', 'src/components/ui/Skeleton.tsx']) {
      const src = read(f);
      expect(src).toMatch(/import \{ useReduceMotion \} from '(\.\.\/)+hooks\/useReduceMotion'/);
      expect(src).not.toMatch(/AccessibilityInfo/);
    }
  });

  it('Ambient motion still stops when motion is reduced', () => {
    expect(read('src/components/AmbientBackground.tsx')).toMatch(/running = visible && focused && appActive && !reduceMotion/);
  });
});

describe('OPT-44: haptics follow the map', () => {
  it('Vault guard: pills and chips are selection ticks, only the keypad key keeps its impact', () => {
    const src = read('src/components/VaultSpendingGuardModal.tsx');
    expect((src.match(/Haptics\.selectionAsync\(\)/g) ?? []).length).toBe(3);
    expect((src.match(/Haptics\.impactAsync/g) ?? []).length).toBe(1);
    expect(src).toMatch(/handleKeyPress[\s\S]{0,120}impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)\.catch/);
  });

  it('deleting an AutoLog review is one Heavy tap', () => {
    expect(read('src/screens/autolog/AutoLogReviewScreen.tsx')).toMatch(/handleCardDelete[\s\S]{0,200}ImpactFeedbackStyle\.Heavy/);
  });

  it('deliberate choices are unchanged: tab change Light, add button Medium', () => {
    const src = read('src/components/BottomNavBar.tsx');
    expect(src).toMatch(/navigateTo[\s\S]{0,120}ImpactFeedbackStyle\.Light/);
    expect(src).toMatch(/handleAddExpense[\s\S]{0,120}ImpactFeedbackStyle\.Medium/);
  });

  it('the map is written into the design system', () => {
    const doc = read('docs/design-system.md');
    expect(doc).toMatch(/Haptics map/);
    expect(doc).toMatch(/selectionAsync/);
    expect(doc).toMatch(/Heavy/);
  });
});

describe('OPT-46: Add / Edit expense open from the bottom', () => {
  const src = read('src/navigation/index.tsx');

  it('AddExpense and EditExpense use slide_from_bottom', () => {
    expect(src).toMatch(/name="AddExpense"[^\n]*options=\{\{ animation: 'slide_from_bottom' \}\}/);
    expect(src).toMatch(/name="EditExpense"[^\n]*options=\{\{ animation: 'slide_from_bottom' \}\}/);
  });

  it('every other screen keeps the default slide_from_right', () => {
    expect(src).toMatch(/screenOptions=\{\{\s*headerShown: false,\s*animation: 'slide_from_right',/);
    expect((src.match(/slide_from_bottom/g) ?? []).length).toBe(2);
  });

  it('ExpenseDetail still opens from the right', () => {
    expect(src).toMatch(/<Stack\.Screen name="ExpenseDetail" component=\{ExpenseDetailScreen\} \/>/);
  });
});
