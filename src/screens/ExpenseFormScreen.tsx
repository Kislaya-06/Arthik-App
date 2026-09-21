import React, { useRef, useState, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  Platform, KeyboardAvoidingView, StyleSheet, Keyboard,
  ActivityIndicator, Animated, PanResponder,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft, Calendar, ChevronRight, Plus,
} from 'lucide-react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
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
  ['1', '2', '3', '÷'],
  ['4', '5', '6', '×'],
  ['7', '8', '9', '−'],
  ['.', '0', 'backspace', '+'],
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
    keypadAnim,
    handleAmountPress,
    handleNoteLayout,
    handleNoteFocus,
    handleNoteBlur,
    showKeypad,
    hideKeypad,
    handleKeypadDrag,
    handleKeypadDragEnd,
  } = useFormKeyboard();

  const {
    amount,
    evaluatedAmount,
    formattedExpression,
    hasOperator,
    isDivisionByZero,
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

  const onTypeChange = useCallback(
    (type: 'expense' | 'income') => {
      handleTypeChange(type);
      showKeypad();
    },
    [handleTypeChange, showKeypad]
  );

  // Keypad-only interpolations — category stays always visible (no animation)
  const {
    keypadHeight,
    keypadOpacity,
    keypadTranslateY,
    saveButtonMarginTop,
  } = useMemo(() => {
    return {
      keypadHeight: keypadAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 258],
        extrapolate: 'clamp',
      }),
      keypadOpacity: keypadAnim.interpolate({
        inputRange: [0, 0.4, 1],
        outputRange: [0, 0.6, 1],
        extrapolate: 'clamp',
      }),
      keypadTranslateY: keypadAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [30, 0],
        extrapolate: 'clamp',
      }),
      saveButtonMarginTop: keypadAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 14],
        extrapolate: 'clamp',
      }),
    };
  }, [keypadAnim]);

  // PanResponder to slide the keyboard down with a finger gesture
  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return (
            gestureState.dy > 8 &&
            Math.abs(gestureState.dy) > Math.abs(gestureState.dx) * 1.2
          );
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dy > 0) {
            handleKeypadDrag(gestureState.dy);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          handleKeypadDragEnd(gestureState.dy, gestureState.vy);
        },
        onPanResponderTerminate: () => {
          handleKeypadDragEnd(0, 0);
        },
      }),
    [handleKeypadDrag, handleKeypadDragEnd]
  );

  const showSuggestions = isNoteFocused && noteSuggestions.length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ── */}
      <View style={[styles.header, { marginTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => {
            if (navigation.canGoBack()) {
              navigation.goBack();
            }
          }}
          hitSlop={10}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
          {isEdit ? 'Edit Expense' : 'Add Transaction'}
        </Text>
      </View>

      {/* ── Transaction Type Segmented Toggle ── */}
      <View style={styles.typeToggleWrapper}>
        <BouncyTypeToggle
          value={transactionType}
          onChange={onTypeChange}
        />
      </View>

      {/* ── Middle Body (Amount Display + Scrollable Section) ── */}
      <View style={styles.bodyWrapper}>
        {/* ── Amount Display ── */}
        <Pressable
          style={styles.amountContainer}
          onPress={handleAmountPress}
        >
          {hasOperator && (
            <Text
              numberOfLines={1}
              ellipsizeMode="head"
              style={[
                styles.expressionText,
                { color: colors.textSecondary, fontFamily: FontFamily.medium },
              ]}
            >
              {formattedExpression}
            </Text>
          )}
          <View style={styles.amountRow}>
            <Text
              style={[
                styles.currencySymbol,
                { color: isDivisionByZero ? colors.danger : colors.textMuted },
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
                isDivisionByZero
                  ? { color: colors.danger }
                  : (hasOperator ? evaluatedAmount > 0 : amount)
                  ? { color: colors.textPrimary }
                  : { color: colors.textMuted },
                { fontFamily: FontFamily.bold },
              ]}
            >
              {isDivisionByZero
                ? '—'
                : hasOperator
                ? formatAmountWithCommas(evaluatedAmount.toString()) || '0'
                : formatAmountWithCommas(amount) || '0'}
            </Text>
          </View>
          <View
            style={[
              styles.amountUnderline,
              { backgroundColor: isDivisionByZero ? colors.danger : colors.border },
            ]}
          />
        </Pressable>

      {/* ── Scrollable Section (Category, Note, Date, Payment) ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollSection}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Category Selector (Expense mode only) — always visible */}
        {transactionType === 'expense' && (
          <View
          >
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
              <View style={styles.categoryScrollContainer}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.categoryList}
                >
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
                            hideKeypad();
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
                  <Pressable
                    disabled={areCategoriesPlaceholder || isCategoriesLoading}
                    onPress={() => navigation.navigate('ManageCategories')}
                    hitSlop={8}
                    style={({ pressed }) => [
                      styles.categoryChip,
                      styles.manageCategoryChip,
                      {
                        backgroundColor: colors.card,
                        borderColor: colors.border,
                        opacity:
                          areCategoriesPlaceholder || isCategoriesLoading
                            ? 0.45
                            : pressed
                            ? 0.7
                            : 1,
                      },
                    ]}
                    accessibilityLabel="Manage categories"
                    accessibilityRole="button"
                  >
                    <Plus size={16} color={colors.textPrimary} />
                  </Pressable>
                </ScrollView>

                {/* Left Fade Overlay (padding area) */}
                <View pointerEvents="none" style={styles.categoryFadeLeft}>
                  <Svg width="100%" height="100%" preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id="expenseCategoryFadeLeft" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={colors.background} stopOpacity="1" />
                        <Stop offset="0.5" stopColor={colors.background} stopOpacity="0.8" />
                        <Stop offset="1" stopColor={colors.background} stopOpacity="0" />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#expenseCategoryFadeLeft)" />
                  </Svg>
                </View>

                {/* Right Fade Overlay (padding area) */}
                <View pointerEvents="none" style={styles.categoryFadeRight}>
                  <Svg width="100%" height="100%" preserveAspectRatio="none">
                    <Defs>
                      <LinearGradient id="expenseCategoryFadeRight" x1="0" y1="0" x2="1" y2="0">
                        <Stop offset="0" stopColor={colors.background} stopOpacity="0" />
                        <Stop offset="0.5" stopColor={colors.background} stopOpacity="0.8" />
                        <Stop offset="1" stopColor={colors.background} stopOpacity="1" />
                      </LinearGradient>
                    </Defs>
                    <Rect width="100%" height="100%" fill="url(#expenseCategoryFadeRight)" />
                  </Svg>
                </View>
              </View>
            )}
          </View>
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
          <View
            style={[
              styles.inputContainer,
              {
                backgroundColor: colors.inputBg,
                marginBottom: showSuggestions ? Spacing.element : Spacing.block,
              },
            ]}
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
              onBlur={() => {
                setIsNoteFocused(false);
                handleNoteBlur();
              }}
            />
          </View>

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
        <Text style={[styles.sectionLabel, styles.formSectionPadding, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
          DATE
        </Text>
        <Pressable
          onPress={() => {
            Keyboard.dismiss();
            hideKeypad();
            setShowDatePicker(true);
          }}
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
        <Text style={[styles.sectionLabel, styles.formSectionPadding, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
          {transactionType === 'income' ? 'MONEY ADDED VIA' : 'PAID VIA'}
        </Text>
        <View style={styles.formSectionPadding}>
          <BouncyPaymentToggle
            value={paymentMode}
            onChange={(mode) => {
              hideKeypad();
              setPaymentMode(mode);
            }}
            options={transactionType === 'income' ? INCOME_PAYMENT_OPTIONS : EXPENSE_PAYMENT_OPTIONS}
            activeColor={transactionType === 'income' ? colors.mintGreen : colors.peachCoral}
          />
        </View>
      </ScrollView>
      </View>

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
        <Animated.View
          {...panResponder.panHandlers}
          pointerEvents={isKeypadVisible ? 'auto' : 'none'}
          style={{
            height: keypadHeight,
            opacity: keypadOpacity,
            transform: [{ translateY: keypadTranslateY }],
            overflow: 'hidden',
          }}
        >
          {/* ── Keypad Drag Handle Bar (Slide down to dismiss) ── */}
          <Pressable
            hitSlop={{ top: 8, bottom: 12, left: 30, right: 30 }}
            onPress={hideKeypad}
            style={styles.keypadHandleBar}
            accessibilityLabel="Dismiss keypad"
            accessibilityRole="button"
          >
            <View style={[styles.keypadHandle, { backgroundColor: colors.border }]} />
          </Pressable>

          <View style={styles.keypadGrid}>
            {KEYPAD_ROWS.map((row, rIdx) => (
              <View key={rIdx} style={styles.keypadRow}>
                {row.map((item) => (
                  <KeyButton key={item} item={item} onPress={handleKeyPress} />
                ))}
              </View>
            ))}
          </View>
        </Animated.View>

        <Animated.View style={{ marginTop: isKeyboardOpen ? 0 : saveButtonMarginTop }}>
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
                      borderColor: isDivisionByZero ? colors.danger : colors.borderSubtle,
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
                    color: isDivisionByZero
                      ? colors.danger
                      : isSaveEnabled
                      ? colors.forestGreen
                      : colors.textMuted,
                    fontFamily: FontFamily.bold,
                  },
                ]}
              >
                {isDivisionByZero
                  ? 'Cannot divide by 0'
                  : isEdit
                  ? (transactionType === 'income' ? 'Update Transaction' : 'Update Expense')
                  : (transactionType === 'income' ? 'Save Transaction' : 'Save Expense')}
              </Text>
            )}
          </Pressable>
        </Animated.View>
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
    marginTop: Spacing.block,
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: Spacing.block,
  },
  expressionText: {
    fontSize: FontSize.body,
    marginBottom: Spacing.nano,
    textAlign: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 48,
    marginRight: Spacing.micro,
  },
  amountValue: {
    fontSize: 56,
  },
  amountUnderline: {
    height: 1,
    width: 80,
    marginTop: Spacing.element,
  },
  bodyWrapper: {
    flex: 1,
  },
  scrollSection: {
    flex: 1,
    marginTop: Spacing.surface,
  },
  scrollContent: {
    paddingBottom: Spacing.section,
  },
  formSectionPadding: {
    paddingHorizontal: Spacing.gutter,
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
    paddingHorizontal: Spacing.gutter,
  },
  sectionLabelNoMargin: {
    marginBottom: 0,
  },
  noteCounterText: {
    fontSize: FontSize.caption,
    letterSpacing: 0.2,
  },

  categoryScrollContainer: {
    position: 'relative',
    marginBottom: Spacing.block,
  },
  categoryList: {
    flexDirection: 'row',
    gap: Spacing.group,
    paddingHorizontal: Spacing.gutter,
  },
  categoryFadeLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 36,
    zIndex: 10,
  },
  categoryFadeRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 36,
    zIndex: 10,
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
  manageCategoryChip: {
    paddingHorizontal: Spacing.group,
    justifyContent: 'center',
  },
  emptyCategoriesContainer: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.block,
    borderRadius: BorderRadius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: Spacing.block,
    marginHorizontal: Spacing.gutter,
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
    marginHorizontal: Spacing.gutter,
  },
  suggestionsScroll: {
    marginBottom: Spacing.block,
  },
  suggestionsList: {
    flexDirection: 'row',
    gap: Spacing.element,
    paddingHorizontal: Spacing.gutter,
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
    marginHorizontal: Spacing.gutter,
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.surface,
    paddingTop: 10,
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
    marginTop: 0,
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
  keypadHandleBar: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    marginBottom: Spacing.micro,
  },
  keypadHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
  },
});
