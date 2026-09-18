import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

const PAYMENT_PADDING = 5;

interface TypeSegmentItemProps {
  label: string;
  isActive: boolean;
  onPress: () => void;
}

const TypeSegmentItem: React.FC<TypeSegmentItemProps> = ({
  label,
  isActive,
  onPress,
}) => {
  const { colors } = useTheme();
  const activeAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.timing(activeAnim, {
      toValue: isActive ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [isActive]);

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.95,
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

  const textColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [colors.textSecondary, colors.forestGreen],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.typeToggleSegment}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View
        style={[
          styles.typeSegmentContent,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <Animated.Text
          numberOfLines={1}
          style={[
            styles.typeToggleText,
            {
              color: textColor,
              fontFamily: FontFamily.bold,
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
};

export interface BouncyTypeToggleProps {
  value: 'expense' | 'income';
  onChange: (type: 'expense' | 'income') => void;
}

const TYPE_OPTIONS: { type: 'expense' | 'income'; label: string }[] = [
  { type: 'expense', label: 'Expense' },
  { type: 'income', label: 'Add Money' },
];

export const BouncyTypeToggle: React.FC<BouncyTypeToggleProps> = ({ value, onChange }) => {
  const { colors } = useTheme();
  const initialWidth = Dimensions.get('window').width - 48;
  const [containerWidth, setContainerWidth] = useState(initialWidth);
  const activeIndex = value === 'expense' ? 0 : 1;
  const slideAnim = useRef(new Animated.Value(activeIndex)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeIndex,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [activeIndex]);

  const innerWidth = containerWidth > 0 ? containerWidth - PAYMENT_PADDING * 2 : 0;
  const segmentWidth = innerWidth > 0 ? innerWidth / 2 : 0;

  const translateX = slideAnim.interpolate({
    inputRange: [-0.2, 0, 1, 1.2],
    outputRange: [-2, 0, segmentWidth, segmentWidth + 2],
    extrapolate: 'clamp',
  });

  const expensePillOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  const incomePillOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  return (
    <View
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        if (w > 0 && Math.abs(w - containerWidth) > 1) {
          setContainerWidth(w);
        }
      }}
      style={[
        styles.typeToggleContainer,
        { backgroundColor: colors.inputBg, padding: PAYMENT_PADDING },
      ]}
    >
      {/* Gliding Pill with Peach-Coral (Expense) and Mint-Green (Add Money) crossfade */}
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.paymentSlidingPill,
            {
              width: segmentWidth,
              transform: [{ translateX }],
            },
          ]}
        >
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: BorderRadius.pill,
                backgroundColor: colors.peachCoral,
                opacity: expensePillOpacity,
              },
            ]}
          />
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                borderRadius: BorderRadius.pill,
                backgroundColor: colors.mintGreen,
                opacity: incomePillOpacity,
              },
            ]}
          />
        </Animated.View>
      )}

      {/* Segments: Expense and Add Money */}
      {TYPE_OPTIONS.map((opt) => (
        <TypeSegmentItem
          key={opt.type}
          label={opt.label}
          isActive={value === opt.type}
          onPress={() => onChange(opt.type)}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  typeToggleContainer: {
    height: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    position: 'relative',
    overflow: 'hidden',
  },
  paymentSlidingPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: BorderRadius.pill,
  },
  typeToggleSegment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  typeSegmentContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.element,
  },
  typeToggleText: {
    fontSize: FontSize.body,
    includeFontPadding: false,
    textAlignVertical: 'center',
    letterSpacing: 0.2,
  },
});
