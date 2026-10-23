import React, { useMemo, useCallback } from 'react';
import { 
  View, Text, StyleSheet, Pressable, FlatList, Alert 
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Plus from 'lucide-react-native/icons/plus';
import { useFocusEffect } from '@react-navigation/native';

import { RootStackParamList } from '../types';
import { useCategoryStore, Category, CategoryKind, categoriesOfKind } from '../store/categoryStore';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { useNetworkStore } from '../store/networkStore';
import { CategoryRowItem } from '../components/CategoryRowItem';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Spacing, FontSize, FontFamily, LineHeight, ControlHeight } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ManageCategories'>;

// One screen for both sides (CAT-004): the toggle shows either expense or income categories, never both at once.
const KIND_OPTIONS = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
];

export const ManageCategoriesScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const deleteCategory = useCategoryStore((s) => s.deleteCategory);
  const expenses = useExpenseStore((s) => s.expenses);
  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);
  const isOffline = useNetworkStore((s) => s.isOffline);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [kind, setKind] = React.useState<CategoryKind>(route.params?.kind === 'income' ? 'income' : 'expense');
  const visibleCategories = useMemo(() => categoriesOfKind(categories, kind), [categories, kind]);

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
        "This category has existing transactions. You must reassign or delete them first before deleting this category.",
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

  const handleEdit = useCallback((id: string) => {
    navigation.navigate('AddEditCategory', { categoryId: id });
  }, [navigation]);

  const renderItem = useCallback(({ item, index }: { item: Category; index: number }) => {
    const count = categoryExpenseCounts[item.id] || 0;
    const isLast = index === visibleCategories.length - 1;

    return (
      <CategoryRowItem
        category={item}
        expenseCount={count}
        isLast={isLast}
        colors={colors}
        isDark={isDark}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    );
  }, [visibleCategories.length, categoryExpenseCounts, handleEdit, handleDelete, colors, isDark]);

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

      <SegmentedControl
        options={KIND_OPTIONS}
        selectedKey={kind}
        onChange={(key) => setKind(key === 'income' ? 'income' : 'expense')}
        height={ControlHeight.standard}
        activePillColor={kind === 'expense' ? colors.peachCoral : colors.mintGreen}
        activeTextColor={colors.forestGreen}
        style={styles.kindToggle}
      />

      <Text style={[styles.categoryCount, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
        {visibleCategories.length} {kind} {visibleCategories.length === 1 ? 'category' : 'categories'}
      </Text>

      {/* Categories List */}
      <FlatList
        data={visibleCategories}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        style={styles.list}
        contentContainerStyle={[
          styles.listContent, 
          { paddingBottom: insets.bottom + 96 }
        ]}
      />

      {/* Floating Add Button */}
      <Pressable 
        style={({ pressed }) => [
          styles.fab, 
          { 
            bottom: insets.bottom + Spacing.gutter, 
            backgroundColor: colors.mint,
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.95 : 1 }],
          }
        ]}
        onPress={() => navigation.navigate('AddEditCategory', { kind })}
        accessible
        accessibilityRole="button"
        accessibilityLabel={kind === 'income' ? 'Add income category' : 'Add expense category'}
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
  kindToggle: {
    marginTop: Spacing.block,
  },
  categoryCount: {
    marginTop: Spacing.block,
    marginBottom: Spacing.element,
    fontSize: FontSize.bodySmall,
    color: '#8A8FA3',
  },
  list: {
    flex: 1,
  },
  listContent: {
    flexGrow: 1,
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
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
    zIndex: 10,
  },
});
