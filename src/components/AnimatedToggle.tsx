import React, { useRef, useEffect } from 'react';
import {
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import { useTheme } from '../store/themeStore';
import { FontFamily } from '../config/theme';

interface AnimatedToggleProps {
  value: boolean;
  onValueChange: (val: boolean) => void;
  width?: number;
  height?: number;
  onColor?: string;
  offColor?: string;
  trackColor?: string;
}

export const AnimatedToggle: React.FC<AnimatedToggleProps> = ({
  value,
  onValueChange,
  width = 58,
  height = 30,
  onColor,
  offColor,
  trackColor,
}) => {
  const { colors, isDark } = useTheme();

  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: value ? 1 : 0,
      tension: 70,
      friction: 8,
      useNativeDriver: false, // color interpolation
    }).start();
  }, [value, animValue]);

  const toggle = () => {
    onValueChange(!value);
  };

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.94,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 4,
      useNativeDriver: true,
    }).start();
  };

  const padding = height <= 28 ? 3 : 4;
  const thumbSize = height - padding * 2;
  const maxTranslate = width - thumbSize - padding * 2;

  // Track remains a constant light/dark color as per the premium toggle style
  const trackBg = trackColor || (isDark ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F2');

  // Colors based on state
  const defaultOffColor = isDark ? '#666666' : '#C4C4C4';
  const defaultOnColor = colors.mintGreen;

  const actualOffColor = offColor || defaultOffColor;
  const actualOnColor = onColor || defaultOnColor;

  const thumbColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [actualOffColor, actualOnColor],
  });

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxTranslate],
  });

  const textOpacityOn = animValue;
  const textOpacityOff = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const trackBorder = trackColor
    ? 'rgba(255, 255, 255, 0.2)'
    : isDark
    ? 'rgba(255, 255, 255, 0.05)'
    : '#E5E5E5';

  return (
    <Pressable
      onPress={toggle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
    >
      <Animated.View
        style={[
          styles.track,
          {
            width,
            height,
            borderRadius: height / 2,
            backgroundColor: trackBg,
            borderColor: trackBorder,
            borderWidth: 1,
            transform: [{ scale: pressScale }],
          },
        ]}
      >
        {/* OFF Text (Right Side) */}
        <Animated.Text
          style={[
            styles.text,
            {
              right: height <= 26 ? 4 : padding + 2,
              opacity: textOpacityOff,
              color: actualOffColor,
            },
          ]}
        >
          OFF
        </Animated.Text>

        {/* ON Text (Left Side) */}
        <Animated.Text
          style={[
            styles.text,
            {
              left: height <= 26 ? 4.5 : padding + 3,
              opacity: textOpacityOn,
              color: actualOnColor,
            },
          ]}
        >
          ON
        </Animated.Text>

        {/* Refined Sliding Thumb (Linear spring motion without rotation or rolling highlight) */}
        <Animated.View
          style={[
            styles.thumb,
            {
              left: padding,
              top: (height - thumbSize) / 2 - 0.5,
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX }],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    padding: 0,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    position: 'absolute',
    fontFamily: FontFamily.bold,
    fontSize: 9.5,
  },
});

export default AnimatedToggle;
