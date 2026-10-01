import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockLayoutAnimation, mockUIManager } = vi.hoisted(() => {
  return {
    mockLayoutAnimation: {
      Presets: {
        easeInEaseOut: { duration: 300 },
        spring: { duration: 500 },
      },
      configureNext: vi.fn(),
    },
    mockUIManager: {
      setLayoutAnimationEnabledExperimental: vi.fn(),
    },
  };
});

vi.mock('react-native', () => ({
  Platform: {
    OS: 'android',
  },
  UIManager: mockUIManager,
  LayoutAnimation: mockLayoutAnimation,
}));

import { enableLayoutAnimationOnAndroid, configureLayoutAnimation } from '../src/lib/animationUtils';

describe('animationUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls LayoutAnimation.configureNext with default easeInEaseOut preset', () => {
    configureLayoutAnimation();
    expect(mockLayoutAnimation.configureNext).toHaveBeenCalledWith(mockLayoutAnimation.Presets.easeInEaseOut);
  });

  it('calls LayoutAnimation.configureNext with a custom animation config', () => {
    const customConfig = mockLayoutAnimation.Presets.spring as any;
    configureLayoutAnimation(customConfig);
    expect(mockLayoutAnimation.configureNext).toHaveBeenCalledWith(customConfig);
  });

  it('safely handles enableLayoutAnimationOnAndroid without throwing', () => {
    expect(() => enableLayoutAnimationOnAndroid()).not.toThrow();
  });
});
