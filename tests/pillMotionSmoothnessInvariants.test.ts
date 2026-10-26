import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const root = path.join(__dirname, '..');
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');

describe('Pill Smoothness Invariant 1: HistoryScreen "All" Category Fast-Path (Zero-Freeze)', () => {
  const historySrc = read('src/screens/HistoryScreen.tsx');

  it('declares pre-computed allUnfilteredSections memoized strictly on dataset changes', () => {
    expect(historySrc).toMatch(/const allUnfilteredSections = useMemo<Section\[\]>/);
    expect(historySrc).toMatch(
      /\}, \[expenses, gullakDeposits, categoryMap, isBudgetModeEnabled\]\);/
    );
  });

  it('uses an instant O(1) fast-path return when "All" category is selected with no search query', () => {
    // Fast path: When showing "All" without search filter, return pre-computed cached sections directly
    expect(historySrc).toMatch(
      /if \(!selectedCategoryId && !debouncedQuery\.trim\(\)\) \{\s*return allUnfilteredSections;\s*\}/
    );
  });

  it('bypasses date-splitting and sorting loops during "All" category selection', () => {
    // Fast path must occur BEFORE filteredExpenses.forEach or deposit processing
    const fastPathIdx = historySrc.indexOf('if (!selectedCategoryId && !debouncedQuery.trim())');
    const groupingLoopIdx = historySrc.indexOf('filteredExpenses.forEach((expense) => {', fastPathIdx);

    expect(fastPathIdx).toBeGreaterThan(0);
    expect(groupingLoopIdx).toBeGreaterThan(fastPathIdx);
  });
});

describe('Pill Smoothness Invariant 2: BouncyCategoryFilter Android Typography & Layout Stability', () => {
  const filterSrc = read('src/components/BouncyCategoryFilter.tsx');

  it('uses stable FontFamily.bold on visibleLabel to permanently eliminate Android TextView requestLayout churn', () => {
    // Both placeholder and visible label must use FontFamily.bold unconditionally
    expect(filterSrc).toMatch(/visibleLabel,\s*animatedTextStyle,\s*\{\s*fontFamily:\s*FontFamily\.bold,\s*\}/);
    // Must NOT toggle fontFamily based on isActive (causes native relayout on Android)
    expect(filterSrc).not.toMatch(/fontFamily:\s*isActive\s*\?\s*FontFamily\.bold\s*:\s*FontFamily\.medium/);
  });

  it('keeps invisible bold placeholder to reserve stable width', () => {
    expect(filterSrc).toMatch(/styles\.hiddenPlaceholder/);
    expect(filterSrc).toMatch(/aria-hidden/);
  });

  it('animates translateX and width strictly without animating layout properties', () => {
    expect(filterSrc).toMatch(/transform:\s*\[\{\s*translateX:\s*pillX\.value\s*\}\]/);
    expect(filterSrc).toMatch(/width:\s*pillWidth\.value/);
    expect(filterSrc).not.toMatch(/left:\s*pillX\.value/);
  });
});

describe('Pill Smoothness Invariant 3: SegmentedControl Center-Anchored Color Transition', () => {
  const segSrc = read('src/components/ui/SegmentedControl.tsx');

  it('anchors color interpolation to the physical visual center of the pill', () => {
    expect(segSrc).toMatch(/const pillCenter = \(pillLeft\.value \+ pillRight\.value\) \/ 2;/);
    expect(segSrc).toMatch(
      /const centerSlot = optionWidth > 0 \? \(pillCenter - optionWidth \/ 2\) \/ optionWidth : 0;/
    );
    expect(segSrc).toMatch(/interpolateColor\(\s*centerSlot,\s*colorInputRange,\s*colorOutputRange\s*\)/);
    // Must NOT anchor to pillLeft (the trailing edge, which lags behind by 80% during stretches)
    expect(segSrc).not.toMatch(/interpolateColor\(\s*pillLeft\.value \/ optionWidth/);
  });

  it('mathematically synchronizes color transition with mid-flight stretch physics', () => {
    const optionWidth = 100;
    // Helper replicating SegmentedControl center-slot formula
    const calcCenterSlot = (left: number, right: number) => {
      const center = (left + right) / 2;
      return (center - optionWidth / 2) / optionWidth;
    };

    // Slot 0 (Expense): resting at left=0, right=100
    expect(calcCenterSlot(0, 100)).toBe(0);

    // Slot 1 (Income): resting at left=100, right=200
    expect(calcCenterSlot(100, 200)).toBe(1);

    // Mid-flight stretch: leading edge has surged to 170, trailing edge lagging at 30
    // Total pill center = (30 + 170) / 2 = 100 (exactly at the border between slot 0 and slot 1!)
    // centerSlot must be exactly 0.5 (perfect midpoint transition)
    expect(calcCenterSlot(30, 170)).toBe(0.5);

    // In contrast, the old buggy formula (left / optionWidth) would have given 30 / 100 = 0.3 (70% wrong color!)
    const oldFormula = 30 / optionWidth;
    expect(oldFormula).toBe(0.3);
  });
});

describe('Pill Smoothness Invariant 4: BouncyPaymentToggle Stable Identity (No Teardown)', () => {
  const paymentSrc = read('src/components/BouncyPaymentToggle.tsx');

  it('does NOT pass a dynamic key prop that forces full component unmount during type transitions', () => {
    // Dynamic key like key={options.map(o => o.mode).join('-')} destroys Reanimated state on every switch
    expect(paymentSrc).not.toMatch(/key=\{options\.map/);
    expect(paymentSrc).not.toMatch(/key=\{options/);
  });

  it('renders SegmentedControl as a stable root component', () => {
    expect(paymentSrc).toMatch(/return \(\s*<SegmentedControl\s*options=\{segOptions\}/);
  });
});

describe('Pill Smoothness Invariant 5: useFormKeyboard Redundant Animation Elimination', () => {
  const keyboardSrc = read('src/hooks/useFormKeyboard.ts');

  it('guards showKeypad against re-animating when the keypad is already fully visible and resting', () => {
    expect(keyboardSrc).toMatch(
      /if \(isKeypadVisibleRef\.current && keypad\.value === 1\) return;/
    );
  });
});

describe('Pill Smoothness Invariant 6: BouncyCategoryFilter commitOnSettle & Smart Scroll Avoidance', () => {
  const filterSrc = read('src/components/BouncyCategoryFilter.tsx');
  const historySrc = read('src/screens/HistoryScreen.tsx');

  it('supports commitOnSettle prop and defers heavy parent re-renders until pill landing', () => {
    expect(filterSrc).toMatch(/commitOnSettle\?: boolean;/);
    expect(filterSrc).toMatch(/commitTimerRef = useRef/);
    expect(filterSrc).toMatch(/pendingKeyRef = useRef/);
    expect(filterSrc).toMatch(/if \(!commitOnSettle\) \{/);
  });

  it('prunes UI-thread interpolateColor when distance exceeds maxRange', () => {
    expect(filterSrc).toMatch(/if \(distance >= maxRange\) \{\s*return \{\s*color: colors\.textSecondary,\s*\};\s*\}/);
  });

  it('skips scrollTo if the target category chip is already comfortably in view', () => {
    expect(filterSrc).toMatch(/isComfortablyVisible =/);
    expect(filterSrc).toMatch(/if \(!force && isComfortablyVisible\) \{\s*return;\s*\}/);
  });

  it('tracks ScrollView horizontal scroll offset via onScroll with throttle 16', () => {
    expect(filterSrc).toMatch(/scrollEventThrottle=\{16\}/);
    expect(filterSrc).toMatch(/scrollXRef\.current = e\.nativeEvent\.contentOffset\.x;/);
  });

  it('HistoryScreen activates commitOnSettle on BouncyCategoryFilter', () => {
    expect(historySrc).toMatch(/<BouncyCategoryFilter[^>]*commitOnSettle/);
  });

  it('HistoryScreen batches visibleSectionCount and selectedCategoryId inside startTransition', () => {
    expect(historySrc).toMatch(
      /React\.startTransition\(\(\) => \{\s*setVisibleSectionCount\(INITIAL_SECTION_COUNT\);\s*setSelectedCategoryId\(id\);\s*\}\);/
    );
  });
});

