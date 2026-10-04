import { describe, it, expect, vi } from 'vitest';

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    useRef: (init: any) => ({ current: init }),
  };
});

vi.mock('react-native', () => ({
  View: (props: any) => ({ type: 'View', props }),
  Text: (props: any) => ({ type: 'Text', props }),
  Pressable: (props: any) => ({ type: 'Pressable', props }),
  ActivityIndicator: (props: any) => ({ type: 'ActivityIndicator', props }),
  Animated: {
    View: (props: any) => ({ type: 'Animated.View', props }),
    Value: class {
      val: number;
      constructor(val: number) { this.val = val; }
      setValue(v: number) { this.val = v; }
    },
    spring: () => ({ start: vi.fn() }),
  },
  useAnimatedValue: (val: number) => ({
    val,
    setValue: vi.fn(),
    interpolate: vi.fn(() => 0),
    stopAnimation: vi.fn(),
  }),
  StyleSheet: {
    create: (styles: any) => styles,
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
    textPrimary: '#1A2B4C',
    textSecondary: '#8A8FA3',
    mintGreenDark: '#7FB896',
    cardSubtle: '#F5F6F9',
    border: '#E0E2E8',
    borderSubtle: '#F0F1F4',
    danger: '#EF4444',
    isDark: false,
  };
  return {
    useTheme: () => ({ colors: dummyColors }),
    useThemeStore: () => ({ colors: dummyColors }),
  };
});

import { AppButton } from '../src/components/ui/AppButton';

describe('AppButton Primitive (Seam: src/components/ui/AppButton.tsx)', () => {
  it('renders primary standard button with correct defaults', () => {
    const onPress = vi.fn();
    const el = AppButton({ label: 'Save', onPress }) as any;
    expect(el.type).toBeTruthy();
    const pressable = el.props.children;
    expect(pressable.type).toBeTruthy();
    expect(pressable.props.accessibilityRole).toBe('button');
    expect(pressable.props.accessibilityLabel).toBe('Save');
  });

  it('renders disabled button with disabled accessibility state and 0.5 opacity', () => {
    const el = AppButton({ label: 'Disabled', onPress: vi.fn(), disabled: true }) as any;
    const pressable = el.props.children;
    expect(pressable.props.disabled).toBe(true);
    expect(pressable.props.accessibilityState.disabled).toBe(true);
    const flattenedStyle = pressable.props.style[1];
    expect(flattenedStyle.opacity).toBe(0.5);
  });

  it('renders loading spinner when loading is true', () => {
    const el = AppButton({ label: 'Loading', onPress: vi.fn(), loading: true }) as any;
    const pressable = el.props.children;
    const spinner = pressable.props.children;
    expect(spinner.type).toBeTruthy();
  });
});
