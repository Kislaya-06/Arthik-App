import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { useTheme } from '../store/themeStore';
import { Spacing, BorderRadius, FontFamily } from '../config/theme';
import { Filter } from '../lib/expenseFilters';

const FILTER_PADDING = 4;
const TOGGLE_HEIGHT = 48;

interface FilterSegmentItemProps {
  label: Filter;
  isActive: boolean;
  onPress: () => void;
  activeColor: string;
  inactiveColor: string;
}

const FilterSegmentItem: React.FC<FilterSegmentItemProps> = ({
  label,
  isActive,
  onPress,
  activeColor,
  inactiveColor,
}) => {
  const pressScale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(pressScale, {
      toValue: 0.93,
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

  const textColor = isActive ? activeColor : inactiveColor;

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.filterToggleSegment}
      hitSlop={{ top: 8, bottom: 8, left: 2, right: 2 }}
    >
      <Animated.View
        style={[
          styles.filterSegmentContent,
          { transform: [{ scale: pressScale }] },
        ]}
      >
        <Text
          numberOfLines={1}
          style={[
            styles.filterToggleText,
            {
              color: textColor,
              fontFamily: isActive ? FontFamily.bold : FontFamily.semibold,
            },
          ]}
        >
          {label}
        </Text>
      </Animated.View>
    </Pressable>
  );
};

export interface BouncyFilterToggleProps {
  value: Filter;
  onChange: (filter: Filter) => void;
  options: readonly Filter[];
}

export const BouncyFilterToggle: React.FC<BouncyFilterToggleProps> = ({
  value,
  onChange,
  options,
}) => {
  const { colors, isDark } = useTheme();
  const initialWidth = Dimensions.get('window').width - Spacing.gutter * 2;
  const [containerWidth, setContainerWidth] = useState(initialWidth);
  const count = options.length;
  const activeIndex = options.indexOf(value);
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

  const innerWidth = containerWidth > 0 ? containerWidth - FILTER_PADDING * 2 : 0;
  const segmentWidth = innerWidth > 0 && count > 0 ? innerWidth / count : 0;

  const translateX = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, segmentWidth],
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
        styles.filterToggleContainer,
        {
          backgroundColor: isDark ? colors.card : colors.cardSubtle,
          borderColor: colors.border,
          padding: FILTER_PADDING,
        },
      ]}
    >
      {/* Sliding Bouncy Pill */}
      {segmentWidth > 0 && (
        <Animated.View
          style={[
            styles.filterSlidingPill,
            {
              width: segmentWidth,
              backgroundColor: colors.mintGreen,
              transform: [{ translateX }],
            },
          ]}
        />
      )}

      {/* Segments */}
      {options.map((opt) => {
        const isActive = value === opt;
        return (
          <FilterSegmentItem
            key={opt}
            label={opt}
            isActive={isActive}
            onPress={() => onChange(opt)}
            activeColor={colors.forestGreen}
            inactiveColor={isDark ? colors.textPrimary : colors.textSecondary}
          />
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  filterToggleContainer: {
    height: TOGGLE_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    position: 'relative',
    borderWidth: 1,
    overflow: 'hidden',
  },
  filterSlidingPill: {
    position: 'absolute',
    top: FILTER_PADDING,
    bottom: FILTER_PADDING,
    left: FILTER_PADDING,
    borderRadius: BorderRadius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1.5 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
    elevation: 2,
  },
  filterToggleSegment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  filterSegmentContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterToggleText: {
    fontSize: 14,
    includeFontPadding: false,
    textAlign: 'center',
  },
});
