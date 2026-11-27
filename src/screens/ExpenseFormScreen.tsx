import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, Platform, KeyboardAvoidingView, Keyboard, ActivityIndicator, Animated, useAnimatedValue, LayoutChangeEvent } from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  interpolateColor,
  Easing as REasing,
  Extrapolation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import { AmbientBackground } from '../components/AmbientBackground';
import { ScreenHeader } from '../components/ui/ScreenHeader';
import Calendar from 'lucide-react-native/icons/calendar';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import PenLine from 'lucide-react-native/icons/pen-line';
import Plus from 'lucide-react-native/icons/plus';
import Check from 'lucide-react-native/icons/check';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { CustomDatePickerModal } from '../components/CustomDatePickerModal';
import { VaultSpendingGuardModal } from '../components/VaultSpendingGuardModal';
import { TransferExtras } from '../components/transfer/TransferExtras';
import { SplitExtras } from '../components/split/SplitExtras';
import { MoneyBackExtras } from '../components/split/MoneyBackExtras';
import { BouncyTypeToggle } from '../components/BouncyTypeToggle';
import {
  BouncyPaymentToggle,
  EXPENSE_PAYMENT_OPTIONS,
  INCOME_PAYMENT_OPTIONS,
} from '../components/BouncyPaymentToggle';
import { Category } from '../store/categoryStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyButton } from '../components/KeyButton';
import { formatAmountWithCommas, formatCurrency } from '../lib/formatters';
import { useTheme } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { useFormKeyboard } from '../hooks/useFormKeyboard';
import {
  useExpenseForm,
  MAX_NOTE_WORDS,
  MAX_NOTE_CHARS,
  countWords,
} from '../hooks/useExpenseForm';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';
import { PressableOpacity } from '../components/ui/PressableOpacity';
import { FormGroup, FormRow } from '../components/ui/FormGroup';
import { PRESS_DIM_OPACITY } from '../lib/pressFeedback';
import { styles } from './ExpenseFormScreen.styles';
import { CategoryChipItem } from './expenseForm/CategoryChipItem';

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
    keypad,
    handleAmountPress,
    handleNoteFocus,
    handleNoteBlur,
    handleSplitLayout,
    handleSplitFocus,
    handleSplitReveal,
    setNoteOffset,
    setSplitOffset,
    showKeypad,
    hideKeypad,
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
    showVaultGuard,
    setShowVaultGuard,
    vaultLiquidity,
    isBudgetModeEnabled,
    backdatedSpendingNotice,
    shortfallAmount,
    editShortfall,
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
    handleSaveWithIncome,
    noteSuggestions,
    handleSelectNoteSuggestion,
    isSelfTransfer,
    split,
    moneyBack,
    toggleSelfTransfer,
    rememberMode,
    setRememberMode,
    canRememberTransfer,
    transferRuleMatched,
  } = useExpenseForm({ route, navigation });

  const isIncome = transactionType === 'income';

  // The note and split / money-back rows sit inside the details card, so their scroll position (for the keyboard)
  // is the card's Y in the scroll content plus the row's Y in the card.
  const detailsYRef = useRef(0);
  const noteRowYRef = useRef(0);
  const extrasRowYRef = useRef(0);
  const syncFieldOffsets = useCallback(() => {
    setNoteOffset(detailsYRef.current + noteRowYRef.current);
    setSplitOffset(detailsYRef.current + extrasRowYRef.current);
  }, [setNoteOffset, setSplitOffset]);
  const handleDetailsLayout = useCallback((e: LayoutChangeEvent) => {
    detailsYRef.current = e.nativeEvent.layout.y;
    syncFieldOffsets();
  }, [syncFieldOffsets]);
  const handleNoteRowLayout = useCallback((e: LayoutChangeEvent) => {
    noteRowYRef.current = e.nativeEvent.layout.y;
    syncFieldOffsets();
  }, [syncFieldOffsets]);
  const handleExtrasRowLayout = useCallback((e: LayoutChangeEvent) => {
    extrasRowYRef.current = e.nativeEvent.layout.y;
    syncFieldOffsets();
  }, [syncFieldOffsets]);
  // Hero amount: muted while empty, then the side's amount colour (income mintText / expense coralText, like AmountText).
  const hasTypedAmount = hasOperator ? evaluatedAmount > 0 : Boolean(amount);
  const amountColor = isDivisionByZero
    ? colors.danger
    : hasTypedAmount
    ? (isIncome ? colors.mintText : colors.coralText)
    : colors.textMuted;

  const onTypeChange = useCallback(
    (type: 'expense' | 'income') => {
      handleTypeChange(type);
      showKeypad();
    },
    [handleTypeChange, showKeypad]
  );

  // Animation: Error shake on invalid save (amount scale punch removed for instant typing)
  const amountShake = useAnimatedValue(0);
  // Category chips: the left fade only shows once the row is scrolled (at rest it sat on the first chip).
  const categoryScrollX = useAnimatedValue(0);

  const triggerErrorShake = useCallback(() => {
    Animated.sequence([
      Animated.timing(amountShake, { toValue: -8, duration: 40, useNativeDriver: true }),
      Animated.timing(amountShake, { toValue: 8, duration: 40, useNativeDriver: true }),
      Animated.timing(amountShake, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(amountShake, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(amountShake, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start();
  }, [amountShake]);

  // Animations: Save button morph to green circle & tick reveal (never turns grey)
  const [buttonFullWidth, setButtonFullWidth] = useState<number>(0);
  const [isMorphing, setIsMorphing] = useState<boolean>(false);
  const [showTick, setShowTick] = useState<boolean>(false);
  const morph = useSharedValue(0);
  const tickScale = useSharedValue(0.88);
  const tickOpacity = useSharedValue(0);
  // One size always (owner, 2026-11-21): the Save button no longer shrinks while the keyboard is open.
  const buttonHeight = ControlHeight.cta;

  const isButtonGreen = isSaveEnabled || isSubmitting || isMorphing || showTick;

  // The button eases into mint when an amount is typed (UI-thread backgroundColor, never a per-frame Text colour).
  const saveReady = useSharedValue(isButtonGreen ? 1 : 0);
  useEffect(() => {
    saveReady.value = withTiming(isButtonGreen ? 1 : 0, {
      duration: 200,
      easing: REasing.bezier(0.23, 1, 0.32, 1),
    });
  }, [isButtonGreen, saveReady]);

  const idleFill = colors.cardSubtle;
  const readyFill = colors.mintGreen;
  const idleBorder = isDivisionByZero ? colors.danger : colors.borderSubtle;
  const saveFillStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(saveReady.value, [0, 1], [idleFill, readyFill]),
    borderColor: interpolateColor(saveReady.value, [0, 1], [idleBorder, readyFill]),
  }), [idleFill, readyFill, idleBorder]);

  // With an amount the label says what will be saved ("Save ₹250"), like "Pay ₹250" in payment apps.
  const saveLabel = isDivisionByZero
    ? 'Cannot divide by 0'
    : evaluatedAmount > 0
    ? `${isEdit ? 'Update' : 'Save'} ${formatCurrency(evaluatedAmount)}`
    : isEdit
    ? (isIncome ? 'Update Transaction' : 'Update Expense')
    : (isIncome ? 'Save Transaction' : 'Save Expense');

  const morphStyle = useAnimatedStyle(() => ({
    width: buttonFullWidth > 0
      ? interpolate(morph.value, [0, 1], [buttonFullWidth, buttonHeight], Extrapolation.CLAMP)
      : '100%',
  }), [buttonFullWidth, buttonHeight]);

  const textOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(morph.value, [0, 0.25], [1, 0], Extrapolation.CLAMP),
  }));

  const tickScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: tickScale.value }],
    opacity: tickOpacity.value,
  }));

  const onSavePress = useCallback(async () => {
    if (!isSaveEnabled) {
      triggerErrorShake();
      return;
    }
    const needsCategory =
      !isSelfTransfer &&
      !(transactionType === 'income' && moneyBack.visible && moneyBack.mode !== 'income');
    if (needsCategory && !selectedCategoryId) {
      triggerErrorShake();
    }
    try {
      await handleSave(async () => {
        const editId = (route.params as any)?.expenseId;
        if (isEdit && editId) {
          try {
            const { reconcileExpenseSaved } = await import('../features/autoLog/reviews');
            const userId = useAuthStore.getState().user?.id;
            await reconcileExpenseSaved(editId, userId);
          } catch {
            // Best-effort
          }
        }
        Keyboard.dismiss();
        hideKeypad();
        setIsMorphing(true);

        // 1. Button smoothly contracts into green circle with strong UI ease-out
        await new Promise<void>((resolve) => {
          morph.value = withTiming(
            1,
            {
              duration: 180,
              easing: REasing.bezier(0.23, 1, 0.32, 1),
            },
            () => {
              'worklet';
              scheduleOnRN(resolve);
            }
          );
        });

        // 2. Tick appears naturally from 0.88 scale with smooth opacity fade (never scale(0))
        setShowTick(true);
        tickScale.value = 0.88;
        tickOpacity.value = 0;
        tickScale.value = withSpring(1, {
          stiffness: 356.9,
          damping: 19,
          mass: 1,
        });
        tickOpacity.value = withTiming(1, {
          duration: 160,
          easing: REasing.bezier(0.23, 1, 0.32, 1),
        });

        // 3. Keep green circle + tick visible for a brief moment ("bahut kam time ke liye")
        await new Promise((resolve) => setTimeout(resolve, 450));
      });
    } catch {
      setIsMorphing(false);
      setShowTick(false);
      morph.value = 0;
      tickScale.value = 0.88;
      tickOpacity.value = 0;
    }
  }, [isSaveEnabled, triggerErrorShake, handleSave, hideKeypad, morph, tickScale, tickOpacity]);

  // Keypad & Save Button Reanimated styles
  const keypadAnimatedStyle = useAnimatedStyle(() => ({
    height: interpolate(keypad.value, [0, 1], [0, 258], Extrapolation.CLAMP),
    opacity: interpolate(keypad.value, [0, 0.4, 1], [0, 0.6, 1], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(keypad.value, [0, 1], [30, 0], Extrapolation.CLAMP) }],
  }));

  const saveButtonWrapperStyle = useAnimatedStyle(() => ({
    marginTop: isKeyboardOpen ? 0 : interpolate(keypad.value, [0, 1], [0, 14], Extrapolation.CLAMP),
  }), [isKeyboardOpen]);

  // RNGH Pan gesture to slide the keypad down with a finger gesture
  const touchStart = useSharedValue({ x: 0, y: 0 });

  const keypadPan = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isKeypadVisible)
        .manualActivation(true)
        .onTouchesDown((e) => {
          'worklet';
          const t = e.allTouches[0];
          if (t) {
            touchStart.value = { x: t.x, y: t.y };
          }
        })
        .onTouchesMove((e, state) => {
          'worklet';
          const t = e.allTouches[0];
          if (!t) return;
          const dx = t.x - touchStart.value.x;
          const dy = t.y - touchStart.value.y;
          if (dy > 8 && Math.abs(dy) > Math.abs(dx) * 1.2) {
            state.activate();
          } else if (Math.abs(dx) > 12) {
            state.fail();
          }
        })
        .onUpdate((e) => {
          'worklet';
          if (e.translationY > 0) {
            const progress = Math.max(0, Math.min(1, 1 - e.translationY / 258));
            keypad.value = progress;
          }
        })
        .onEnd((e) => {
          'worklet';
          scheduleOnRN(handleKeypadDragEnd, e.translationY, e.velocityY / 1000);
        }),
    [isKeypadVisible, keypad, handleKeypadDragEnd, touchStart]
  );

  const showSuggestions = isNoteFocused && noteSuggestions.length > 0;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      {/* Top glow follows the side: spending coral (the Insights hue) for Expense, Home mint for Income. */}
      <AmbientBackground tone={isIncome ? 'home' : 'insights'} />
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ── */}
      <ScreenHeader
        title={isEdit ? 'Edit Expense' : 'Add Transaction'}
        backDisabled={isSubmitting || isMorphing}
        style={{ marginTop: insets.top + Spacing.micro }}
      />

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
              numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}
              ellipsizeMode="head"
              style={[
                styles.expressionText,
                { color: colors.textSecondary, fontFamily: FontFamily.medium },
              ]}
            >
              {formattedExpression}
            </Text>
          )}
          <Animated.View
            style={[
              styles.amountRow,
              {
                transform: [
                  { translateX: amountShake },
                ],
              },
            ]}
          >
            <Text
              style={[
                styles.currencySymbol,
                { color: amountColor, fontFamily: FontFamily.semibold },
              ]}
            >
              ₹
            </Text>
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              style={[
                styles.amountValue,
                { color: amountColor, fontFamily: FontFamily.bold },
              ]}
            >
              {isDivisionByZero
                ? '—'
                : hasOperator
                ? formatAmountWithCommas(evaluatedAmount.toString()) || '0'
                : formatAmountWithCommas(amount) || '0'}
            </Text>
          </Animated.View>
        </Pressable>

      {/* ── Scrollable Section (Category, Note, Date, Payment) ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollSection}
        contentContainerStyle={[
          styles.scrollContent,
          isKeyboardOpen && { paddingBottom: 280 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {/* Income only: what kind of money came in. First, because it decides whether a category is needed (SPL-003). */}
        {moneyBack.visible && (
          <MoneyBackExtras
            moneyBack={moneyBack}
            amount={evaluatedAmount}
            onFieldFocus={handleSplitFocus}
            onLayout={handleSplitLayout}
          />
        )}

        {/* Category Selector — expense categories for expenses, income categories for income (CAT-004).
            Hidden while recording money that came back: that has no category of its own (SPL-003). */}
        {(transactionType === 'expense' || !moneyBack.visible || moneyBack.mode === 'income') && (
          <View
          >
            <View style={styles.sectionLabelRow}>
              <Text style={[styles.sectionLabel, styles.sectionLabelNoMargin, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
                {isIncome ? 'INCOME CATEGORY' : 'CATEGORY'}
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
                  {isIncome
                    ? 'No income categories found. Create one to add income.'
                    : 'No categories found. Create one to add an expense.'}
                </Text>
                <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
                  style={[styles.createCategoryBtn, { backgroundColor: colors.mintGreen }]}
                  onPress={() => (navigation as any).navigate('AddEditCategory', { kind: transactionType })}
                >
                  <Text style={[styles.createCategoryBtnText, { color: colors.forestGreen, fontFamily: FontFamily.bold }]}>
                    + Create Category
                  </Text>
                </PressableOpacity>
              </View>
            ) : (
              <View style={styles.categoryScrollContainer}>
                <Animated.ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="always"
                  contentContainerStyle={styles.categoryList}
                  onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: categoryScrollX } } }], { useNativeDriver: true })}
                  scrollEventThrottle={16}
                >
                  {categories.map((cat: Category) => {
                    const isPlaceholder = Boolean(cat.isPlaceholder) || areCategoriesPlaceholder;
                    const isSelected = selectedCategoryId === cat.id && !isPlaceholder;
                    return (
                      <CategoryChipItem
                        key={cat.id}
                        category={cat}
                        isSelected={isSelected}
                        isPlaceholder={isPlaceholder}
                        onSelect={handleCategorySelect}
                        colors={colors}
                        isDark={isDark}
                      />
                    );
                  })}
                  <Pressable
                    disabled={areCategoriesPlaceholder || isCategoriesLoading}
                    onPress={() => navigation.navigate('ManageCategories', { kind: transactionType })}
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
                </Animated.ScrollView>

                {/* Left Fade Overlay: hidden at rest, fades in over the first 16px of scroll */}
                <Animated.View
                  pointerEvents="none"
                  style={[
                    styles.categoryFadeLeft,
                    { opacity: categoryScrollX.interpolate({ inputRange: [0, 16], outputRange: [0, 1], extrapolate: 'clamp' }) },
                  ]}
                >
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
                </Animated.View>

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

        {/* ── Paid via / Added via: a primary choice made on every entry, so it is a full-size section ── */}
        <View style={styles.choiceSection}>
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: FontFamily.bold }]}>
            {isIncome ? 'ADDED VIA' : 'PAID VIA'}
          </Text>
          <BouncyPaymentToggle
            value={paymentMode}
            onChange={(mode) => {
              hideKeypad();
              setPaymentMode(mode);
            }}
            options={isIncome ? INCOME_PAYMENT_OPTIONS : EXPENSE_PAYMENT_OPTIONS}
            activeColor={isIncome ? colors.mintGreen : colors.peachCoral}
          />
        </View>

        {/* ── Optional details: ONE light inset card (date, split, self-transfer, note), every row one 56dp line ── */}
        <FormGroup onLayout={handleDetailsLayout}>
          <FormRow
            icon={Calendar}
            title="Date"
            onPress={() => {
              Keyboard.dismiss();
              hideKeypad();
              setShowDatePicker(true);
            }}
            accessibilityLabel={`Date, ${formattedDate}`}
            right={
              <View style={styles.rowValue}>
                <Text numberOfLines={1} style={[styles.rowValueText, { color: colors.textSecondary }]}>
                  {formattedDate}
                </Text>
                <ChevronRight size={18} color={colors.textMuted} />
              </View>
            }
          />

          {/* Split with someone (expenses only). Rendered only when visible, so the card never shows an empty row. */}
          {split.visible && (
            <SplitExtras
              split={split}
              onFieldFocus={handleSplitFocus}
              onReveal={handleSplitReveal}
              onLayout={handleExtrasRowLayout}
            />
          )}

          {/* Self-transfer (new transactions only): one line like the other rows; its meaning opens once it is on */}
          {!isEdit && (
            <TransferExtras
              isSelfTransfer={isSelfTransfer}
              onToggleSelfTransfer={toggleSelfTransfer}
              rememberMode={rememberMode}
              onRememberMode={setRememberMode}
              canRemember={canRememberTransfer}
              ruleMatched={transferRuleMatched}
              onNeedNote={() => noteInputRef.current?.focus()}
            />
          )}

          {/* Note: the text field IS the row (no separate label) */}
          <FormRow
            icon={PenLine}
            onLayout={handleNoteRowLayout}
            middle={
              <TextInput
                ref={noteInputRef}
                value={note}
                onChangeText={handleNoteChange}
                maxLength={MAX_NOTE_CHARS}
                placeholder="Add a note (optional)"
                placeholderTextColor={colors.textMuted}
                keyboardAppearance={isDark ? 'dark' : 'light'}
                style={[styles.noteInput, { color: colors.textPrimary, fontFamily: FontFamily.medium }]}
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                accessibilityLabel="Note"
                onFocus={() => {
                  setIsNoteFocused(true);
                  handleNoteFocus();
                }}
                onBlur={() => {
                  setIsNoteFocused(false);
                  handleNoteBlur();
                }}
              />
            }
            right={
              note.length > 0 ? (
                <Text
                  accessibilityLabel={`${countWords(note)} of ${MAX_NOTE_WORDS} words`}
                  style={[
                    styles.noteCounterText,
                    {
                      color:
                        countWords(note) >= MAX_NOTE_WORDS || note.length >= MAX_NOTE_CHARS
                          ? colors.coralText
                          : colors.textMuted,
                      fontFamily: FontFamily.semibold,
                    },
                  ]}
                >
                  {countWords(note)}/{MAX_NOTE_WORDS}
                </Text>
              ) : null
            }
          />
        </FormGroup>

        {/* Recent notes to reuse, right under the note row while it has focus */}
        {showSuggestions && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="always"
            style={styles.suggestionsScroll}
            contentContainerStyle={styles.suggestionsList}
          >
            {noteSuggestions.map((suggestion) => (
              <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
                key={suggestion}
                onPress={() => handleSelectNoteSuggestion(suggestion)}
                style={[styles.suggestionChip, { backgroundColor: colors.card, borderColor: colors.borderSubtle }]}
              >
                <Text style={[styles.suggestionText, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
                  {suggestion}
                </Text>
              </PressableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Dynamic Backdated Spending Notice (FIN-01 / UX Transparency) */}
        {backdatedSpendingNotice && (
          <View
            style={[
              styles.backdatedNoticeCard,
              {
                backgroundColor: backdatedSpendingNotice.hasShortfall
                  ? (isDark ? 'rgba(245, 158, 11, 0.12)' : '#FFFBEB')
                  : (isDark ? 'rgba(139, 92, 246, 0.10)' : '#F5F3FF'),
                borderColor: backdatedSpendingNotice.hasShortfall
                  ? (isDark ? 'rgba(245, 158, 11, 0.32)' : '#FDE68A')
                  : (isDark ? 'rgba(139, 92, 246, 0.28)' : '#DDD6FE'),
              },
            ]}
          >
            <View style={styles.backdatedNoticeLeftIcon}>
              {backdatedSpendingNotice.hasShortfall ? (
                <AlertTriangle size={18} color={isDark ? '#FBBF24' : '#D97706'} />
              ) : (
                <PiggyBankCoinIcon size={18} color={isDark ? '#A78BFA' : '#7C3AED'} />
              )}
            </View>
            <View style={styles.backdatedNoticeTextWrap}>
              <Text
                style={[
                  styles.backdatedNoticeTitle,
                  {
                    color: backdatedSpendingNotice.hasShortfall
                      ? (isDark ? '#FBBF24' : '#B45309')
                      : (isDark ? '#DDD6FE' : '#6D28D9'),
                    fontFamily: FontFamily.bold,
                  },
                ]}
              >
                {backdatedSpendingNotice.title}
              </Text>
              <Text
                style={[
                  styles.backdatedNoticeDesc,
                  {
                    color: colors.textSecondary,
                    fontFamily: FontFamily.medium,
                  },
                ]}
              >
                {backdatedSpendingNotice.description}
              </Text>
            </View>
          </View>
        )}

        <CustomDatePickerModal
          visible={showDatePicker}
          value={selectedDate}
          maxDate={new Date()}
          onConfirm={handleDateConfirm}
          onClose={() => setShowDatePicker(false)}
        />

        <VaultSpendingGuardModal
          visible={showVaultGuard}
          onClose={() => setShowVaultGuard(false)}
          expenseAmount={editShortfall || (shortfallAmount > 0 ? shortfallAmount : evaluatedAmount)}
          onAddMoneyAndSave={handleSaveWithIncome}
          onAddIncomeFirst={() => {
            setShowVaultGuard(false);
            onTypeChange('income');
          }}
          isBudgetMode={isBudgetModeEnabled}
          totalVaultLiquidity={editShortfall ? 0 : vaultLiquidity.totalVaultLiquidity}
        />

      </ScrollView>
      </View>

      {/* ── Bottom Console (Keypad + Save Button) ── */}
      <View
        style={[
          styles.bottomSection,
          {
            backgroundColor: colors.card,
            borderTopColor: colors.borderSubtle,
            // Same bottom room always: with the keyboard open the button neither shrinks nor drops onto the gesture bar.
            paddingBottom: Math.max(insets.bottom, 14) + 8,
          },
        ]}
      >
        <GestureDetector gesture={keypadPan}>
          <Reanimated.View
            pointerEvents={isKeypadVisible ? 'auto' : 'none'}
            style={[
              {
                overflow: 'hidden',
              },
              keypadAnimatedStyle,
            ]}
          >
            {/* ── Keypad Drag Handle Bar (Slide down to dismiss) ── */}
            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
              hitSlop={{ top: 8, bottom: 12, left: 30, right: 30 }}
              onPress={hideKeypad}
              style={styles.keypadHandleBar}
              accessibilityLabel="Dismiss keypad"
              accessibilityRole="button"
            >
              <View style={[styles.keypadHandle, { backgroundColor: colors.border }]} />
            </PressableOpacity>

            <View style={styles.keypadGrid}>
              {KEYPAD_ROWS.map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((item) => (
                    <KeyButton key={item} item={item} onPress={handleKeyPress} />
                  ))}
                </View>
              ))}
            </View>
          </Reanimated.View>
        </GestureDetector>

        <Reanimated.View
          onLayout={(e) => {
            const w = e.nativeEvent.layout.width;
            if (w > 0 && !isMorphing && w !== buttonFullWidth) {
              setButtonFullWidth(w);
            }
          }}
          style={[
            {
              alignItems: 'center',
              width: '100%',
            },
            saveButtonWrapperStyle,
          ]}
        >
          <Reanimated.View
            style={[
              {
                height: buttonHeight,
                borderRadius: BorderRadius.pill,
                alignSelf: 'center',
                borderWidth: 1,
              },
              saveFillStyle,
              isButtonGreen ? styles.saveButtonEnabled : null,
              morphStyle,
            ]}
          >
            <Pressable
              accessibilityRole="button" accessibilityLabel="Save transaction" accessibilityState={{ disabled: isSubmitting || isMorphing, busy: isSubmitting }}
              disabled={isSubmitting || isMorphing}
              onPress={onSavePress}
              style={({ pressed }) => [
                styles.saveButton,
                {
                  width: '100%',
                  height: '100%',
                  backgroundColor: 'transparent',
                  opacity: pressed && !isMorphing ? 0.9 : 1,
                },
              ]}
            >
              {showTick ? (
                <Reanimated.View style={tickScaleStyle}>
                  <Check size={26} color={colors.forestGreen} strokeWidth={2.8} />
                </Reanimated.View>
              ) : isSubmitting && !isMorphing ? (
                <ActivityIndicator size="small" color={colors.forestGreen} />
              ) : (
                <Reanimated.Text
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                  style={[
                    styles.saveButtonText,
                    {
                      color: isDivisionByZero
                        ? colors.danger
                        : isButtonGreen
                        ? colors.forestGreen
                        : colors.textMuted,
                      fontFamily: FontFamily.bold,
                    },
                    textOpacityStyle,
                  ]}
                >
                  {saveLabel}
                </Reanimated.Text>
              )}
            </Pressable>
          </Reanimated.View>
        </Reanimated.View>
      </View>
    </KeyboardAvoidingView>
  );
};
