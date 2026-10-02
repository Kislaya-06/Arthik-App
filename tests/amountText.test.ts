import { describe, it, expect, vi } from 'vitest';

vi.mock('react-native', () => ({
  View: (props: any) => ({ type: 'View', props }),
  Text: (props: any) => ({ type: 'Text', props }),
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
    mint: '#B8E0C8',
    mintDark: '#7FB896',
    coral: '#F4B8AE',
    peachCoral: '#F4B8AE',
    isDark: false,
  };
  return {
    useTheme: () => ({ colors: dummyColors }),
    useThemeStore: () => ({ colors: dummyColors }),
  };
});

import { AmountText } from '../src/components/ui/AmountText';

describe('AmountText Primitive (Seam: src/components/ui/AmountText.tsx)', () => {
  it('formats positive amount with Indian comma grouping by default', () => {
    const el = AmountText({ value: 125000 }) as any;
    expect(el.props.children).toEqual(['₹', '1,25,000']);
    expect(el.props.accessibilityLabel).toBe('1,25,000 rupees');
  });

  it('formats signed positive income amount with +₹ prefix', () => {
    const el = AmountText({ value: 5000, direction: 'income', signed: true }) as any;
    expect(el.props.children).toEqual(['+₹', '5,000']);
    expect(el.props.accessibilityLabel).toBe('plus 5,000 rupees income');
  });

  it('formats signed expense amount with -₹ prefix and correct a11y label', () => {
    const el = AmountText({ value: 420, direction: 'expense', signed: true }) as any;
    expect(el.props.children).toEqual(['-₹', '420']);
    expect(el.props.accessibilityLabel).toBe('minus 420 rupees expense');
  });

  it('formats negative number with -₹ prefix even if direction is neutral', () => {
    const el = AmountText({ value: -1500 }) as any;
    expect(el.props.children).toEqual(['-₹', '1,500']);
  });

  it('renders hero role with decomposed optical alignment elements', () => {
    const el = AmountText({ value: 75000, role: 'hero' }) as any;
    expect(el.props.accessibilityLabel).toBe('75,000 rupees');
    const [symbolEl, numberEl] = el.props.children;
    expect(symbolEl.props.children).toBe('₹');
    expect(numberEl.props.children).toBe('75,000');
  });

  it('preserves decimals when showDecimals is true', () => {
    const el = AmountText({ value: 1250.5, showDecimals: true }) as any;
    expect(el.props.children).toEqual(['₹', '1,250.50']);
  });
});
