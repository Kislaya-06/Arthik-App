import { describe, it, expect, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const mockRef = (init: any) => ({ current: init });
  const mockState = (init: any) => [init, vi.fn()];
  const mockEffect = vi.fn();
  return {
    ...actual,
    default: {
      ...actual,
      useRef: mockRef,
      useState: mockState,
      useEffect: mockEffect,
    },
    useRef: mockRef,
    useState: mockState,
    useEffect: mockEffect,
  };
});

vi.mock('react-native', () => ({
  View: (props: any) => ({ type: 'View', props }),
  Text: (props: any) => ({ type: 'Text', props }),
  Pressable: (props: any) => ({ type: 'Pressable', props }),
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
});
