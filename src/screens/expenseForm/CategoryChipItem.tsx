import React, { useMemo, useCallback, useEffect, useRef } from 'react';
import { Text, StyleSheet, Animated, Easing, useAnimatedValue } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { Category } from '../../store/categoryStore';
import { getCategoryIcon } from '../../lib/iconUtils';
import { getCategoryChipGradient } from '../../lib/colorUtils';
import { useTheme } from '../../store/themeStore';
import { FontFamily } from '../../config/theme';
import { PressableOpacity } from '../../components/ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../lib/pressFeedback';
import { styles } from '../ExpenseFormScreen.styles';

// ─── Animated Category Chip ─────────────────────────────────────────────────
export const CategoryChipItem = React.memo<{
  category: Category;
  isSelected: boolean;
  isPlaceholder: boolean;
  onSelect: (id: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}>(({ category, isSelected, isPlaceholder, onSelect, colors, isDark }) => {
  const scale = useAnimatedValue(1);
  const isFirstMount = useRef(true);
  const IconComp = getCategoryIcon(category.icon);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (isSelected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.96, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [isSelected, scale]);

  const chipColor = category.color || colors.mintGreen;

  const { startColor, midColor, endColor, contentColor } = useMemo(() => {
    if (!isSelected) {
      return {
        startColor: '',
        midColor: '',
        endColor: '',
        contentColor: colors.textPrimary,
      };
    }
    return getCategoryChipGradient(chipColor, isDark);
  }, [chipColor, isSelected, isDark, colors.textPrimary]);

  const gradId = `chip_grad_${(category.id || 'default').replace(/[^a-zA-Z0-9]/g, '')}`;

  const handlePress = useCallback(() => {
    if (!isPlaceholder) onSelect(category.id);
  }, [isPlaceholder, onSelect, category.id]);

  return (
    <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
      disabled={isPlaceholder}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          styles.categoryChip,
          isSelected
            ? { backgroundColor: midColor, borderColor: midColor }
            : { backgroundColor: colors.card, borderColor: colors.border },
          isPlaceholder && { opacity: 0.45 },
          { transform: [{ scale }] },
        ]}
      >
        {isSelected && (
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gradId} x1="10%" y1="0%" x2="90%" y2="100%">
                <Stop offset="0%" stopColor={startColor} />
                <Stop offset="50%" stopColor={midColor} />
                <Stop offset="100%" stopColor={endColor} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width="100%"
              height="100%"
              rx={20}
              ry={20}
              fill={`url(#${gradId})`}
            />
          </Svg>
        )}
        <IconComp
          size={16}
          color={contentColor}
          strokeWidth={isSelected ? 2.2 : 2.0}
        />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.categoryChipText,
            { color: contentColor, fontFamily: FontFamily.bold },
          ]}
        >
          {category.name}
        </Text>
      </Animated.View>
    </PressableOpacity>
  );
});
