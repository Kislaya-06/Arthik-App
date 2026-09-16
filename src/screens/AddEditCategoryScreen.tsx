import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, Pressable, TextInput, ScrollView, ActivityIndicator, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, MoreHorizontal } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import { RootStackParamList } from '../types';
import { useCategoryStore } from '../store/categoryStore';
import { useTheme } from '../store/themeStore';
import { useNetworkStore } from '../store/networkStore';

type Props = NativeStackScreenProps<RootStackParamList, 'AddEditCategory'>;

const PASTEL_COLORS = [
  '#F4B8AE', '#B8E0C8', '#93C5FD', '#FCD34D', '#C084FC', 
  '#F87171', '#94A3B8', '#FDEEE4', '#E3F2FD', '#FCE4EC', 
  '#EDE7F6', '#E3F2E8', '#FDF3D9'
];

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
  const [existingColor, setExistingColor] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isEditMode && categoryId) {
      const cat = categories.find(c => c.id === categoryId);
      if (cat) {
        setName(cat.name);
        setSelectedIcon(cat.icon);
        setExistingColor(cat.color);
      }
    }
  }, [isEditMode, categoryId, categories]);

  const handleSave = async () => {
    if (isSaving || !name.trim() || !selectedIcon) return;

    if (isOffline) {
      Alert.alert(
        'Offline',
        'Category banane/badalne ke liye internet chahiye.',
        [{ text: 'Theek hai' }]
      );
      return;
    }

    setIsSaving(true);

    try {
      const colorToUse = existingColor || PASTEL_COLORS[Math.floor(Math.random() * PASTEL_COLORS.length)];

      if (isEditMode && categoryId) {
        await updateCategory(categoryId, name.trim(), selectedIcon, colorToUse);
      } else {
        await addCategory(name.trim(), selectedIcon, colorToUse);
      }
      
      navigation.goBack();
    } catch (e: any) {
      Alert.alert('Error', e?.message || 'Category save nahi ho saki. Please dobara try karein.');
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
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
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
          <View style={[styles.previewCircle, { backgroundColor: colors.cardSubtle }]}>
            {selectedIcon ? (
              <PreviewIconComponent size={32} color={colors.textPrimary} />
            ) : (
              <MoreHorizontal size={24} color={colors.textTertiary} />
            )}
          </View>
          <Text style={[styles.previewLabel, { color: colors.textTertiary, fontFamily: 'Quicksand_700Bold' }]}>
            PREVIEW
          </Text>
        </View>

        {/* Category Name Input */}
        <View style={styles.inputHeaderRow}>
          <Text style={[styles.inputLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>
            CATEGORY NAME
          </Text>
          <Text style={[styles.charCount, { color: colors.textTertiary, fontFamily: 'Quicksand_500Medium' }]}>
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
            style={[styles.textInput, { color: colors.textPrimary, fontFamily: 'Quicksand_500Medium' }]}
            placeholder="e.g. Groceries, Travel, Rent"
            placeholderTextColor={colors.textTertiary}
            value={name}
            onChangeText={setName}
            maxLength={24}
          />
        </View>

        {/* Choose Icon Grid */}
        <Text style={[styles.inputLabel, styles.chooseIconLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>
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
              { fontFamily: 'Quicksand_700Bold' }
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
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  headerTitle: {
    marginLeft: 16,
    fontSize: 24,
    color: '#1A2B4C',
  },
  scrollContent: {
    paddingBottom: 40,
  },
  
  // Preview
  previewContainer: {
    alignItems: 'center',
    marginTop: 32,
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
    marginTop: 12,
    fontSize: 12,
    color: '#B0B4C0',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // Name Input
  inputHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 12,
    color: '#8A8FA3',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  charCount: {
    fontSize: 12,
    color: '#B0B4C0',
  },
  inputContainer: {
    backgroundColor: '#F1F2F5',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  textInput: {
    fontSize: 16,
    color: '#1A2B4C',
  },

  // Icon Grid
  chooseIconLabel: {
    marginTop: 32,
    marginBottom: 16,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
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

  // Save Button
  saveBtn: {
    borderRadius: 999,
    paddingVertical: 20,
    marginTop: 32,
    alignItems: 'center',
  },
  saveBtnEnabled: {
    backgroundColor: '#B8E0C8',
  },
  saveBtnDisabled: {
    backgroundColor: '#E5E7ED',
  },
  saveText: {
    fontSize: 18,
  },
  saveTextEnabled: {
    color: '#1A2B4C',
  },
  saveTextDisabled: {
    color: '#A8ADBD',
  },
});
