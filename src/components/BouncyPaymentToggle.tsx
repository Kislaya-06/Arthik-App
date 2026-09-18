import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Wallet, CheckSquare, CreditCard } from 'lucide-react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

const PAYMENT_PADDING = 5;

export const EXPENSE_PAYMENT_OPTIONS = [
  { mode: 'cash' as const, label: 'Cash', Icon: Wallet },
  { mode: 'upi' as const, label: 'UPI', Icon: CheckSquare },
  { mode: 'card' as const, label: 'Card', Icon: CreditCard },
];

const INCOME_PAYMENT_OPTIONS = [
  { mode: 'cash' as const, label: 'Cash', Icon: Wallet },
  { mode: 'upi' as const, label: 'UPI', Icon: CheckSquare },
];

export { INCOME_PAYMENT_OPTIONS };

interface PaymentSegmentItemProps {
  label: string;
  Icon: any;
  isActive: boolean;
  onPress: () => void;
}

const PaymentSegmentItem: React.FC<PaymentSegmentItemProps> = ({
  label,
  Icon,
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
      useNativeDriver: true,
    }).start();
  }, [isActive]);

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

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.paymentToggleSegment}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
    >
      <Animated.View
        style={[
          styles.paymentSegmentContent,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        {/* Inactive Layer: secondary gray text & icon */}
        <View style={styles.paymentLabelRow}>
          <Icon size={16} color={colors.textSecondary} />
          <Text
            numberOfLines={1}
            style={[
              styles.paymentToggleText,
              {
                color: colors.textSecondary,
                fontFamily: FontFamily.bold,
              },
            ]}
          >
            {label}
          </Text>
        </View>

        {/* Active Layer: dark navy text & icon with crossfade opacity */}
        <Animated.View
          style={[
            styles.paymentLabelRow,
            styles.paymentActiveOverlay,
            { opacity: activeAnim },
          ]}
          pointerEvents="none"
        >
          <Icon size={16} color={colors.forestGreen} />
          <Text
            numberOfLines={1}
            style={[
              styles.paymentToggleText,
              {
                color: colors.forestGreen,
                fontFamily: FontFamily.bold,
              },
            ]}
          >
            {label}
          </Text>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
};

export interface BouncyPaymentToggleProps {
  value: 'cash' | 'upi' | 'card';
  onChange: (mode: 'cash' | 'upi' | 'card') => void;
  options: { mode: 'cash' | 'upi' | 'card'; label: string; Icon: any }[];
  activeColor: string;
}

export const BouncyPaymentToggle: React.FC<BouncyPaymentToggleProps> = ({
  value,
  onChange,
  options,
  activeColor,
}) => {
  const { colors } = useTheme();
  const initialWidth = Dimensions.get('window').width - 48;
  const [containerWidth, setContainerWidth] = useState(initialWidth);
  const count = options.length;
  const activeIndex = options.findIndex((opt) => opt.mode === value);
  const slideAnim = useRef(new Animated.Value(activeIndex >= 0 ? activeIndex : 0)).current;

  useEffect(() => {
    if (activeIndex >= 0) {
      Animated.spring(slideAnim, {
        toValue: activeIndex,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [activeIndex]);

  const innerWidth = containerWidth > 0 ? containerWidth - PAYMENT_PADDING * 2 : 0;
  const segmentWidth = innerWidth > 0 && count > 0 ? innerWidth / count : 0;

  const inputRange = [-0.2, ...options.map((_, i) => i), count - 1 + 0.2];
  const outputRange = [-2, ...options.map((_, i) => i * segmentWidth), (count - 1) * segmentWidth + 2];

  const translateX = slideAnim.interpolate({
    inputRange,
    outputRange,
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
        styles.paymentToggleContainer,
        { backgroundColor: colors.inputBg, padding: PAYMENT_PADDING },
      ]}
    >
      {/* Sliding Bouncy Pill */}
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.paymentSlidingPill,
            {
              width: segmentWidth,
              backgroundColor: activeColor,
              transform: [{ translateX }],
            },
          ]}
        />
      )}

      {/* Segments */}
      {options.map(({ mode, label, Icon }) => {
        const isActive = value === mode;
        return (
          <PaymentSegmentItem
            key={mode}
            label={label}
            Icon={Icon}
            isActive={isActive}
            onPress={() => onChange(mode)}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  paymentToggleContainer: {
    height: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    position: 'relative',
    marginBottom: Spacing.block,
    overflow: 'hidden',
  },
  paymentSlidingPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: BorderRadius.pill,
  },
  paymentToggleSegment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  paymentSegmentContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentActiveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentToggleText: {
    fontSize: FontSize.bodySmall,
    marginLeft: Spacing.element,
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: [{ translateY: -0.5 }],
  },
});
