import React, { useState, useEffect, useRef } from 'react';
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
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyButton } from '../components/KeyButton';
import { formatDate } from '../lib/formatters';
import { getCategoryIcon } from '../lib/iconUtils';
import { useTheme } from '../store/themeStore';

type Props = NativeStackScreenProps<RootStackParamList, 'EditExpense'>;

export const EditExpenseScreen: React.FC<Props> = ({ route, navigation }) => {
  const { expenseId } = route.params;
  const { expenses, updateExpense } = useExpenseStore();
  const { categories, fetchCategories } = useCategoryStore();
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const scrollRef = useRef<ScrollView>(null);
  const noteInputRef = useRef<TextInput>(null);
  const noteSectionY = useRef(0);

  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('upi');
  const [isKeypadVisible, setIsKeypadVisible] = useState(true);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setIsKeypadVisible(false);
      setIsKeyboardOpen(true);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: Math.max(0, noteSectionY.current - 10), animated: true });
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

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const currentExpense = expenses.find((e) => e.id === expenseId);
    if (currentExpense) {
      setAmount(currentExpense.amount.toString());
      setSelectedCategoryId(currentExpense.category_id);
      setNote(currentExpense.note || '');
      setSelectedDate(new Date(currentExpense.expense_date));
      setPaymentMode(currentExpense.payment_mode);
    }
  }, [expenseId, expenses]);

  const handleKeyPress = (val: string) => {
    if (val === 'backspace') {
      setAmount(prev => prev.slice(0, -1));
    } else if (val === '.') {
      if (!amount.includes('.')) {
        setAmount(prev => (prev === '' ? '0.' : prev + '.'));
      }
    } else {
      if (amount === '0') {
        setAmount(val);
      } else {
        if (amount.includes('.')) {
          const decimals = amount.split('.')[1];
          if (decimals && decimals.length >= 2) return;
        }
        if (amount.length > 9) return;
        setAmount(prev => prev + val);
      }
    }
  };

  const handleSave = async () => {
    const numAmount = parseFloat(amount);
    if (numAmount > 0 && selectedCategoryId) {
      await updateExpense(
        expenseId,
        numAmount,
        selectedCategoryId,
        note,
        paymentMode,
        format(selectedDate, 'yyyy-MM-dd'),
      );
      navigation.goBack();
    }
  };

  const handleDateChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && date) {
      setSelectedDate(date);
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

      {/* 1. Fixed Header */}
      <View style={[styles.header, { marginTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <ArrowLeft size={24} color={colors.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: colors.textPrimary, fontFamily: 'Quicksand_700Bold' }]}>
          Edit Expense
        </Text>
      </View>

      {/* 2. Fixed Amount Display */}
      <Pressable 
        style={[styles.amountContainer, isKeyboardOpen && styles.amountContainerCompact]}
        onPress={() => {
          Keyboard.dismiss();
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setIsKeypadVisible(true);
          scrollRef.current?.scrollTo({ y: 0, animated: true });
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
        <View style={[styles.amountUnderline, { backgroundColor: colors.border }, isKeyboardOpen && styles.amountUnderlineCompact]} />
      </Pressable>

      {/* 3. Scrollable Middle Section */}
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
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
                      ? [styles.categoryChipSelected, { backgroundColor: colors.mintGreen, borderColor: colors.mintGreen }]
                      : [styles.categoryChipUnselected, { backgroundColor: colors.card, borderColor: colors.border }],
                  ]}
                >
                  <IconComp size={16} color={isSelected ? '#1A2B4C' : colors.textPrimary} />
                  <Text
                    style={[
                      styles.categoryChipText,
                      { color: isSelected ? '#1A2B4C' : colors.textPrimary },
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

        {/* Note Input */}
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
                  scrollRef.current?.scrollTo({ y: Math.max(0, noteSectionY.current - 10), animated: true });
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
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            themeVariant={isDark ? 'dark' : 'light'}
            onChange={handleDateChange}
          />
        )}

        {/* Paid Via Toggle */}
        <Text style={[styles.sectionLabel, { color: colors.textSecondary, fontFamily: 'Quicksand_700Bold' }]}>
          PAID VIA
        </Text>
        <View style={[styles.paymentToggleContainer, { backgroundColor: colors.inputBg }]}>
          <Pressable
            onPress={() => setPaymentMode('cash')}
            style={[
              styles.paymentToggleSegment,
              paymentMode === 'cash' && [styles.paymentToggleSegmentActive, { backgroundColor: colors.peachCoral }],
            ]}
          >
            <Wallet size={16} color={paymentMode === 'cash' ? '#1A2B4C' : colors.textSecondary} />
            <Text
              style={[
                styles.paymentToggleText,
                { color: paymentMode === 'cash' ? '#1A2B4C' : colors.textSecondary },
                { fontFamily: paymentMode === 'cash' ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
              ]}
            >
              Cash
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPaymentMode('upi')}
            style={[
              styles.paymentToggleSegment,
              paymentMode === 'upi' && [styles.paymentToggleSegmentActive, { backgroundColor: colors.peachCoral }],
            ]}
          >
            <CheckSquare size={16} color={paymentMode === 'upi' ? '#1A2B4C' : colors.textSecondary} />
            <Text
              style={[
                styles.paymentToggleText,
                { color: paymentMode === 'upi' ? '#1A2B4C' : colors.textSecondary },
                { fontFamily: paymentMode === 'upi' ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
              ]}
            >
              UPI
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPaymentMode('card')}
            style={[
              styles.paymentToggleSegment,
              paymentMode === 'card' && [styles.paymentToggleSegmentActive, { backgroundColor: colors.peachCoral }],
            ]}
          >
            <CreditCard size={16} color={paymentMode === 'card' ? '#1A2B4C' : colors.textSecondary} />
            <Text
              style={[
                styles.paymentToggleText,
                { color: paymentMode === 'card' ? '#1A2B4C' : colors.textSecondary },
                { fontFamily: paymentMode === 'card' ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
              ]}
            >
              Card
            </Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* 4. Fixed Bottom Section */}
      <View
        style={[
          styles.bottomSection,
          {
            backgroundColor: colors.background,
            paddingBottom: isKeyboardOpen
              ? 12
              : Math.max(insets.bottom, 16) + 12,
          },
        ]}
      >
        {isKeypadVisible && (
          <View style={[styles.keypadContainer, { backgroundColor: colors.cardSubtle }]}>
            <View style={styles.keypadGrid}>
              <View style={styles.keypadRow}>
                <KeyButton item="1" onPress={handleKeyPress} />
                <KeyButton item="2" onPress={handleKeyPress} />
                <KeyButton item="3" onPress={handleKeyPress} />
              </View>
              <View style={styles.keypadRow}>
                <KeyButton item="4" onPress={handleKeyPress} />
                <KeyButton item="5" onPress={handleKeyPress} />
                <KeyButton item="6" onPress={handleKeyPress} />
              </View>
              <View style={styles.keypadRow}>
                <KeyButton item="7" onPress={handleKeyPress} />
                <KeyButton item="8" onPress={handleKeyPress} />
                <KeyButton item="9" onPress={handleKeyPress} />
              </View>
              <View style={styles.keypadRow}>
                <KeyButton item="." onPress={handleKeyPress} />
                <KeyButton item="0" onPress={handleKeyPress} />
                <KeyButton item="backspace" onPress={handleKeyPress} />
              </View>
            </View>
          </View>
        )}

        <Pressable
          disabled={!isSaveEnabled}
          onPress={handleSave}
          style={[
            styles.saveButton,
            isKeyboardOpen && styles.saveButtonKeyboard,
            isSaveEnabled
              ? [styles.saveButtonEnabled, { backgroundColor: colors.mintGreen }]
              : [styles.saveButtonDisabled, { backgroundColor: colors.cardSubtle }],
          ]}
        >
          <Text
            style={[
              styles.saveButtonText,
              isSaveEnabled
                ? [styles.saveButtonTextEnabled, { color: '#1A2B4C' }]
                : [styles.saveButtonTextDisabled, { color: colors.textMuted }],
              { fontFamily: 'Quicksand_700Bold' },
            ]}
          >
            Update Expense
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
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 48,
    marginRight: 4,
  },
  amountValue: {
    fontSize: 60,
  },
  amountActive: {},
  amountInactive: {},
  amountUnderline: {
    height: 1,
    width: 80,
    marginTop: 8,
  },
  categoryContainer: {
    paddingHorizontal: 24,
    marginTop: 20,
  },
  categoryContainerCompact: {
    marginTop: 8,
  },
  scrollSection: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: 0,
  },
  scrollSectionCompact: {
    marginTop: 0,
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
  categoryChipSelected: {},
  categoryChipUnselected: {},
  categoryChipText: {
    fontSize: 14,
    marginLeft: 8,
  },
  inputContainer: {
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
  },
  inputText: {
    fontSize: 16,
    padding: 0,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
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
  },
  paymentToggleSegmentActive: {
    borderRadius: 9999,
  },
  paymentToggleText: {
    fontSize: 14,
    marginLeft: 8,
  },
  paymentToggleTextActive: {},
  paymentToggleTextInactive: {},
  bottomSection: {
    paddingHorizontal: 24,
  },
  keypadContainer: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginHorizontal: -24,
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 8,
    marginTop: 16,
  },
  keypadGrid: {
    flexDirection: 'column',
    gap: 12,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 12,
  },
  amountContainerCompact: {
    marginTop: 8,
  },
  currencySymbolCompact: {
    fontSize: 32,
  },
  amountValueCompact: {
    fontSize: 40,
  },
  amountUnderlineCompact: {
    marginTop: 4,
  },
  saveButton: {
    borderRadius: 9999,
    paddingVertical: 18,
    marginTop: 18,
    alignItems: 'center',
  },
  saveButtonKeyboard: {
    paddingVertical: 14,
    marginTop: 10,
  },
  saveButtonEnabled: {},
  saveButtonDisabled: {},
  saveButtonText: {
    fontSize: 18,
  },
  saveButtonTextEnabled: {},
  saveButtonTextDisabled: {},
});
