import React, { useEffect, useMemo, useRef } from 'react';
import { Text, View, StyleSheet, Animated, Easing } from 'react-native';
import { GradientIconBadge } from '../../GradientIconBadge';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../../store/themeStore';
import { Category } from '../../../store/categoryStore';
import { getCategoryIcon } from '../../../lib/iconUtils';
import { getCategoryChipGradient } from '../../../lib/colorUtils';
import { FontFamily, Motion } from '../../../config/theme';
import { PressableOpacity } from '../../ui/PressableOpacity';
import { PRESS_DIM_OPACITY } from '../../../lib/pressFeedback';
import { styles } from '../ReviewSheet.styles';

// ─── Animated Category Chip (Parity with ExpenseFormScreen) ──────────────────
export const CategoryChipItem: React.FC<{
  category: Category;
  isSelected: boolean;
  onSelect: () => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}> = ({ category, isSelected, onSelect, colors, isDark }) => {
  const scale = useRef(new Animated.Value(1)).current;
  const IconComp = getCategoryIcon(category.icon);

  useEffect(() => {
    if (isSelected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: Motion.scale.chip, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: Motion.springs.release.tension, friction: Motion.springs.release.friction, useNativeDriver: true }),
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

  const gradId = `review_chip_grad_${(category.id || 'default').replace(/[^a-zA-Z0-9]/g, '')}`;

  return (
    <PressableOpacity activeOpacity={PRESS_DIM_OPACITY} onPress={onSelect}>
      <Animated.View
        style={[
          styles.categoryChip,
          isSelected
            ? { backgroundColor: midColor, borderColor: midColor }
            : { backgroundColor: colors.inputBg, borderColor: colors.borderSubtle },
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
            <Rect x={0} y={0} width="100%" height="100%" rx={21} ry={21} fill={`url(#${gradId})`} />
          </Svg>
        )}
        {isSelected ? (
          <View style={styles.categoryChipIconSlot}>
            <IconComp size={15} color={contentColor} strokeWidth={2.2} />
          </View>
        ) : (
          <GradientIconBadge size={24} color={chipColor} isDark={isDark}>
            {({ iconColor }) => <IconComp size={14} color={iconColor} strokeWidth={2.2} />}
          </GradientIconBadge>
        )}
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[styles.categoryChipText, { color: contentColor, fontFamily: FontFamily.bold }]}
        >
          {category.name}
        </Text>
      </Animated.View>
    </PressableOpacity>
  );
};
