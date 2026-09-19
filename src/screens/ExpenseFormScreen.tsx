import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  Platform, KeyboardAvoidingView, StyleSheet, Keyboard,
  ActivityIndicator,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft, Calendar, ChevronRight,
} from 'lucide-react-native';
import { CustomDatePickerModal } from '../components/CustomDatePickerModal';
import { BouncyTypeToggle } from '../components/BouncyTypeToggle';
import {
  BouncyPaymentToggle,
  EXPENSE_PAYMENT_OPTIONS,
  INCOME_PAYMENT_OPTIONS,
} from '../components/BouncyPaymentToggle';
import { Category } from '../store/categoryStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyButton } from '../components/KeyButton';
import { formatAmountWithCommas } from '../lib/formatters';
import { getCategoryIcon } from '../lib/iconUtils';
import { useTheme } from '../store/themeStore';
import { useFormKeyboard } from '../hooks/useFormKeyboard';
import {
  useExpenseForm,
  MAX_NOTE_WORDS,
  MAX_NOTE_CHARS,
  countWords,
} from '../hooks/useExpenseForm';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

// Both AddExpense and EditExpense routes use this single component.
type Props =
  | NativeStackScreenProps<RootStackParamList, 'AddExpense'>
  | NativeStackScreenProps<RootStackParamList, 'EditExpense'>;


const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

export const ExpenseFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const noteInputRef = useRef<TextInput>(null);
  const [isNoteFocused, setIsNoteFocused] = useState(false);

  const {
    scrollRef,
    isKeypadVisible,
    isKeyboardOpen,
    handleAmountPress,
    handleNoteLayout,
    handleNoteFocus,
  } = useFormKeyboard();

  const {
    amount,
    transactionType,
    selectedCategoryId,
    note,
    selectedDate,
    formattedDate,
    paymentMode,
    isEdit,
    isSubmitting,
    isSaveEnabled,
    showDatePicker,
    categories,
    isCategoriesLoading,
    areCategoriesPlaceholder,
    isCategoriesFetched,
    handleTypeChange,
    handleKeyPress,
    handleCategorySelect,
    handleNoteChange,
    handleDateConfirm,
    setShowDatePicker,
    setPaymentMode,
    handleSave,
    noteSuggestions,
    handleSelectNoteSuggestion,
  } = useExpenseForm({ route, navigation });

  const showSuggestions = isNoteFocused && noteSuggestions.length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ── */}
      <View style={[styles.header, { marginTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          {isEdit ? 'Edit Expense' : 'Add Transaction'}
        </Text>
      </View>

      {/* ── Transaction Type Segmented Toggle ── */}
      <View style={[styles.typeToggleWrapper, isKeyboardOpen && styles.typeToggleWrapperCompact]}>
        <BouncyTypeToggle
          value={transactionType}
          onChange={handleTypeChange}
        />
      </View>

      {/* ── Amount Display ── */}
      <Pressable
        style={[styles.amountContainer, isKeyboardOpen && styles.amountContainerCompact]}
        onPress={handleAmountPress}
      >
        <View style={styles.amountRow}>
          <Text
            style={[
              styles.currencySymbol,
              { color: colors.textMuted },
              isKeyboardOpen && styles.currencySymbolCompact,
              { fontFamily: FontFamily.bold },
            ]}
          >
            ₹
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            style={[
              styles.amountValue,
              isKeyboardOpen && styles.amountValueCompact,
              amount ? { color: colors.textPrimary } : { color: colors.textMuted },
              { fontFamily: FontFamily.bold },
            ]}
          >
            {formatAmountWithCommas(amount) || '0'}
          </Text>
        </View>
        <View
          style={[
            styles.amountUnderline,
            { backgroundColor: colors.border },
            isKeyboardOpen && styles.amountUnderlineCompact,
          ]}
        />
      </Pressable>

      {/* ── Scrollable Section (Category, Note, Date, Payment) ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollSection}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Category Selector (Expense mode only) */}
        {transactionType === 'expense' && (
          <>
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, styles.sectionLabelNoMargin, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
                CATEGORY
              </Text>
              {(areCategoriesPlaceholder || isCategoriesLoading) && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <ActivityIndicator size="small" color={colors.textMuted} />
                  <Text style={{ color: colors.textMuted, fontSize: FontSize.caption, fontFamily: FontFamily.medium }}>
                    Loading categories...
                  </Text>
                </View>
              )}
            </View>
            {isCategoriesFetched && categories.length === 0 ? (
              <View style={[styles.emptyCategoriesContainer, { backgroundColor: colors.inputBg }]}>
                <Text style={[styles.emptyCategoriesText, { color: colors.textMuted, fontFamily: FontFamily.medium }]}>
                  No categories found. Create one to add an expense.
                </Text>
                <Pressable
                  style={[styles.createCategoryBtn, { backgroundColor: colors.mintGreen }]}
                  onPress={() => (navigation as any).navigate('AddEditCategory')}
                >
                  <Text style={[styles.createCategoryBtnText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>
                    + Create Category
                  </Text>
                </Pressable>
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="always"
                style={styles.categoryScroll}
              >
                <View style={styles.categoryList}>
                  {categories.map((cat: Category) => {
                    const isPlaceholder = Boolean(cat.isPlaceholder) || areCategoriesPlaceholder;
                    const isSelected = selectedCategoryId === cat.id && !isPlaceholder;
                    const IconComp = getCategoryIcon(cat.icon);
                    return (
                      <Pressable
                        key={cat.id}
                        disabled={isPlaceholder}
                        onPress={() => {
                          if (!isPlaceholder) {
                            handleCategorySelect(cat.id);
                          }
                        }}
                        style={[
                          styles.categoryChip,
                          isSelected
                            ? { backgroundColor: colors.mintGreen, borderColor: colors.mintGreen }
                            : { backgroundColor: colors.card, borderColor: colors.border },
                          isPlaceholder && { opacity: 0.45 },
                        ]}
                      >
                        <IconComp size={16} color={isSelected ? colors.forestGreen : colors.textPrimary} />
                        <Text
                          style={[
                            styles.categoryChipText,
                            { color: isSelected ? colors.forestGreen : colors.textPrimary },
                            { fontFamily: FontFamily.bold },
                          ]}
                        >
                          {cat.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            )}
          </>
        )}

        {/* Note Input — onLayout tracks Y for keyboard-scroll */}
        <View onLayout={handleNoteLayout}>
          <View style={styles.sectionLabelRow}>
            <Text
              style={[
                styles.sectionLabel,
                styles.sectionLabelNoMargin,
                { color: colors.textSecondary, fontFamily: FontFamily.bold },
              ]}
            >
              NOTE (OPTIONAL)
            </Text>
            <Text
              style={[
                styles.noteCounterText,
                {
                  color:
                    countWords(note) >= MAX_NOTE_WORDS || note.length >= MAX_NOTE_CHARS
                      ? colors.peachCoral
                      : colors.textMuted,
                  fontFamily: FontFamily.semibold,
                },
              ]}
            >
              {countWords(note)}/{MAX_NOTE_WORDS} words
            </Text>
          </View>
          <Pressable
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.inputBg,
                marginBottom: showSuggestions ? Spacing.element : Spacing.block,
              },
            ]}
            onPress={() => noteInputRef.current?.focus()}
          >
            <TextInput
              ref={noteInputRef}
              value={note}
              onChangeText={handleNoteChange}
              maxLength={MAX_NOTE_CHARS}
              placeholder="Add a note..."
              placeholderTextColor={colors.textMuted}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              style={[styles.inputText, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={() => {
                setIsNoteFocused(true);
                handleNoteFocus();
              }}
              onBlur={() => setIsNoteFocused(false)}
            />
          </Pressable>

          {showSuggestions && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="always"
              style={styles.suggestionsScroll}
              contentContainerStyle={styles.suggestionsList}
            >
              {noteSuggestions.map((suggestion) => (
                <Pressable
                  key={suggestion}
                  onPress={() => handleSelectNoteSuggestion(suggestion)}
                  style={({ pressed }) => [
                    styles.suggestionChip,
                    {
                      backgroundColor: colors.inputBg,
                      borderColor: colors.borderSubtle,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.suggestionText,
                      { color: colors.textSecondary, fontFamily: FontFamily.medium },
                    ]}
                  >
                    {suggestion}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Date Picker */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
          DATE
        </Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={[styles.datePickerButton, { backgroundColor: colors.inputBg }]}
        >
          <View style={styles.datePickerLeft}>
            <Calendar size={18} color={colors.textSecondary} />
            <Text style={[styles.datePickerText, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}>
              {formattedDate}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
        <CustomDatePickerModal
          visible={showDatePicker}
          value={selectedDate}
          maxDate={new Date()}
          onConfirm={handleDateConfirm}
          onClose={() => setShowDatePicker(false)}
        />

        {/* Paid Via / Added Via Toggle */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
          {transactionType === 'income' ? 'MONEY ADDED VIA' : 'PAID VIA'}
        </Text>
        <BouncyPaymentToggle
          value={paymentMode}
          onChange={(mode) => setPaymentMode(mode)}
          options={transactionType === 'income' ? INCOME_PAYMENT_OPTIONS : EXPENSE_PAYMENT_OPTIONS}
          activeColor={transactionType === 'income' ? colors.mintGreen : colors.peachCoral}
        />
      </ScrollView>

      {/* ── Bottom Console (Keypad + Save Button) ── */}
      <View
        style={[
          styles.bottomSection,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.borderSubtle,
            paddingBottom: isKeyboardOpen ? 12 : Math.max(insets.bottom, 14) + 8,
          },
        ]}
      >
        {isKeypadVisible && (
          <View style={styles.keypadGrid}>
            {KEYPAD_ROWS.map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((item) => (
                  <KeyButton key={item} item={item} onPress={handleKeyPress} />
                ))}
              </View>
            ))}
          </View>
        )}

        <Pressable
          disabled={!isSaveEnabled || isSubmitting}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            isKeyboardOpen && styles.saveButtonKeyboard,
            isSaveEnabled && !isSubmitting
              ? [
                  styles.saveButtonEnabled,
                  {
                    backgroundColor: colors.mintGreen,
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.98 : 1 }],
                  },
                ]
              : [
                  styles.saveButtonDisabled,
                  {
                    backgroundColor: colors.cardSubtle,
                    borderColor: colors.borderSubtle,
                  },
                ],
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={colors.forestGreen} />
          ) : (
            <Text
              style={[
                styles.saveButtonText,
                {
                  color: isSaveEnabled ? colors.forestGreen : colors.textMuted,
                  fontFamily: FontFamily.bold,
                },
              ]}
            >
              {isEdit
                ? (transactionType === 'income' ? 'Update Transaction' : 'Update Expense')
                : (transactionType === 'income' ? 'Save Transaction' : 'Save Expense')}
            </Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    paddingHorizontal: Spacing.gutter,
  },
  backButton: {
    position: 'absolute',
    left: Spacing.gutter,
  },
  headerTitle: {
    fontSize: FontSize.sectionTitle,
  },
  typeToggleWrapper: {
    paddingHorizontal: Spacing.gutter,
    marginTop: 18,
  },
  typeToggleWrapperCompact: {
    marginTop: Spacing.element,
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: Spacing.gutter,
  },
  amountContainerCompact: {
    marginTop: Spacing.element,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 48,
    marginRight: Spacing.micro,
  },
  currencySymbolCompact: {
    fontSize: 32,
  },
  amountValue: {
    fontSize: 60,
  },
  amountValueCompact: {
    fontSize: 40,
  },
  amountUnderline: {
    height: 1,
    width: 80,
    marginTop: Spacing.element,
  },
  amountUnderlineCompact: {
    marginTop: Spacing.micro,
  },
  scrollSection: {
    flex: 1,
    paddingHorizontal: Spacing.gutter,
    marginTop: Spacing.surface,
  },
  sectionLabel: {
    fontSize: FontSize.caption,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.group,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.group,
  },
  sectionLabelNoMargin: {
    marginBottom: 0,
  },
  noteCounterText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.2,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: Spacing.block,
    overflow: 'visible',
  },
  categoryList: {
    flexDirection: 'row',
    gap: Spacing.group,
    paddingRight: Spacing.gutter,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.block,
    paddingVertical: 10,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: FontSize.bodySmall,
    marginLeft: Spacing.element,
  },
  emptyCategoriesContainer: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.block,
    borderRadius: BorderRadius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: Spacing.block,
  },
  emptyCategoriesText: {
    fontSize: FontSize.bodySmall,
    textAlign: 'center',
  },
  createCategoryBtn: {
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.element,
    borderRadius: BorderRadius.pill,
  },
  createCategoryBtnText: {
    fontSize: FontSize.bodySmall,
  },
  inputContainer: {
    height: ControlHeight.row,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    justifyContent: 'center',
    marginBottom: Spacing.block,
  },
  suggestionsScroll: {
    marginBottom: Spacing.block,
  },
  suggestionsList: {
    flexDirection: 'row',
    gap: Spacing.element,
  },
  suggestionChip: {
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    paddingVertical: 8,
    borderWidth: 1,
  },
  suggestionText: {
    fontSize: FontSize.bodySmall,
  },
  inputText: {
    height: '100%',
    fontSize: FontSize.body,
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  datePickerButton: {
    height: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.surface,
    marginBottom: Spacing.block,
  },
  datePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerText: {
    marginLeft: Spacing.group,
    fontSize: FontSize.body,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  bottomSection: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.surface,
    paddingTop: Spacing.block,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  keypadGrid: {
    flexDirection: 'column',
    gap: 10,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  saveButton: {
    borderRadius: BorderRadius.pill,
    height: ControlHeight.cta,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
  },
  saveButtonKeyboard: {
    marginTop: 0,
    height: 50,
  },
  saveButtonEnabled: {
    ...Platform.select({
      ios: {
        shadowColor: '#B8E0C8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
    }),
  },
  saveButtonDisabled: {
    borderWidth: 1,
  },
  saveButtonText: {
    fontSize: FontSize.cta,
    letterSpacing: 0.3,
  },
});
