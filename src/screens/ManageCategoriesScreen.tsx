import React, { useMemo, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Pressable, FlatList, Alert 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, SquarePen, Trash2, Plus } from 'lucide-react-native';
import { useFocusEffect } from '@react-navigation/native';

import { RootStackParamList } from '../types';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { getCategoryIcon } from '../lib/iconUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageCategories'>;

export const ManageCategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { categories, fetchCategories, deleteCategory } = useCategoryStore();
  const { expenses, fetchExpenses } = useExpenseStore();

  useFocusEffect(
    React.useCallback(() => {
      fetchCategories();
      fetchExpenses();
    }, [fetchCategories, fetchExpenses])
  );

  const categoryExpenseCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    expenses.forEach(exp => {
      counts[exp.category_id] = (counts[exp.category_id] || 0) + 1;
    });
    return counts;
  }, [expenses]);

  const handleDelete = (categoryId: string) => {
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
            await deleteCategory(categoryId);
            fetchCategories();
          } 
        }
      ]
    );
  };

  const renderItem = useCallback(({ item, index }: { item: Category; index: number }) => {
    const IconComponent = getCategoryIcon(item.icon);
    const count = categoryExpenseCounts[item.id] || 0;
    const isLast = index === categories.length - 1;

    return (
      <View style={[
        styles.categoryRow, 
        { borderBottomColor: colors.borderSubtle },
        isLast && styles.lastCategoryRow
      ]}>
        <View style={[styles.iconContainer, { backgroundColor: item.color + '33' }]}>
          <IconComponent size={20} color={item.color} />
        </View>
        <View style={styles.categoryMiddle}>
          <Text style={[styles.categoryName, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
            {item.name}
          </Text>
          <Text style={[styles.categorySubtitle, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
            {count} {count === 1 ? 'expense' : 'expenses'}
          </Text>
        </View>
        <View style={styles.categoryActions}>
          <Pressable 
            style={[styles.editBtn, { backgroundColor: colors.cardSubtle }]}
            onPress={() => navigation.navigate('AddEditCategory', { categoryId: item.id })}
          >
            <SquarePen size={16} color={colors.textPrimary} />
          </Pressable>
          <Pressable 
            style={[styles.deleteBtn, { backgroundColor: isDark ? 'rgba(244, 184, 174, 0.15)' : '#FDEEEC' }]}
            onPress={() => handleDelete(item.id)}
          >
            <Trash2 size={16} color={colors.coral} />
          </Pressable>
        </View>
      </View>
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
          Manage Categories
        </Text>
      </View>

      <Text style={[styles.categoryCount, { color: colors.textSecondary, fontFamily: 'Quicksand_500Medium' }]}>
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
        style={[styles.fab, { bottom: insets.bottom + 24, backgroundColor: colors.mint }]}
        onPress={() => navigation.navigate('AddEditCategory')}
      >
        <Plus size={24} color="#1A2B4C" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FB',
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  headerTitle: {
    marginLeft: 16,
    fontSize: 20,
    color: '#1A2B4C',
  },
  categoryCount: {
    marginTop: 16,
    marginBottom: 16,
    fontSize: 14,
    color: '#8A8FA3',
  },
  listCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
    flexShrink: 1,
    marginBottom: 24,
    overflow: 'hidden',
  },
  listContent: {
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F1F4',
  },
  lastCategoryRow: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  categoryMiddle: {
    flex: 1,
    marginLeft: 4,
  },
  categoryName: {
    fontSize: 16,
    color: '#1A2B4C',
  },
  categorySubtitle: {
    fontSize: 14,
    color: '#8A8FA3',
    marginTop: 2,
  },
  categoryActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#F1F2F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: '#FDEEEC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
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
