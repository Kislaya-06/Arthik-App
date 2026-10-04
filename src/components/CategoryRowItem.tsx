import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SquarePen, Trash2 } from 'lucide-react-native';
import { Category } from '../store/categoryStore';
import { ThemeColors, FontFamily, FontSize, LineHeight, Spacing } from '../config/theme';
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
        { borderBottomColor: colors.borderSubtle },
        isLast && styles.lastCategoryRow,
      ]}
    >
      <GradientIconBadge size={44} color={category.color} isDark={isDark}>
        {({ iconColor }) => <IconComponent size={20} color={iconColor} strokeWidth={2.2} />}
      </GradientIconBadge>
      <View style={styles.categoryMiddle}>
        <Text style={[styles.categoryName, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          {category.name}
        </Text>
        <Text style={[styles.categorySubtitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
          {expenseCount} {expenseCount === 1 ? 'expense' : 'expenses'}
        </Text>
      </View>
      <View style={styles.categoryActions}>
        <Pressable
          style={[styles.editBtn, { backgroundColor: colors.cardSubtle }]}
          onPress={onEdit}
          hitSlop={6}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Edit category ${category.name}`}
        >
          <SquarePen size={16} color={colors.textPrimary} />
        </Pressable>
        <Pressable
          style={[styles.deleteBtn, { backgroundColor: colors.peachSoft }]}
          onPress={onDelete}
          hitSlop={6}
          accessible
          accessibilityRole="button"
          accessibilityLabel={`Delete category ${category.name}`}
        >
          <Trash2 size={16} color={colors.coral} />
        </Pressable>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.element,
    borderBottomWidth: 1,
  },
  lastCategoryRow: {
    borderBottomWidth: 0,
  },
  categoryMiddle: {
    flex: 1,
    marginLeft: Spacing.element,
  },
  categoryName: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
  },
  categorySubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: Spacing.element,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
