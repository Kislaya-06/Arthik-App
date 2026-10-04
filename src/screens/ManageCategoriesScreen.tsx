import React, { useMemo, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Pressable, FlatList, Alert 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Plus } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

import { RootStackParamList } from '../types';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { useNetworkStore } from '../store/networkStore';
import { CategoryRowItem } from '../components/CategoryRowItem';
import { Spacing, BorderRadius, FontSize, FontFamily, LineHeight } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageCategories'>;

export const ManageCategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { categories, fetchCategories, deleteCategory } = useCategoryStore();
  const { expenses, fetchExpenses } = useExpenseStore();
  const isOffline = useNetworkStore((s) => s.isOffline);
  const [isDeleting, setIsDeleting] = React.useState(false);

  useFocusEffect(
    React.useCallback(() => {
      fetchCategories();
      fetchExpenses();
    }, [fetchCategories, fetchExpenses])
  );

  const categoryExpenseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach(exp => {
      if (exp.category_id) {
        counts[exp.category_id] = (counts[exp.category_id] || 0) + 1;
      }
    });
    return counts;
  }, [expenses]);

  const handleDelete = useCallback((categoryId: string) => {
    if (isDeleting) return;

    if (isOffline) {
      Alert.alert(
        'Offline',
        'An internet connection is required to delete a category.',
        [{ text: 'OK' }]
      );
      return;
    }

    const count = categoryExpenseCounts[categoryId] || 0;
    if (count > 0) {
      Alert.alert(
        "Cannot Delete",
        "This category has existing expenses. You must reassign or delete them first before deleting this category.",
        [{ text: "OK" }]
      );
      return;
    }
    
    Alert.alert(
      "Delete Category",
      "Are you sure you want to delete this category?",
      [
        { text: "Cancel", style: "cancel" },
        { 
          text: "Delete", 
          style: "destructive", 
          onPress: async () => {
            setIsDeleting(true);
            try {
              await deleteCategory(categoryId);
              await fetchCategories();
            } catch (e: any) {
              Alert.alert('Error', e?.message || 'Could not delete category. Please try again.');
            } finally {
              setIsDeleting(false);
            }
          } 
        }
      ]
    );
  }, [isDeleting, isOffline, categoryExpenseCounts, deleteCategory, fetchCategories]);

  const renderItem = useCallback(({ item, index }: { item: Category; index: number }) => {
    const count = categoryExpenseCounts[item.id] || 0;
    const isLast = index === categories.length - 1;

    return (
      <CategoryRowItem
        category={item}
        expenseCount={count}
        isLast={isLast}
        colors={colors}
        isDark={isDark}
        onEdit={() => navigation.navigate('AddEditCategory', { categoryId: item.id })}
        onDelete={() => handleDelete(item.id)}
      />
    );
  }, [categories, navigation, categoryExpenseCounts, handleDelete, colors, isDark]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          Manage Categories
        </Text>
      </View>

      <Text style={[styles.categoryCount, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
        {categories.length} {categories.length === 1 ? 'category' : 'categories'}
      </Text>

      {/* List Card */}
      <View style={[
        styles.listCard, 
        { 
          backgroundColor: colors.card,
          borderWidth: isDark ? 1 : 0,
          borderColor: colors.borderSubtle,
        }
      ]}>
        <FlatList
          data={categories}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 80 }]}
        />
      </View>

      {/* Floating Add Button */}
      <Pressable 
        style={[styles.fab, { bottom: insets.bottom + Spacing.gutter, backgroundColor: colors.mint }]}
        onPress={() => navigation.navigate('AddEditCategory')}
      >
        <Plus size={24} color={colors.forestGreen} />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    paddingHorizontal: Spacing.gutter,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.block,
  },
  headerTitle: {
    marginLeft: Spacing.block,
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
  },
  categoryCount: {
    marginTop: Spacing.block,
    marginBottom: Spacing.block,
    fontSize: FontSize.bodySmall,
    color: '#8A8FA3',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: BorderRadius.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    flexShrink: 1,
    marginBottom: Spacing.gutter,
    overflow: 'hidden',
  },
  listContent: {
  },
  fab: {
    position: 'absolute',
    right: Spacing.gutter,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#B8E0C8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 10,
    zIndex: 10,
  },
});
