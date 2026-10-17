import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SquarePen, Trash2 } from 'lucide-react-native';
import { Category } from '../store/categoryStore';
import { ThemeColors, FontFamily, FontSize, LineHeight, Spacing, BorderRadius } from '../config/theme';
import { getCategoryIcon } from '../lib/iconUtils';
import { GradientIconBadge } from './GradientIconBadge';

export interface CategoryRowItemProps {
  category: Category;
  expenseCount: number;
  isLast?: boolean;
  colors: ThemeColors;
  isDark: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export const CategoryRowItem: React.FC<CategoryRowItemProps> = React.memo(({
  category,
  expenseCount,
  isLast = false,
  colors,
  isDark,
  onEdit,
  onDelete,
}) => {
  const IconComponent = getCategoryIcon(category.icon);

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
          {expenseCount} {expenseCount === 1 ? 'expense' : 'expenses'}
        </Text>
      </View>
      <View style={styles.categoryActions}>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn, 
            { 
              backgroundColor: colors.cardSubtle,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
              opacity: pressed ? 0.75 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            }
          ]}
          onPress={onEdit}
          hitSlop={6}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Edit category ${category.name}`}
        >
          <SquarePen size={18} color={colors.textPrimary} strokeWidth={2} />
        </Pressable>
        <Pressable
          style={({ pressed }) => [
            styles.actionBtn, 
            { 
              backgroundColor: colors.peachSoft,
              borderColor: isDark ? 'rgba(244, 184, 174, 0.25)' : 'rgba(244, 184, 174, 0.45)',
              opacity: pressed ? 0.75 : 1,
              transform: [{ scale: pressed ? 0.92 : 1 }],
            }
          ]}
          onPress={onDelete}
          hitSlop={6}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Delete category ${category.name}`}
        >
          <Trash2 size={18} color={colors.coral} strokeWidth={2} />
        </Pressable>
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
