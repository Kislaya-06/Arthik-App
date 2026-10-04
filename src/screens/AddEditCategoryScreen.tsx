import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, MoreHorizontal, Check } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import { RootStackParamList } from '../types';
import { useCategoryStore } from '../store/categoryStore';
import { useTheme } from '../store/themeStore';
import { useNetworkStore } from '../store/networkStore';
import {
  Spacing,
  BorderRadius,
  FontSize,
  FontFamily,
  LineHeight,
  ControlHeight,
  CATEGORY_PALETTE,
  getNextCategoryColor,
  getContrastTextColor,
} from '../config/theme';

export { CATEGORY_PALETTE };

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditCategory'>;

const ICONS_GRID = [
  'Coffee', 'Truck', 'ShoppingBag', 'Video', 'Activity',
  'FileText', 'GraduationCap', 'Send', 'Home', 'ShoppingCart',
  'Move', 'Gift', 'CupSoda', 'Music', 'Users', 'DollarSign',
  'MoreHorizontal'
];

export const AddEditCategoryScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { categories, addCategory, updateCategory } = useCategoryStore();
  const isOffline = useNetworkStore((s) => s.isOffline);

  const categoryId = route.params?.categoryId;
  const isEditMode = !!categoryId;

  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState<string | null>(null);

  // Automatically find the next available unique color (from curated palette or dynamically curated)
  const [selectedColor, setSelectedColor] = useState<string>(() => getNextCategoryColor(categories));
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditMode && categoryId) {
      const cat = categories.find((c) => c.id === categoryId);
      if (cat) {
        setName(cat.name);
        setSelectedIcon(cat.icon);
        setSelectedColor(cat.color);
      }
    } else if (!isEditMode) {
      setSelectedColor(getNextCategoryColor(categories));
    }
  }, [isEditMode, categoryId, categories]);

  const displayPalette: readonly string[] = useMemo(() => {
    if (selectedColor && !CATEGORY_PALETTE.some((c) => c.toUpperCase() === selectedColor.toUpperCase())) {
      return [selectedColor, ...CATEGORY_PALETTE];
    }
    return CATEGORY_PALETTE;
  }, [selectedColor]);

  const handleSave = async () => {
    if (isSaving || !name.trim() || !selectedIcon) return;

    if (isOffline) {
      Alert.alert(
        'Offline',
        'An internet connection is required to create or edit a category.',
        [{ text: 'OK' }]
      );
      return;
    }

    setIsSaving(true);

    try {
      if (isEditMode && categoryId) {
        await updateCategory(categoryId, name.trim(), selectedIcon, selectedColor);
      } else {
        await addCategory(name.trim(), selectedIcon, selectedColor);
      }

      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Could not save category. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const isSaveEnabled = name.trim().length > 0 && selectedIcon !== null;
  const PreviewIconComponent = selectedIcon ? (LucideIcons as any)[selectedIcon] || MoreHorizontal : MoreHorizontal;

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* Header */}
      <View style={styles.headerRow}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10}>
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          {isEditMode ? 'Edit Category' : 'Add Category'}
        </Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 40 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Live Preview */}
        <View style={styles.previewContainer}>
          <View
            style={[
              styles.previewCircle,
              {
                backgroundColor: selectedColor,
              },
            ]}
          >
            {selectedIcon ? (
              <PreviewIconComponent size={32} color="#000000" strokeWidth={2.2} />
            ) : (
              <MoreHorizontal size={24} color="#000000" strokeWidth={2.2} />
            )}
          </View>
          <Text style={[styles.previewLabel, { color: colors.textTertiary, fontFamily: FontFamily.bold }]}>
            PREVIEW
          </Text>
        </View>

        {/* Category Name Input */}
        <View style={styles.inputHeaderRow}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
            CATEGORY NAME
          </Text>
          <Text style={[styles.charCount, { color: colors.textTertiary, fontFamily: FontFamily.medium }]}>
            {name.length}/24
          </Text>
        </View>
        <View style={[
          styles.inputContainer,
          {
            backgroundColor: colors.inputBg,
            borderWidth: isDark ? 1 : 0,
            borderColor: colors.borderSubtle,
          }
        ]}>
          <TextInput
            style={[styles.textInput, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}
            placeholder="e.g. Groceries, Travel, Rent"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            maxLength={24}
          />
        </View>

        {/* Choose Icon Grid */}
        <Text style={[styles.inputLabel, styles.chooseIconLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
          CHOOSE ICON
        </Text>
        <View style={styles.iconGrid}>
          {ICONS_GRID.map(iconName => {
            const IconComponent = (LucideIcons as any)[iconName] || MoreHorizontal;
            const isSelected = selectedIcon === iconName;

            return (
              <Pressable
                key={iconName}
                style={[
                  styles.iconOption,
                  isSelected ? [styles.iconOptionSelected, { backgroundColor: colors.mint, borderColor: colors.mint }] : [styles.iconOptionUnselected, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]
                ]}
                onPress={() => setSelectedIcon(iconName)}
              >
                <IconComponent
                  size={22}
                  color={isSelected ? colors.forestGreen : colors.textSecondary}
                />
              </Pressable>
            );
          })}
        </View>

        {/* Choose Color Grid */}
        <Text style={[styles.inputLabel, styles.chooseColorLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
          CHOOSE COLOR
        </Text>
        <View style={styles.colorGrid}>
          {displayPalette.map((colorHex: string) => {
            const isSelected = selectedColor.toUpperCase() === colorHex.toUpperCase();
            const checkColor = getContrastTextColor(colorHex);
            return (
              <Pressable
                key={colorHex}
                style={[
                  styles.colorOption,
                  { backgroundColor: colorHex },
                  isSelected && styles.colorOptionSelected,
                ]}
                onPress={() => setSelectedColor(colorHex)}
                accessibilityLabel={`Select color ${colorHex}`}
              >
                {isSelected && <Check size={18} color={checkColor} strokeWidth={2.6} />}
              </Pressable>
            );
          })}
        </View>

        {/* Save Button */}
        <Pressable
          style={[
            styles.saveBtn,
            isSaveEnabled && !isSaving
              ? [styles.saveBtnEnabled, { backgroundColor: colors.mint }]
              : [styles.saveBtnDisabled, { backgroundColor: colors.cardSubtle }]
          ]}
          onPress={handleSave}
          disabled={!isSaveEnabled || isSaving}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color={colors.forestGreen} />
          ) : (
            <Text style={[
              styles.saveText,
              isSaveEnabled
                ? [styles.saveTextEnabled, { color: colors.forestGreen }]
                : [styles.saveTextDisabled, { color: colors.textTertiary }],
              { fontFamily: FontFamily.bold }
            ]}>
              {isEditMode ? 'Update Category' : 'Save Category'}
            </Text>
          )}
        </Pressable>

      </ScrollView>
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
  scrollContent: {
    paddingBottom: 40,
  },

  // Preview
  previewContainer: {
    alignItems: 'center',
    marginTop: Spacing.section,
  },
  previewCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewLabel: {
    marginTop: Spacing.group,
    fontSize: FontSize.caption,
    color: '#B0B4C0',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Name Input
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.section,
    marginBottom: Spacing.element,
  },
  inputLabel: {
    fontSize: FontSize.caption,
    color: '#8A8FA3',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  charCount: {
    fontSize: FontSize.caption,
    color: '#B0B4C0',
  },
  inputContainer: {
    backgroundColor: '#F1F2F5',
    borderRadius: BorderRadius.input,
    paddingHorizontal: Spacing.surface,
    paddingVertical: Spacing.block,
  },
  textInput: {
    fontSize: FontSize.body,
    color: '#1A2B4C',
  },

  // Icon Grid
  chooseIconLabel: {
    marginTop: Spacing.section,
    marginBottom: Spacing.block,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.block,
  },
  iconOption: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  iconOptionUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E2E8',
  },
  iconOptionSelected: {
    backgroundColor: '#B8E0C8',
    borderColor: '#B8E0C8',
  },

  // Color Grid
  chooseColorLabel: {
    marginTop: Spacing.section,
    marginBottom: Spacing.block,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.block,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  colorOptionSelected: {
    borderWidth: 3,
    borderColor: '#000000',
    transform: [{ scale: 1.08 }],
  },

  // Save Button
  saveBtn: {
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    marginTop: Spacing.section,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnEnabled: {
    backgroundColor: '#B8E0C8',
  },
  saveBtnDisabled: {
    backgroundColor: '#E5E7ED',
  },
  saveText: {
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
  },
  saveTextEnabled: {
    color: '#1A2B4C',
  },
  saveTextDisabled: {
    color: '#A8ADBD',
  },
});
