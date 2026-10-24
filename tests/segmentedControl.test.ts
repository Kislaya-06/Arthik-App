import { describe, it, expect, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const mockRef = (init: any) => ({ current: init });
  const mockState = (init: any) => [init, vi.fn()];
  const mockEffect = vi.fn();
  const mockCallback = (fn: any) => fn;
  const mockMemo = (comp: any) => comp;
  const mockUseMemo = (fn: any) => fn();
  const mockStartTransition = (fn: any) => fn();
  return {
    ...actual,
    default: {
      ...actual,
      useRef: mockRef,
      useState: mockState,
      useEffect: mockEffect,
      useCallback: mockCallback,
      useMemo: mockUseMemo,
      memo: mockMemo,
      startTransition: mockStartTransition,
    },
    useRef: mockRef,
    useState: mockState,
    useEffect: mockEffect,
    useCallback: mockCallback,
    useMemo: mockUseMemo,
    memo: mockMemo,
    startTransition: mockStartTransition,
  };
});

vi.mock('react-native-reanimated', () => {
  const useSharedValue = (init: any) => ({ value: init });
  const useAnimatedStyle = (fn: any) => fn();
  const withSpring = (val: any) => val;
  const withTiming = (val: any) => val;
  const withSequence = (...anims: any[]) => anims[anims.length - 1];
  const cancelAnimation = () => {};
  const useReducedMotion = () => false;
  const interpolateColor = (_val: any, _in: any[], out: any[]) => out?.[0] ?? '#000000';

  return {
    default: {
      View: (props: any) => ({ type: 'Animated.View', props }),
    },
    useSharedValue,
    useAnimatedStyle,
    useReducedMotion,
    withSpring,
    withTiming,
    withSequence,
    cancelAnimation,
    interpolateColor,
    Easing: {
      out: (fn: any) => fn,
      quad: 'quad',
    },
  };
});

vi.mock('react-native', () => ({
  View: (props: any) => ({ type: 'View', props }),
  Text: (props: any) => ({ type: 'Text', props }),
  Pressable: (props: any) => ({ type: 'Pressable', props }),
  Platform: { OS: 'android' },
  Animated: {
    View: (props: any) => ({ type: 'Animated.View', props }),
    Value: class {
      val: number;
      constructor(val: number) { this.val = val; }
      setValue(v: number) { this.val = v; }
    },
    spring: () => ({ start: vi.fn() }),
    timing: () => ({ start: vi.fn() }),
    sequence: () => ({ start: vi.fn() }),
    parallel: () => ({ start: vi.fn() }),
  },
  useAnimatedValue: (val: number) => ({
    val,
    setValue: vi.fn(),
    interpolate: vi.fn(() => 0),
    stopAnimation: vi.fn(),
  }),
  Easing: {
    out: vi.fn(),
    quad: vi.fn(),
  },
  StyleSheet: {
    create: (styles: any) => styles,
    absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  Appearance: {
    getColorScheme: vi.fn(() => 'light'),
    addChangeListener: vi.fn(() => ({ remove: vi.fn() })),
  },
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock('../src/store/themeStore', () => {
  const dummyColors = {
    cardSubtle: '#F1F5F9',
    borderSubtle: '#E2E8F0',
    mintGreen: '#B8E0C8',
    peachCoral: '#FF7B6B',
    forestGreen: '#1A2B4C',
    textSecondary: '#64748B',
    mintGreenDark: '#65A882',
    isDark: false,
  };
  return {
    useTheme: () => ({ colors: dummyColors }),
    useThemeStore: () => ({ colors: dummyColors }),
  };
});

import { SegmentedControl } from '../src/components/ui/SegmentedControl';

describe('SegmentedControl Touch Reliability & Selection Invariant (Seam: src/components/ui/SegmentedControl.tsx)', () => {
  it('renders all options and sets up correct accessibility roles and keys', () => {
    const onChange = vi.fn();
    const el = SegmentedControl({
      options: ['Weekly', 'Monthly', 'Yearly'],
      selectedKey: 'Weekly',
      onChange,
    }) as any;

    expect(el.type).toBeTruthy();
    expect(el.props.accessibilityRole).toBe('tablist');

    // The optionsRow is the second child in container
    const optionsRow = el.props.children[1];
    expect(optionsRow.type).toBeTruthy();
    expect(optionsRow.props.children).toHaveLength(3);

    const weeklyOption = optionsRow.props.children[0];
    expect(weeklyOption.props.option.key).toBe('Weekly');
    expect(weeklyOption.props.isSelected).toBe(true);

    const monthlyOption = optionsRow.props.children[1];
    expect(monthlyOption.props.option.key).toBe('Monthly');
    expect(monthlyOption.props.isSelected).toBe(false);

    const yearlyOption = optionsRow.props.children[2];
    expect(yearlyOption.props.option.key).toBe('Yearly');
    expect(yearlyOption.props.isSelected).toBe(false);
  });

  it('guarantees direct, reliable selection when clicking unselected options (Monthly -> Weekly)', () => {
    const onChange = vi.fn();
    // Start with Monthly selected
    const el = SegmentedControl({
      options: ['Weekly', 'Monthly', 'Yearly'],
      selectedKey: 'Monthly',
      onChange,
    }) as any;

    const optionsRow = el.props.children[1];
    const weeklyItem = optionsRow.props.children[0];
    expect(weeklyItem.props.isSelected).toBe(false);

    // Press Weekly
    weeklyItem.props.onPress();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Weekly');

    // Press Yearly
    const yearlyItem = optionsRow.props.children[2];
    yearlyItem.props.onPress();
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenCalledWith('Yearly');
  });

  it('allows repeated, rapid sequential tab switching without dropped taps or locked states', () => {
    const onChange = vi.fn();

    // Simulate user tapping Weekly -> Monthly -> Yearly -> Weekly -> Monthly -> Weekly
    const el = SegmentedControl({
      options: ['Weekly', 'Monthly', 'Yearly'],
      selectedKey: 'Monthly',
      onChange,
    }) as any;

    const optionsRow = el.props.children[1];
    const weeklyItem = optionsRow.props.children[0];

    // Tap Weekly 5 times sequentially
    for (let i = 1; i <= 5; i++) {
      weeklyItem.props.onPress();
      expect(onChange).toHaveBeenCalledTimes(i);
      expect(onChange).toHaveBeenLastCalledWith('Weekly');
    }
  });

  it('normalizes object options with custom labels and badges', () => {
    const onChange = vi.fn();
    const el = SegmentedControl({
      options: [
        { key: 'w', label: 'Week', badge: 'New' },
        { key: 'm', label: 'Month' },
      ],
      selectedKey: 'w',
      onChange,
    }) as any;

    const optionsRow = el.props.children[1];
    const option1 = optionsRow.props.children[0];
    expect(option1.props.option.label).toBe('Week');
    expect(option1.props.option.badge).toBe('New');

    option1.props.onPress();
    expect(onChange).toHaveBeenCalledWith('w');
  });

  it('guarantees geometry re-synchronization when options count changes dynamically (e.g. Expense 3-opts to Income 2-opts)', () => {
    const onChange = vi.fn();
    // 3 options (Expense: Cash, UPI, Card)
    const el3 = SegmentedControl({
      options: [
        { key: 'cash', label: 'Cash' },
        { key: 'upi', label: 'UPI' },
        { key: 'card', label: 'Card' },
      ],
      selectedKey: 'upi',
      onChange,
    }) as any;

    expect(el3.props.children[1].props.children).toHaveLength(3);
    expect(el3.props.children[1].props.children[1].props.isSelected).toBe(true);

    // 2 options (Income: Cash, UPI)
    const el2 = SegmentedControl({
      options: [
        { key: 'cash', label: 'Cash' },
        { key: 'upi', label: 'UPI' },
      ],
      selectedKey: 'upi',
      onChange,
    }) as any;

    expect(el2.props.children[1].props.children).toHaveLength(2);
    expect(el2.props.children[1].props.children[1].props.isSelected).toBe(true);
  });

  it('maintains consistent bold typography across both selected and unselected options to eliminate Android font-switch layout recalculations', () => {
    const onChange = vi.fn();
    const el = SegmentedControl({
      options: ['Daily', 'Weekly', 'Monthly', 'All'],
      selectedKey: 'Daily',
      onChange,
    }) as any;

    const optionsRow = el.props.children[1];
    const dailyItem = optionsRow.props.children[0];
    const weeklyItem = optionsRow.props.children[1];

    // Both selected and unselected option labels render with FontFamily.bold
    expect(dailyItem.props.isSelected).toBe(true);
    expect(weeklyItem.props.isSelected).toBe(false);

    // Render OptionItem elements and inspect label text style
    const dailyRendered = dailyItem.type(dailyItem.props);
    const weeklyRendered = weeklyItem.type(weeklyItem.props);

    // OptionItem -> Pressable -> Animated.View -> [optional badge, labelRow] -> labelRow.children[1] = Animated.Text
    const dailyLabelRow = dailyRendered.props.children.props.children[1];
    const dailyText = dailyLabelRow.props.children[1];
    const weeklyLabelRow = weeklyRendered.props.children.props.children[1];
    const weeklyText = weeklyLabelRow.props.children[1];

    const dailyFont = dailyText.props.style.find((s: any) => s && s.fontFamily)?.fontFamily;
    const weeklyFont = weeklyText.props.style.find((s: any) => s && s.fontFamily)?.fontFamily;

    expect(dailyFont).toBe('Quicksand_700Bold');
    expect(weeklyFont).toBe('Quicksand_700Bold');
  });

  it('commitOnSettle: reports only the LAST tap, and only after the pill has arrived (PILL_COMMIT_MS)', async () => {
    vi.useFakeTimers();
    const { PILL_COMMIT_MS } = await import('../src/lib/segmentedMotion');
    const onChange = vi.fn();
    const el = SegmentedControl({
      options: ['All', 'Daily', 'Weekly', 'Monthly'],
      selectedKey: 'Daily',
      onChange,
      commitOnSettle: true,
    }) as any;
    const row = el.props.children[1];
    row.props.children[2].props.onPress(); // Weekly
    vi.advanceTimersByTime(100);
    row.props.children[3].props.onPress(); // Monthly, mid-glide
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(PILL_COMMIT_MS - 1); // measured from the LAST move
    expect(onChange).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('Monthly');
    // Re-tapping after the pill has landed reports at once (parents ignore same-value changes).
    row.props.children[3].props.onPress();
    vi.advanceTimersByTime(0);
    expect(onChange).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('re-tapping the already selected option does not tick (Apple parity) but still reports', () => {
    const onChange = vi.fn();
    const el = SegmentedControl({
      options: ['Weekly', 'Monthly', 'Yearly'],
      selectedKey: 'Weekly',
      onChange,
    }) as any;
    const weekly = el.props.children[1].props.children[0];
    weekly.props.onPress();
    expect(onChange).toHaveBeenCalledWith('Weekly');
  });

  it('BouncyTypeToggle uses commitOnSettle to prevent jitter during spring glide', async () => {
    const { BouncyTypeToggle } = await import('../src/components/BouncyTypeToggle');
    const el = (BouncyTypeToggle as any)({
      value: 'expense',
      onChange: vi.fn(),
    });
    expect(el.props.commitOnSettle).toBe(true);
  });

  it('BouncyTypeToggle passes per-option activePillColor for real-time glide color interpolation', async () => {
    const { BouncyTypeToggle } = await import('../src/components/BouncyTypeToggle');
    const el = (BouncyTypeToggle as any)({
      value: 'expense',
      onChange: vi.fn(),
    });
    expect(el.props.options).toHaveLength(2);
    expect(el.props.options[0].activePillColor).toBeDefined();
    expect(el.props.options[1].activePillColor).toBeDefined();
    // Expense is Coral, Income is Mint
    expect(el.props.options[0].key).toBe('expense');
    expect(el.props.options[1].key).toBe('income');
  });

  it('SegmentedControl gracefully handles options with custom activePillColor', () => {
    const onChange = vi.fn();
    const el = SegmentedControl({
      options: [
        { key: 'expense', label: 'Expense', activePillColor: '#FF7B6B' },
        { key: 'income', label: 'Income', activePillColor: '#B8E0C8' },
      ],
      selectedKey: 'expense',
      onChange,
    }) as any;
    expect(el.type).toBeTruthy();
    expect(el.props.children[1].props.children).toHaveLength(2);
  });
});
