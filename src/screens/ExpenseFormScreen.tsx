import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  Platform, KeyboardAvoidingView, StyleSheet, Keyboard,
  LayoutAnimation,
} from 'react-native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft, Calendar, ChevronRight, Wallet, CheckSquare, CreditCard,
} from 'lucide-react-native';
import { CustomDatePickerModal } from '../components/CustomDatePickerModal';
import { format, parseISO } from 'date-fns';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyButton } from '../components/KeyButton';
import { formatDate } from '../lib/formatters';
import { getCategoryIcon } from '../lib/iconUtils';
import { useTheme } from '../store/themeStore';

// Both AddExpense and EditExpense routes use this single component.
type Props =
  | NativeStackScreenProps<RootStackParamList, 'AddExpense'>
  | NativeStackScreenProps<RootStackParamList, 'EditExpense'>;

const PAYMENT_OPTIONS = [
  { mode: 'cash' as const, label: 'Cash', Icon: Wallet },
  { mode: 'upi' as const, label: 'UPI', Icon: CheckSquare },
  { mode: 'card' as const, label: 'Card', Icon: CreditCard },
];

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
  // expenses is only read in edit mode to pre-fill the form
  const expenses = useExpenseStore((s) => s.expenses);
  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const scrollRef = useRef<ScrollView>(null);
  const noteInputRef = useRef<TextInput>(null);
  // Tracks the Y offset of the Note section inside the ScrollView so the
  // keyboard-show listener can scroll the note field into view (edit mode
  // needs this because the category list adds extra height above the note).
  const noteSectionY = useRef(0);

  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('upi');
  const [isKeypadVisible, setIsKeypadVisible] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  // ─── Keyboard listeners ───────────────────────────────────────────────────
  // Using requestAnimationFrame so the scroll fires AFTER the layout has
  // settled (matches EditExpenseScreen behaviour — more reliable on Android).
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsKeypadVisible(false);
      setIsKeyboardOpen(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, noteSectionY.current - 10),
          animated: true,
        });
      });
    });

    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsKeypadVisible(true);
      setIsKeyboardOpen(false);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      });
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ─── Fetch categories on mount ────────────────────────────────────────────
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // ─── Pre-fill form when editing an existing expense ───────────────────────
  useEffect(() => {
    if (!isEdit || !expenseId) return;
    const currentExpense = expenses.find((e) => e.id === expenseId);
    if (currentExpense) {
      setAmount(currentExpense.amount.toString());
      setSelectedCategoryId(currentExpense.category_id);
      setNote(currentExpense.note || '');
      setSelectedDate(parseISO(currentExpense.expense_date));
      setPaymentMode(currentExpense.payment_mode);
    }
  }, [isEdit, expenseId, expenses]);

  // ─── Keypad handler ───────────────────────────────────────────────────────
  const handleKeyPress = useCallback((val: string) => {
    if (val === 'backspace') {
      setAmount((prev) => prev.slice(0, -1));
    } else if (val === '.') {
      setAmount((prev) =>
        !prev.includes('.') ? (prev === '' ? '0.' : prev + '.') : prev
      );
    } else {
      setAmount((prev) => {
        if (prev === '0') return val;
        if (prev.includes('.') && prev.split('.')[1]?.length >= 2) return prev;
        if (prev.length > 9) return prev;
        return prev + val;
      });
    }
  }, []);

  // ─── Save / Update ────────────────────────────────────────────────────────
  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0 && selectedCategoryId) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      if (isEdit && expenseId) {
        await updateExpense(expenseId, numAmount, selectedCategoryId, note, paymentMode, dateStr);
      } else {
        await addExpense(numAmount, selectedCategoryId, note, paymentMode, dateStr);
      }
      navigation.goBack();
    }
  };

  const formattedDate = formatDate(selectedDate, true);
  const numAmount = parseFloat(amount || '0');
  const isSaveEnabled = numAmount > 0 && selectedCategoryId !== null;

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
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
          {isEdit ? 'Edit Expense' : 'Add Expense'}
        </Text>
      </View>

      {/* ── Amount Display ── */}
      <Pressable
        style={[styles.amountContainer, isKeyboardOpen && styles.amountContainerCompact]}
        onPress={() => {
          Keyboard.dismiss();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsKeypadVisible(true);
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ y: 0, animated: true });
          });
        }}
      >
        <View style={styles.amountRow}>
          <Text
            style={[
              styles.currencySymbol,
              { color: colors.textMuted },
              isKeyboardOpen && styles.currencySymbolCompact,
              { fontFamily: 'Quicksand_700Bold' },
            ]}
          >
            ₹
          </Text>
          <Text
            style={[
              styles.amountValue,
              isKeyboardOpen && styles.amountValueCompact,
              amount ? { color: colors.textPrimary } : { color: colors.textMuted },
              { fontFamily: 'Quicksand_700Bold' },
            ]}
          >
            {amount || '0'}
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
        {/* Category Selector */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>
          CATEGORY
        </Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="always"
          style={styles.categoryScroll}
        >
          <View style={styles.categoryList}>
            {categories.map((cat: Category) => {
              const isSelected = selectedCategoryId === cat.id;
              const IconComp = getCategoryIcon(cat.icon);
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCategoryId(cat.id)}
                  style={[
                    styles.categoryChip,
                    isSelected
                      ? { backgroundColor: colors.mintGreen, borderColor: colors.mintGreen }
                      : { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <IconComp size={16} color={isSelected ? colors.forestGreen : colors.textPrimary} />
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: isSelected ? colors.forestGreen : colors.textPrimary },
                      { fontFamily: 'Quicksand_700Bold' },
                    ]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Note Input — onLayout tracks Y for keyboard-scroll */}
        <View
          onLayout={(e) => {
            noteSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>
            NOTE (OPTIONAL)
          </Text>
          <Pressable
            style={[styles.inputContainer, { backgroundColor: colors.inputBg }]}
            onPress={() => noteInputRef.current?.focus()}
          >
            <TextInput
              ref={noteInputRef}
              value={note}
              onChangeText={setNote}
              placeholder="Add a note..."
              placeholderTextColor={colors.textMuted}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              style={[styles.inputText, { color: colors.textPrimary, fontFamily: 'Quicksand_500Medium' }]}
              returnKeyType="done"
              onSubmitEditing={() => Keyboard.dismiss()}
              onFocus={() => {
                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                setIsKeypadVisible(false);
                setIsKeyboardOpen(true);
                requestAnimationFrame(() => {
                  scrollRef.current?.scrollTo({
                    y: Math.max(0, noteSectionY.current - 10),
                    animated: true,
                  });
                });
              }}
            />
          </Pressable>
        </View>

        {/* Date Picker */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>
          DATE
        </Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={[styles.datePickerButton, { backgroundColor: colors.inputBg }]}
        >
          <View style={styles.datePickerLeft}>
            <Calendar size={18} color={colors.textSecondary} />
            <Text style={[styles.datePickerText, { color: colors.textPrimary, fontFamily: 'Quicksand_500Medium' }]}>
              {formattedDate}
            </Text>
          </View>
          <ChevronRight size={18} color={colors.textSecondary} />
        </Pressable>
        <CustomDatePickerModal
          visible={showDatePicker}
          value={selectedDate}
          onConfirm={(date) => setSelectedDate(date)}
          onClose={() => setShowDatePicker(false)}
        />

        {/* Paid Via Toggle */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>
          PAID VIA
        </Text>
        <View style={[styles.paymentToggleContainer, { backgroundColor: colors.inputBg }]}>
          {PAYMENT_OPTIONS.map(({ mode, label, Icon }) => {
            const isActive = paymentMode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setPaymentMode(mode)}
                style={[
                  styles.paymentToggleSegment,
                  isActive && { backgroundColor: colors.peachCoral },
                ]}
              >
                <Icon size={16} color={isActive ? colors.forestGreen : colors.textSecondary} />
                <Text
                  style={[
                    styles.paymentToggleText,
                    {
                      color: isActive ? colors.forestGreen : colors.textSecondary,
                      fontFamily: isActive ? 'Quicksand_700Bold' : 'Quicksand_500Medium',
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
          disabled={!isSaveEnabled}
          onPress={handleSave}
          style={({ pressed }) => [
            styles.saveButton,
            isKeyboardOpen && styles.saveButtonKeyboard,
            isSaveEnabled
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
          <Text
            style={[
              styles.saveButtonText,
              {
                color: isSaveEnabled ? colors.forestGreen : colors.textMuted,
                fontFamily: 'Quicksand_700Bold',
              },
            ]}
          >
            {isEdit ? 'Update Expense' : 'Save Expense'}
          </Text>
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
    paddingHorizontal: 24,
  },
  backButton: {
    position: 'absolute',
    left: 24,
  },
  headerTitle: {
    fontSize: 20,
  },
  amountContainer: {
    alignItems: 'center',
    marginTop: 24,
  },
  amountContainerCompact: {
    marginTop: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 48,
    marginRight: 4,
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
    marginTop: 8,
  },
  amountUnderlineCompact: {
    marginTop: 4,
  },
  scrollSection: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: 20,
  },
  sectionLabel: {
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 16,
    overflow: 'visible',
  },
  categoryList: {
    flexDirection: 'row',
    gap: 12,
    paddingRight: 24,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1,
  },
  categoryChipText: {
    fontSize: 14,
    marginLeft: 8,
  },
  inputContainer: {
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 16,
  },
  inputText: {
    fontSize: 16,
    padding: 0,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 9999,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 16,
  },
  datePickerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  datePickerText: {
    marginLeft: 12,
    fontSize: 16,
  },
  paymentToggleContainer: {
    flexDirection: 'row',
    borderRadius: 9999,
    padding: 6,
    marginBottom: 16,
  },
  paymentToggleSegment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 9999,
  },
  paymentToggleText: {
    fontSize: 14,
    marginLeft: 8,
  },
  bottomSection: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
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
    borderRadius: 9999,
    height: 60,
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
    fontSize: 18,
    letterSpacing: 0.3,
  },
});
