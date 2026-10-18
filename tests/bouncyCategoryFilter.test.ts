import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

// ── Shared Reanimated Spy Registry for Behavioral Verification ──────────────
export const reanimatedSpies = {
  sharedValues: [] as any[],
  cancelAnimationCalls: [] as string[],
  withSpringCalls: [] as { toValue: any; config: any }[],
  withTimingCalls: [] as { toValue: any; config: any }[],
  withSequenceCalls: [] as any[],
  executionTrace: [] as string[],
  reset() {
    this.cancelAnimationCalls = [];
    this.withSpringCalls = [];
    this.withTimingCalls = [];
    this.withSequenceCalls = [];
    this.executionTrace = [];
  },
  resetAll() {
    this.sharedValues = [];
    this.reset();
  },
};

vi.mock('../src/store/themeStore', () => ({
  useTheme: () => ({
    colors: {
      cardSubtle: '#1A263B',
      borderSubtle: '#182335',
      mintGreen: '#B8E0C8',
      forestGreen: '#1A2B4C',
      textSecondary: '#94A3B8',
      textPrimary: '#F8FAFC',
      isDark: true,
    },
  }),
}));

vi.mock('react-native', () => ({
  View: (props: any) => ({ type: 'View', props }),
  Text: (props: any) => ({ type: 'Text', props }),
  Pressable: (props: any) => ({ type: 'Pressable', props }),
  ScrollView: (props: any) => ({ type: 'ScrollView', props }),
  StyleSheet: {
    create: (styles: any) => styles,
  },
}));

vi.mock('react-native-reanimated', async () => {
  const rt = await import('./helpers/hookRuntime');
  const useSharedValue = vi.fn((init: any) => {
    // Shared values in Reanimated persist across component renders like refs
    const ref = rt.reactHooks.useRef<any>(null);
    if (!ref.current) {
      let currentVal = init;
      const sv = {
        get value() {
          return currentVal;
        },
        set value(v: any) {
          currentVal = v;
        },
      };
      ref.current = sv;
      reanimatedSpies.sharedValues.push(sv);
    }
    return ref.current;
  });

  const useAnimatedStyle = vi.fn((fn: any) => fn());

  const withSpring = vi.fn((toValue: any, config: any) => {
    reanimatedSpies.withSpringCalls.push({ toValue, config });
    reanimatedSpies.executionTrace.push(`withSpring:${toValue}`);
    return toValue;
  });

  const withTiming = vi.fn((toValue: any, config: any) => {
    reanimatedSpies.withTimingCalls.push({ toValue, config });
    reanimatedSpies.executionTrace.push(`withTiming:${toValue}`);
    return toValue;
  });

  const withSequence = vi.fn((...anims: any[]) => {
    reanimatedSpies.withSequenceCalls.push(anims);
    return anims[anims.length - 1];
  });

  const cancelAnimation = vi.fn(() => {
    reanimatedSpies.cancelAnimationCalls.push('cancelAnimation');
    reanimatedSpies.executionTrace.push('cancelAnimation');
  });

  return {
    default: {
      View: (props: any) => ({ type: 'Animated.View', props }),
    },
    useSharedValue,
    useAnimatedStyle,
    withSpring,
    withTiming,
    withSequence,
    cancelAnimation,
    Easing: {
      out: vi.fn((fn: any) => fn),
      quad: 'quad',
    },
  };
});

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return {
    ...actual,
    ...rt.reactHooks,
    default: { ...actual, ...rt.reactHooks },
  };
});

import { renderHook } from './helpers/hookRuntime';
import { BouncyCategoryFilter } from '../src/components/BouncyCategoryFilter';

const read = (p: string) => fs.readFileSync(path.join(__dirname, '..', p), 'utf8');

describe('BouncyCategoryFilter UI-Thread Reanimated Animation Parity (Source & Safeguards)', () => {
  const src = read('src/components/BouncyCategoryFilter.tsx');

  it('imports reanimated primitives (useSharedValue, useAnimatedStyle, withSpring)', () => {
    expect(src).toMatch(/from 'react-native-reanimated'/);
    expect(src).toMatch(/useSharedValue/);
    expect(src).toMatch(/useAnimatedStyle/);
    expect(src).toMatch(/withSpring/);
    expect(src).toMatch(/cancelAnimation/);
  });

  it('does not import or use useNativeDriver false from react-native core Animated', () => {
    expect(src).not.toMatch(/useNativeDriver:\s*false/);
    expect(src).not.toMatch(/useAnimatedValue/);
  });

  it('sliding highlight animated style derives translateX (not left) and width for transform-only animation', () => {
    expect(src).toMatch(/transform:\s*\[\{\s*translateX:\s*pillX\.value\s*\}\]/);
    expect(src).toMatch(/width:\s*pillWidth\.value/);
    // Must NOT animate layout properties (`left`) — causes per-frame native relayout on Android
    expect(src).not.toMatch(/left:\s*pill[A-Z].*\.value/);
  });

  it('uses invisible bold placeholder to guarantee zero-shift tab width stability', () => {
    expect(src).toMatch(/hiddenPlaceholder/);
    expect(src).toMatch(/fontFamily:\s*FontFamily\.bold/);
    expect(src).toMatch(/visibleLabel/);
    expect(src).toMatch(/opacity:\s*0/);
    expect(src).toMatch(/position:\s*'absolute'/);
  });

  it('HistoryScreen stably memoizes categoryFilterOptions to prevent options array churning', () => {
    const historySrc = read('src/screens/HistoryScreen.tsx');
    expect(historySrc).toMatch(/categoryFilterOptions\s*=\s*useMemo/);
    expect(historySrc).toMatch(/options=\{categoryFilterOptions\}/);
  });

  it('implements Apple-calibrated critically-damped spring parameters via SLIDE_SPRING constant', () => {
    expect(src).toMatch(/damping:\s*49/);
    expect(src).toMatch(/stiffness:\s*447\.4/);
    expect(src).toMatch(/overshootClamping:\s*true/);
    expect(src).toMatch(/SLIDE_SPRING/);
  });

  it('cancels in-flight animations on rapid consecutive taps to prevent animation stacking', () => {
    expect(src).toMatch(/cancelAnimation\(pillX\)/);
    expect(src).toMatch(/cancelAnimation\(pillWidth\)/);
    // Must NOT reference dead shared values (stretchAnim, squishAnim, leadAnim removed for perf)
    expect(src).not.toMatch(/cancelAnimation\(stretchAnim\)/);
    expect(src).not.toMatch(/cancelAnimation\(squishAnim\)/);
    expect(src).not.toMatch(/cancelAnimation\(leadAnim\)/);
  });

  it('FilterItem uses native worklet spring scale for touch feedback', () => {
    expect(src).toMatch(/scale\.value\s*=\s*withSpring\(0\.94/);
    expect(src).toMatch(/scale\.value\s*=\s*withSpring\(1/);
    expect(src).toMatch(/React\.memo/);
  });

  it('implements immediate touch-driven animation dispatch in handleSelect before parent state update', () => {
    expect(src).toMatch(/const handleSelect\s*=\s*useCallback/);
    expect(src).toMatch(/animateTo\(targetKey\)/);
    expect(src).toMatch(/onChange\(id\)/);
  });

  it('tracks lastActiveLayout ref to prevent in-flight animation clobbering by render passes', () => {
    expect(src).toMatch(/lastActiveLayout\s*=\s*useRef/);
    expect(src).toMatch(/lastActiveLayout\.current\.x\s*!==\s*activeLayout\.x/);
    expect(src).toMatch(/lastActiveLayout\.current\.width\s*!==\s*activeLayout\.width/);
  });

  it('memoizes BouncyCategoryFilter with React.memo to prevent unnecessary component re-renders', () => {
    expect(src).toMatch(/export const BouncyCategoryFilter = React\.memo<Props>/);
  });
});

describe('BouncyCategoryFilter Behavioral Lifecycle & Immediate Dispatch (Phase A.5.7)', () => {
  const Component = (BouncyCategoryFilter as any).type || BouncyCategoryFilter;

  const mockOptions = [
    { id: null, name: 'All' },
    { id: 'cat-ent', name: 'Entertainment' },
    { id: 'cat-trn', name: 'Transport' },
  ];

  beforeEach(() => {
    reanimatedSpies.resetAll();
  });

  it('initializes layout without animation (instant snap on frame 0)', () => {
    const onChange = vi.fn();
    const { result } = renderHook((props: any) => Component(props), {
      options: mockOptions,
      value: null,
      onChange,
    });

    const items = result.current.props.children.props.children[1];

    // Report layout for 'all'
    items[0].props.onLayout({
      nativeEvent: { layout: { x: 4.19, width: 56.76 } },
    });

    const pillLeft = reanimatedSpies.sharedValues[0];
    const pillWidth = reanimatedSpies.sharedValues[1];

    expect(pillLeft.value).toBe(4.19);
    expect(pillWidth.value).toBe(56.76);
    // Initial mount must NOT trigger withSpring animation
    expect(reanimatedSpies.withSpringCalls).toHaveLength(0);
  });

  it('dispatches animateTo on native UI thread BEFORE invoking onChange on press', () => {
    const trace: string[] = [];
    const onChange = vi.fn((id: string | null) => {
      trace.push(`onChange:${id}`);
    });

    reanimatedSpies.executionTrace = trace;

    const { result } = renderHook((props: any) => Component(props), {
      options: mockOptions,
      value: null,
      onChange,
    });

    // Measure both tabs
    let items = result.current.props.children.props.children[1];
    items[0].props.onLayout({ nativeEvent: { layout: { x: 4.19, width: 56.76 } } });
    items = result.current.props.children.props.children[1];
    items[1].props.onLayout({ nativeEvent: { layout: { x: 60.95, width: 138.67 } } });

    // Clear initial traces from layout snaps
    trace.length = 0;

    // Get fresh items with updated layout closures
    items = result.current.props.children.props.children[1];

    // Press Entertainment
    items[1].props.onPress();

    // Verify execution order: Reanimated animation starts BEFORE parent onChange
    const springIdx = trace.findIndex((t) => t.startsWith('withSpring:60.95'));
    const onChangeIdx = trace.findIndex((t) => t.startsWith('onChange:cat-ent'));

    expect(springIdx).toBeGreaterThanOrEqual(0);
    expect(onChangeIdx).toBeGreaterThanOrEqual(0);
    expect(springIdx).toBeLessThan(onChangeIdx);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('cat-ent');
  });

  it('does NOT launch redundant animation when selecting the already-active category', () => {
    const onChange = vi.fn();
    const { result } = renderHook((props: any) => Component(props), {
      options: mockOptions,
      value: null,
      onChange,
    });

    let items = result.current.props.children.props.children[1];
    items[0].props.onLayout({ nativeEvent: { layout: { x: 4.19, width: 56.76 } } });

    reanimatedSpies.withSpringCalls.length = 0;

    items = result.current.props.children.props.children[1];
    // Press 'All' again while 'All' is already active
    items[0].props.onPress();

    // Redundant animation must NOT be launched
    expect(reanimatedSpies.withSpringCalls).toHaveLength(0);
    // onChange is still fired to maintain standard form component behavior
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('does NOT launch animation when target layout is unmeasured', () => {
    const onChange = vi.fn();
    const { result } = renderHook((props: any) => Component(props), {
      options: mockOptions,
      value: null,
      onChange,
    });

    let items = result.current.props.children.props.children[1];
    // Only 'All' is measured; 'Transport' (index 2) is unmeasured
    items[0].props.onLayout({ nativeEvent: { layout: { x: 4.19, width: 56.76 } } });

    reanimatedSpies.withSpringCalls.length = 0;

    items = result.current.props.children.props.children[1];
    // Press unmeasured 'Transport'
    items[2].props.onPress();

    // Animation must NOT launch with undefined coordinates
    expect(reanimatedSpies.withSpringCalls).toHaveLength(0);
    // onChange is still propagated
    expect(onChange).toHaveBeenCalledWith('cat-trn');
  });

  it('preserves in-flight animation progress during unrelated parent re-renders', () => {
    const onChange = vi.fn();
    const { result, rerender } = renderHook((props: any) => Component(props), {
      options: mockOptions,
      value: null as string | null,
      onChange,
    });

    let items = result.current.props.children.props.children[1];
    items[0].props.onLayout({ nativeEvent: { layout: { x: 4.19, width: 56.76 } } });
    items = result.current.props.children.props.children[1];
    items[1].props.onLayout({ nativeEvent: { layout: { x: 60.95, width: 138.67 } } });

    // Press Entertainment to initiate slide
    items = result.current.props.children.props.children[1];
    items[1].props.onPress();

    const pillLeft = reanimatedSpies.sharedValues[0];
    const pillWidth = reanimatedSpies.sharedValues[1];

    // Simulate mid-flight spring state (pill is traveling across at x=32.5)
    pillLeft.value = 32.5;
    pillWidth.value = 95.0;

    // Trigger parent re-render (e.g. search query or unrelated state change in HistoryScreen)
    rerender({
      options: [...mockOptions],
      value: 'cat-ent',
      onChange,
    });

    // In-flight progress must NOT be prematurely snapped/reset to destination
    expect(pillLeft.value).toBe(32.5);
    expect(pillWidth.value).toBe(95.0);
  });

  it('updates tracked layout and pill geometry when a genuine layout change occurs', () => {
    const onChange = vi.fn();
    const { result } = renderHook((props: any) => Component(props), {
      options: mockOptions,
      value: null,
      onChange,
    });

    let items = result.current.props.children.props.children[1];
    items[0].props.onLayout({ nativeEvent: { layout: { x: 4.19, width: 56.76 } } });

    const pillLeft = reanimatedSpies.sharedValues[0];
    const pillWidth = reanimatedSpies.sharedValues[1];

    expect(pillLeft.value).toBe(4.19);
    expect(pillWidth.value).toBe(56.76);

    // Simulate dynamic font size change or window resize updating layout of 'All'
    items = result.current.props.children.props.children[1];
    items[0].props.onLayout({
      nativeEvent: { layout: { x: 6.0, width: 68.0 } },
    });

    // Pill geometry must accurately update to new layout measurements
    expect(pillLeft.value).toBe(6.0);
    expect(pillWidth.value).toBe(68.0);
  });

  it('handles rapid consecutive selections (All -> Entertainment -> Transport -> All) seamlessly', () => {
    const onChange = vi.fn();
    const { result } = renderHook((props: any) => Component(props), {
      options: mockOptions,
      value: null,
      onChange,
    });

    let items = result.current.props.children.props.children[1];
    items[0].props.onLayout({ nativeEvent: { layout: { x: 4.19, width: 56.76 } } });
    items = result.current.props.children.props.children[1];
    items[1].props.onLayout({ nativeEvent: { layout: { x: 60.95, width: 138.67 } } });
    items = result.current.props.children.props.children[1];
    items[2].props.onLayout({ nativeEvent: { layout: { x: 199.62, width: 107.81 } } });

    reanimatedSpies.reset();

    // 1. Rapid tap Entertainment
    items = result.current.props.children.props.children[1];
    items[1].props.onPress();
    expect(reanimatedSpies.cancelAnimationCalls.length).toBeGreaterThan(0);
    expect(reanimatedSpies.withSpringCalls).toContainEqual(
      expect.objectContaining({ toValue: 60.95 })
    );

    // 2. Immediate mid-flight interruption to Transport
    items = result.current.props.children.props.children[1];
    items[2].props.onPress();
    expect(reanimatedSpies.withSpringCalls).toContainEqual(
      expect.objectContaining({ toValue: 199.62 })
    );

    // 3. Immediate mid-flight interruption back to All
    items = result.current.props.children.props.children[1];
    items[0].props.onPress();
    expect(reanimatedSpies.withSpringCalls).toContainEqual(
      expect.objectContaining({ toValue: 4.19 })
    );

    // Latest selection ('All') must be the final active spring target
    const lastLeftSpring = reanimatedSpies.withSpringCalls
      .filter((c) => c.toValue === 4.19 || c.toValue === 60.95 || c.toValue === 199.62)
      .pop();
    expect(lastLeftSpring?.toValue).toBe(4.19);

    const lastWidthSpring = reanimatedSpies.withSpringCalls
      .filter((c) => c.toValue === 56.76 || c.toValue === 138.67 || c.toValue === 107.81)
      .pop();
    expect(lastWidthSpring?.toValue).toBe(56.76);

    // All shared values must settle to canonical target coordinates
    const pillX = reanimatedSpies.sharedValues[0];
    const pillWidth = reanimatedSpies.sharedValues[1];

    expect(pillX.value).toBe(4.19);
    expect(pillWidth.value).toBe(56.76);
    // Dead shared values (stretchAnim, squishAnim, leadAnim) removed — only 2 shared values remain
    // plus 1 per FilterItem scale = 2 + 3 items = 5 total, but only first 2 are pill geometry
  });
});
