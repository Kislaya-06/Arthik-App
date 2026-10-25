import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  useAnimatedValue,
  StyleProp,
  ViewStyle,
} from 'react-native';
import SquarePen from 'lucide-react-native/icons/square-pen';
import Trash2 from 'lucide-react-native/icons/trash';
import { Category } from '../store/categoryStore';
import {
  ThemeColors,
  FontFamily,
  FontSize,
  LineHeight,
  Spacing,
  BorderRadius,
  Motion,
} from '../config/theme';
import { getCategoryIcon } from '../lib/iconUtils';
import { GradientIconBadge } from './GradientIconBadge';
import { useReduceMotion } from '../hooks/useReduceMotion';

export interface CategoryRowItemProps {
  category: Category;
  expenseCount: number;
  isLast?: boolean;
  colors: ThemeColors;
  isDark: boolean;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const ActionIconButton: React.FC<{
  onPress: () => void;
  style: StyleProp<ViewStyle>;
  accessibilityLabel: string;
  reduceMotion: boolean;
  children: React.ReactNode;
}> = React.memo(({ onPress, style, accessibilityLabel, reduceMotion, children }) => {
  const scale = useAnimatedValue(1);

  const handlePressIn = React.useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: Motion.scale.chip,
      tension: Motion.springs.keypad.tension,
      friction: Motion.springs.keypad.friction,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, scale]);

  const handlePressOut = React.useCallback(() => {
    if (reduceMotion) return;
    Animated.spring(scale, {
      toValue: 1,
      tension: Motion.springs.keypad.tension,
      friction: Motion.springs.keypad.friction,
      useNativeDriver: true,
    }).start();
  }, [reduceMotion, scale]);

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      hitSlop={6}
      accessible
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
});

export const CategoryRowItem: React.FC<CategoryRowItemProps> = React.memo(({
  category,
  expenseCount,
  isLast = false,
  colors,
  isDark,
  onEdit,
  onDelete,
}) => {
  const reduceMotion = useReduceMotion();
  const IconComponent = getCategoryIcon(category.icon);
  const handleEdit = React.useCallback(() => onEdit(category.id), [onEdit, category.id]);
  const handleDelete = React.useCallback(() => onDelete(category.id), [onDelete, category.id]);

  return (
    <View
      style={[
        styles.categoryRow,
        { borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)' },
        isLast && styles.lastCategoryRow,
      ]}
    >
      <GradientIconBadge size={48} color={category.color} isDark={isDark}>
        {({ iconColor }) => <IconComponent size={22} color={iconColor} strokeWidth={2.2} />}
      </GradientIconBadge>
      <View style={styles.categoryMiddle}>
        <Text
          style={[
            styles.categoryName,
            { color: colors.textPrimary, fontFamily: FontFamily.bold },
          ]}
          numberOfLines={1}
        >
          {category.name}
        </Text>
        <Text
          style={[
            styles.categorySubtitle,
            { color: colors.textSecondary, fontFamily: FontFamily.medium },
          ]}
          numberOfLines={1}
        >
          {expenseCount} {expenseCount === 1 ? 'transaction' : 'transactions'}
        </Text>
      </View>
      <View style={styles.categoryActions}>
        <ActionIconButton
          onPress={handleEdit}
          reduceMotion={reduceMotion}
          accessibilityLabel={`Edit category ${category.name}`}
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.cardSubtle,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
            },
          ]}
        >
          <SquarePen size={18} color={colors.textPrimary} strokeWidth={2} />
        </ActionIconButton>
        <ActionIconButton
          onPress={handleDelete}
          reduceMotion={reduceMotion}
          accessibilityLabel={`Delete category ${category.name}`}
          style={[
            styles.actionBtn,
            {
              backgroundColor: colors.peachSoft,
              borderColor: isDark ? 'rgba(244, 184, 174, 0.25)' : 'rgba(244, 184, 174, 0.45)',
            },
          ]}
        >
          <Trash2 size={18} color={colors.coral} strokeWidth={2} />
        </ActionIconButton>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
  },
  lastCategoryRow: {
    borderBottomWidth: 0,
  },
  categoryMiddle: {
    flex: 1,
    marginLeft: Spacing.group,
    justifyContent: 'center',
  },
  categoryName: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
    letterSpacing: -0.2,
  },
  categorySubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
    marginLeft: Spacing.element,
  },
  actionBtn: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
