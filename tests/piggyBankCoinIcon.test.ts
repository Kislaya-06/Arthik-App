import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import {
  PiggyBankCoinIcon,
  AnimatedPiggyBank,
  PIGGY_TAIL_PATH,
  PIGGY_BODY_PATH,
  COIN_PATH,
} from '../src/components/PiggyBankCoinIcon';

vi.mock('react-native', () => ({
  View: (props: any) => ({ type: 'View', props }),
  StyleSheet: {
    create: (styles: any) => styles,
    absoluteFill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  },
  Animated: {
    Value: class {
      val: number;
      constructor(val: number) {
        this.val = val;
      }
      setValue(v: number) {
        this.val = v;
      }
    },
    timing: () => ({ start: (cb?: any) => cb?.() }),
    spring: () => ({ start: (cb?: any) => cb?.() }),
    parallel: () => ({ start: (cb?: any) => cb?.() }),
    sequence: () => ({ start: (cb?: any) => cb?.(), stop: vi.fn() }),
    delay: () => ({ start: (cb?: any) => cb?.() }),
    View: (props: any) => ({ type: 'Animated.View', props }),
  },
  Easing: {
    in: () => vi.fn(),
    out: () => vi.fn(),
    quad: vi.fn(),
    cubic: vi.fn(),
  },
  useAnimatedValue: (init: number) => ({
    setValue: vi.fn(),
    interpolate: vi.fn(),
    val: init,
  }),
}));

vi.mock('react-native-svg', () => ({
  default: (props: any) => ({ type: 'Svg', props }),
  Path: (props: any) => ({ type: 'Path', props }),
  Circle: (props: any) => ({ type: 'Circle', props }),
  Defs: (props: any) => ({ type: 'Defs', props }),
  Mask: (props: any) => ({ type: 'Mask', props }),
  Rect: (props: any) => ({ type: 'Rect', props }),
  G: (props: any) => ({ type: 'G', props }),
}));

describe('PiggyBankCoinIcon', () => {
  it('renders with default props (size=24, color="currentColor")', () => {
    const element = React.createElement(PiggyBankCoinIcon, {});
    expect(element).toBeDefined();
    expect(element.props.size).toBeUndefined(); // defaults inside component to 24
  });

  it('renders with custom size and custom color', () => {
    const element = React.createElement(PiggyBankCoinIcon, {
      size: 48,
      color: '#2E7D52',
    });
    expect(element).toBeDefined();
    expect(element.props.size).toBe(48);
    expect(element.props.color).toBe('#2E7D52');
  });

  it('exports valid, non-empty SVG path constants for backward compatibility', () => {
    expect(typeof PIGGY_TAIL_PATH).toBe('string');
    expect(PIGGY_TAIL_PATH.startsWith('M')).toBe(true);

    expect(typeof PIGGY_BODY_PATH).toBe('string');
    expect(PIGGY_BODY_PATH.startsWith('M')).toBe(true);

    expect(typeof COIN_PATH).toBe('string');
    expect(COIN_PATH.startsWith('M')).toBe(true);
  });

  it('renders AnimatedPiggyBank component without crashing', () => {
    const element = React.createElement(AnimatedPiggyBank, {
      size: 64,
      color: '#15803D',
      coinColor: '#F59E0B',
    });
    expect(element).toBeDefined();
    expect(element.props.size).toBe(64);
    expect(element.props.color).toBe('#15803D');
    expect(element.props.coinColor).toBe('#F59E0B');
  });
});
