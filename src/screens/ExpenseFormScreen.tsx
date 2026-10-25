import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  Platform, KeyboardAvoidingView, StyleSheet, Keyboard,
  ActivityIndicator, Animated, Easing, useAnimatedValue,
} from 'react-native';
import Reanimated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Easing as REasing,
  Extrapolation,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import { AmbientBackground } from '../components/AmbientBackground';
import ArrowLeft from 'lucide-react-native/icons/arrow-left';
import Calendar from 'lucide-react-native/icons/calendar';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
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
import { formatAmountWithCommas } from '../lib/formatters';
import { getCategoryIcon } from '../lib/iconUtils';
import { getCategoryChipGradient } from '../lib/colorUtils';
import { useTheme } from '../store/themeStore';
import { useAuthStore } from '../store/authStore';
import { useFormKeyboard } from '../hooks/useFormKeyboard';
import {
  useExpenseForm,
  MAX_NOTE_WORDS,
  MAX_NOTE_CHARS,
  countWords,
} from '../hooks/useExpenseForm';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight, LineHeight } from '../config/theme';

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

// ─── Animated Category Chip ─────────────────────────────────────────────────
const CategoryChipItem = React.memo<{
  category: Category;
  isSelected: boolean;
  isPlaceholder: boolean;
  onSelect: (id: string) => void;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}>(({ category, isSelected, isPlaceholder, onSelect, colors, isDark }) => {
  const scale = useAnimatedValue(1);
  const isFirstMount = useRef(true);
  const IconComp = getCategoryIcon(category.icon);

  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      return;
    }
    if (isSelected) {
      Animated.sequence([
        Animated.timing(scale, { toValue: 0.96, duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(scale, { toValue: 1, tension: 120, friction: 10, useNativeDriver: true }),
      ]).start();
    }
  }, [isSelected, scale]);

  const chipColor = category.color || colors.mintGreen;

  const { startColor, midColor, endColor, contentColor } = useMemo(() => {
    if (!isSelected) {
      return {
        startColor: '',
        midColor: '',
        endColor: '',
        contentColor: colors.textPrimary,
      };
    }
    return getCategoryChipGradient(chipColor, isDark);
  }, [chipColor, isSelected, isDark, colors.textPrimary]);

  const gradId = `chip_grad_${(category.id || 'default').replace(/[^a-zA-Z0-9]/g, '')}`;

  const handlePress = useCallback(() => {
    if (!isPlaceholder) onSelect(category.id);
  }, [isPlaceholder, onSelect, category.id]);

  return (
    <Pressable
      disabled={isPlaceholder}
      onPress={handlePress}
    >
      <Animated.View
        style={[
          styles.categoryChip,
          isSelected
            ? { backgroundColor: midColor, borderColor: midColor }
            : { backgroundColor: colors.card, borderColor: colors.border },
          isPlaceholder && { opacity: 0.45 },
          { transform: [{ scale }] },
        ]}
      >
        {isSelected && (
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id={gradId} x1="10%" y1="0%" x2="90%" y2="100%">
                <Stop offset="0%" stopColor={startColor} />
                <Stop offset="50%" stopColor={midColor} />
                <Stop offset="100%" stopColor={endColor} />
              </LinearGradient>
            </Defs>
            <Rect
              x={0}
              y={0}
              width="100%"
              height="100%"
              rx={20}
              ry={20}
              fill={`url(#${gradId})`}
            />
          </Svg>
        )}
        <IconComp
          size={16}
          color={contentColor}
          strokeWidth={isSelected ? 2.2 : 2.0}
        />
        <Text
          numberOfLines={1}
          ellipsizeMode="tail"
          style={[
            styles.categoryChipText,
            { color: contentColor, fontFamily: FontFamily.bold },
          ]}
        >
          {category.name}
        </Text>
      </Animated.View>
    </Pressable>
  );
});

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
    handleNoteLayout,
    handleNoteFocus,
    handleNoteBlur,
    handleSplitLayout,
    handleSplitFocus,
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

  const onTypeChange = useCallback(
    (type: 'expense' | 'income') => {
      handleTypeChange(type);
      showKeypad();
    },
    [handleTypeChange, showKeypad]
  );

  // Animation: Error shake on invalid save (amount scale punch removed for instant typing)
  const amountShake = useAnimatedValue(0);

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
  const buttonHeight = isKeyboardOpen ? 50 : ControlHeight.cta;

  const isButtonGreen = isSaveEnabled || isSubmitting || isMorphing || showTick;

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
      <AmbientBackground />
      <StatusBar style={isDark ? 'light' : 'dark'} />

      {/* ── Header ── */}
      <View style={[styles.header, { marginTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          disabled={isSubmitting || isMorphing}
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
          </Animated.View>
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
        contentContainerStyle={[
          styles.scrollContent,
          isKeyboardOpen && { paddingBottom: 280 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
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
                <Pressable
                  style={[styles.createCategoryBtn, { backgroundColor: colors.mintGreen }]}
                  onPress={() => (navigation as any).navigate('AddEditCategory', { kind: transactionType })}
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
          expenseAmount={shortfallAmount > 0 ? shortfallAmount : evaluatedAmount}
          onAddMoneyAndSave={handleSaveWithIncome}
          onAddIncomeFirst={() => {
            setShowVaultGuard(false);
            onTypeChange('income');
          }}
          isBudgetMode={isBudgetModeEnabled}
          totalVaultLiquidity={vaultLiquidity.totalVaultLiquidity}
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

        {/* Split with someone (expenses) / what kind of money came in (income) */}
        <View style={styles.formSectionPadding} onLayout={handleSplitLayout}>
          <SplitExtras split={split} onFieldFocus={handleSplitFocus} />
          <MoneyBackExtras moneyBack={moneyBack} amount={evaluatedAmount} onFieldFocus={handleSplitFocus} />
        </View>

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

        {/* Self-transfer (new transactions only) */}
        {!isEdit && (
          <View style={styles.formSectionPadding}>
            <TransferExtras
              isSelfTransfer={isSelfTransfer}
              onToggleSelfTransfer={toggleSelfTransfer}
              rememberMode={rememberMode}
              onRememberMode={setRememberMode}
              canRemember={canRememberTransfer}
              ruleMatched={transferRuleMatched}
            />
          </View>
        )}
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
                backgroundColor: isButtonGreen ? colors.mintGreen : colors.cardSubtle,
                borderColor: !isButtonGreen && isDivisionByZero ? colors.danger : (!isButtonGreen ? colors.borderSubtle : 'transparent'),
                borderWidth: !isButtonGreen ? 1 : 0,
              },
              isButtonGreen ? styles.saveButtonEnabled : null,
              morphStyle,
            ]}
          >
            <Pressable
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
                isKeyboardOpen && styles.saveButtonKeyboard,
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
                  {isDivisionByZero
                    ? 'Cannot divide by 0'
                    : isEdit
                    ? (transactionType === 'income' ? 'Update Transaction' : 'Update Expense')
                    : (transactionType === 'income' ? 'Save Transaction' : 'Save Expense')}
                </Reanimated.Text>
              )}
            </Pressable>
          </Reanimated.View>
        </Reanimated.View>
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
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
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
    minHeight: 44,
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
    overflow: 'hidden',
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
  backdatedNoticeCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: Spacing.surface,
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    marginHorizontal: Spacing.gutter,
    marginTop: -Spacing.element,
    marginBottom: Spacing.block,
  },
  backdatedNoticeLeftIcon: {
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdatedNoticeTextWrap: {
    flex: 1,
  },
  backdatedNoticeTitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    marginBottom: 2,
  },
  backdatedNoticeDesc: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
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
    fontSize: FontSize.body,
    lineHeight: LineHeight.body,
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
