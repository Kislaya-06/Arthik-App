import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  Platform, KeyboardAvoidingView, StyleSheet, Keyboard,
  Animated, Dimensions, Alert, ActivityIndicator,
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
import { format, parseISO } from 'date-fns';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyButton } from '../components/KeyButton';
import { formatDate, formatAmountWithCommas } from '../lib/formatters';
import { applyKeypadPress } from '../lib/amountKeypad';
import { getCategoryIcon } from '../lib/iconUtils';
import { isIncomeTransaction } from '../lib/paymentUtils';
import { useTheme } from '../store/themeStore';
import { useFormKeyboard } from '../hooks/useFormKeyboard';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';

// Both AddExpense and EditExpense routes use this single component.
type Props =
  | NativeStackScreenProps<RootStackParamList, 'AddExpense'>
  | NativeStackScreenProps<RootStackParamList, 'EditExpense'>;


const MAX_NOTE_WORDS = 50;
const MAX_NOTE_CHARS = 250;

const countWords = (text: string) => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};


const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

export const ExpenseFormScreen: React.FC<Props> = ({ route, navigation }) => {
  const isEdit = route.name === 'EditExpense';
  const expenseId = isEdit ? (route.params as { expenseId: string }).expenseId : undefined;

  const addExpense = useExpenseStore((s) => s.addExpense);
  const updateExpense = useExpenseStore((s) => s.updateExpense);
  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  // expenses is only read in edit mode to pre-fill the form
  const expenses = useExpenseStore((s) => s.expenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const {
    scrollRef,
    isKeypadVisible,
    isKeyboardOpen,
    handleAmountPress,
    handleNoteLayout,
    handleNoteFocus,
  } = useFormKeyboard();
  const noteInputRef = useRef<TextInput>(null);
  const hasPrefilled = useRef(false);

  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('upi');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNoteChange = (text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length > MAX_NOTE_WORDS) {
      const clamped = text.split(/\s+/).slice(0, MAX_NOTE_WORDS).join(' ');
      setNote(clamped);
    } else {
      setNote(text);
    }
  };

  // ─── Fetch categories on mount & on focus (e.g. returning from AddEditCategory) ───
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchCategories(true);
    });
    return unsubscribe;
  }, [navigation, fetchCategories]);

  // ─── Pre-fill form when editing an existing expense (P1.7: once only via ref) ───
  useEffect(() => {
    if (hasPrefilled.current) return;

    if (!isEdit || !expenseId) {
      setTransactionType('expense');
      hasPrefilled.current = true;
      return;
    }

    const currentExpense = expenses.find((e) => e.id === expenseId);
    if (currentExpense) {
      setAmount(currentExpense.amount.toString());
      setSelectedCategoryId(currentExpense.category_id || null);
      setNote(currentExpense.note || '');
      setSelectedDate(parseISO(currentExpense.expense_date));
      setPaymentMode(currentExpense.payment_mode);
      setTransactionType(currentExpense.type === 'income' ? 'income' : 'expense');
      hasPrefilled.current = true;
    }
  }, [isEdit, expenseId, expenses]);

  // ─── Toggle transaction type handler ──────────────────────────────────────
  const handleTypeChange = useCallback(
    (type: 'expense' | 'income') => {
      setTransactionType(type);
      // Auto-fallback: Card is excluded in Add Money mode
      if (type === 'income' && paymentMode === 'card') {
        setPaymentMode('upi');
      }
    },
    [paymentMode]
  );

  // ─── Keypad handler ───────────────────────────────────────────────────────
  const handleKeyPress = useCallback((val: string) => {
    setAmount((prev) => applyKeypadPress(prev, val));
  }, []);

  const isCategoriesLoading = useCategoryStore((s) => s.loading);
  const isCategoriesFetched = useCategoryStore((s) => s.isFetched);
  const areCategoriesPlaceholder = !isCategoriesFetched || categories.some((c) => c.isPlaceholder);

  // ─── Save / Update ────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isSubmitting) return;

    const numAmount = parseFloat(amount);
    const selectedCat = categories.find((c) => c.id === selectedCategoryId);
    const isCategorySelectedAndReal =
      transactionType === 'income' ||
      (selectedCategoryId !== null && selectedCat && !selectedCat.isPlaceholder);

    const isValid = numAmount > 0 && isCategorySelectedAndReal;
    if (!isValid) {
      if (transactionType === 'expense') {
        if (areCategoriesPlaceholder) {
          Alert.alert('Categories Loading', 'Please wait a moment for categories to finish loading.');
        } else if (categories.length === 0) {
          Alert.alert('No Category', 'Please create a category first to add an expense.');
        }
      }
      return;
    }

    setIsSubmitting(true);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    // P1.6: Income saves with category_id = null (no keyword guessing)
    const categoryIdToSave = transactionType === 'income' ? null : selectedCategoryId;

    const trimmedNote = note.trim();
    const clampedNote = trimmedNote
      ? trimmedNote.split(/\s+/).slice(0, MAX_NOTE_WORDS).join(' ').slice(0, MAX_NOTE_CHARS)
      : '';

    try {
      if (isEdit && expenseId) {
        await updateExpense(
          expenseId,
          numAmount,
          categoryIdToSave,
          clampedNote,
          paymentMode,
          dateStr,
          transactionType
        );
      } else {
        await addExpense(
          numAmount,
          categoryIdToSave,
          clampedNote,
          paymentMode,
          dateStr,
          transactionType
        );
      }
      // Keep daily budget and smart notifications in sync
      const currentExpenses = useExpenseStore.getState().expenses;
      useDailyBudgetStore.getState().syncWithExpenses(currentExpenses);

      navigation.goBack();
    } catch (e: any) {
      setIsSubmitting(false);
      Alert.alert('Error', e?.message || 'Could not save transaction. Please try again.');
    }
  };

  const formattedDate = formatDate(selectedDate, true);
  const numAmount = parseFloat(amount || '0');
  const selectedCat = categories.find((c) => c.id === selectedCategoryId);
  const isCategorySelectedAndReal =
    transactionType === 'income' ||
    (selectedCategoryId !== null && selectedCat && !selectedCat.isPlaceholder);

  const isSaveEnabled =
    numAmount > 0 && isCategorySelectedAndReal && !isSubmitting;

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
                            setSelectedCategoryId(cat.id);
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
            style={[styles.inputContainer, { backgroundColor: colors.inputBg }]}
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
              onFocus={handleNoteFocus}
            />
          </Pressable>
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
          onConfirm={(date) => setSelectedDate(date)}
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
  typeToggleContainer: {
    height: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    position: 'relative',
    overflow: 'hidden',
  },
  typeToggleSegment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  typeSegmentContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.element,
  },
  typeToggleText: {
    fontSize: FontSize.body,
    includeFontPadding: false,
    textAlignVertical: 'center',
    letterSpacing: 0.2,
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
  paymentToggleContainer: {
    height: ControlHeight.row,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    position: 'relative',
    marginBottom: Spacing.block,
    overflow: 'hidden',
  },
  paymentSlidingPill: {
    position: 'absolute',
    top: 5,
    bottom: 5,
    left: 5,
    borderRadius: BorderRadius.pill,
  },
  paymentToggleSegment: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  paymentSegmentContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentActiveOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentToggleText: {
    fontSize: FontSize.bodySmall,
    marginLeft: Spacing.element,
    includeFontPadding: false,
    textAlignVertical: 'center',
    transform: [{ translateY: -0.5 }],
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
