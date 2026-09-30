import React, { useRef, useEffect } from 'react';
import {
  View,
  Text,
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
}

export const AnimatedToggle: React.FC<AnimatedToggleProps> = ({
  value,
  onValueChange,
  width = 58,
  height = 30,
}) => {
  const { colors, isDark } = useTheme();

  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: value ? 1 : 0,
      tension: 50,
      friction: 6,
      useNativeDriver: false, // color interpolation needs false
    }).start();
  }, [value]);

  const toggle = () => {
    onValueChange(!value);
  };

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.9,
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

  const padding = 4;
  const thumbSize = height - padding * 2;
  const maxTranslate = width - thumbSize - padding * 2;

  // Track remains a constant light/dark color as per the premium toggle style
  const trackBg = isDark ? 'rgba(255, 255, 255, 0.1)' : '#F2F2F2';

  // Colors based on state
  const offColor = isDark ? '#666666' : '#C4C4C4';
  const onColor = colors.mintGreen;

  const thumbColor = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [offColor, onColor],
  });

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, maxTranslate],
  });

  // Rotate to give a "rolling ball" effect as requested
  const rotate = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const textOpacityOn = animValue;
  const textOpacityOff = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  const trackBorder = isDark ? 'rgba(255, 255, 255, 0.05)' : '#E5E5E5';

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
              right: padding + 4,
              opacity: textOpacityOff,
              color: offColor,
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
              left: padding + 5,
              opacity: textOpacityOn,
              color: onColor,
            },
          ]}
        >
          ON
        </Animated.Text>

        {/* Rolling Thumb */}
        <Animated.View
          style={[
            styles.thumb,
            {
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: thumbColor,
              transform: [{ translateX }, { rotate }],
            },
          ]}
        >
          {/* Subtle inner highlight to make rotation visible */}
          <View style={styles.thumbHighlight} />
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    justifyContent: 'center',
    padding: 4,
    overflow: 'hidden',
  },
  thumb: {
    position: 'absolute',
    left: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbHighlight: {
    width: '30%',
    height: '30%',
    borderRadius: 999,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    position: 'absolute',
    top: '15%',
    right: '25%',
  },
  text: {
    position: 'absolute',
    fontFamily: FontFamily.bold,
    fontSize: 10,
  },
});
