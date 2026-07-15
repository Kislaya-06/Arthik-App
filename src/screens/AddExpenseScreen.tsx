import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, ScrollView, Pressable,
  Platform, KeyboardAvoidingView, StyleSheet,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { StatusBar } from 'expo-status-bar';
import {
  ArrowLeft, Calendar, ChevronRight, Wallet, CheckSquare, CreditCard,
} from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyButton, KEY_WIDTH } from '../components/KeyButton';
import { formatDate } from '../lib/formatters';
import { getCategoryIcon } from '../lib/iconUtils';

type Props = NativeStackScreenProps<RootStackParamList, 'AddExpense'>;

export const AddExpenseScreen: React.FC<Props> = ({ navigation }) => {
  const { addExpense } = useExpenseStore();
  const { categories, fetchCategories } = useCategoryStore();
  const insets = useSafeAreaInsets();

  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('upi');

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

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
      await addExpense(
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
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="dark" />

      {/* 1. Fixed Header */}
      <View style={[styles.header, { marginTop: insets.top + 16 }]}>
        <Pressable
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          hitSlop={10}
        >
          <ArrowLeft size={24} color="#1A2B4C" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: 'Quicksand_700Bold' }]}>
          Add Expense
        </Text>
      </View>

      {/* 2. Fixed Amount Display */}
      <View style={styles.amountContainer}>
        <View style={styles.amountRow}>
          <Text style={[styles.currencySymbol, { fontFamily: 'Quicksand_700Bold' }]}>₹</Text>
          <Text
            style={[
              styles.amountValue,
              amount ? styles.amountActive : styles.amountInactive,
              { fontFamily: 'Quicksand_700Bold' },
            ]}
          >
            {amount || '0'}
          </Text>
        </View>
        <View style={styles.amountUnderline} />
      </View>

      {/* 3. Scrollable Middle Section */}
      <ScrollView style={styles.scrollSection} showsVerticalScrollIndicator={false}>

        {/* Category Selector */}
        <Text style={[styles.sectionLabel, { fontFamily: 'Quicksand_700Bold' }]}>
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
                    isSelected ? styles.categoryChipSelected : styles.categoryChipUnselected,
                  ]}
                >
                  <IconComp size={16} color="#1A2B4C" />
                  <Text
                    style={[styles.categoryChipText, { fontFamily: 'Quicksand_700Bold' }]}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        {/* Note Input */}
        <Text style={[styles.sectionLabel, { fontFamily: 'Quicksand_700Bold' }]}>
          NOTE (OPTIONAL)
        </Text>
        <View style={styles.inputContainer}>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Add a note..."
            placeholderTextColor="#A8ADBD"
            style={[styles.inputText, { fontFamily: 'Quicksand_500Medium' }]}
          />
        </View>

        {/* Date Picker */}
        <Text style={[styles.sectionLabel, { fontFamily: 'Quicksand_700Bold' }]}>
          DATE
        </Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={styles.datePickerButton}
        >
          <View style={styles.datePickerLeft}>
            <Calendar size={18} color="#8A8FA3" />
            <Text style={[styles.datePickerText, { fontFamily: 'Quicksand_500Medium' }]}>
              {formattedDate}
            </Text>
          </View>
          <ChevronRight size={18} color="#8A8FA3" />
        </Pressable>
        {showDatePicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={handleDateChange}
          />
        )}

        {/* Paid Via Toggle */}
        <Text style={[styles.sectionLabel, { fontFamily: 'Quicksand_700Bold' }]}>
          PAID VIA
        </Text>
        <View style={styles.paymentToggleContainer}>
          <Pressable
            onPress={() => setPaymentMode('cash')}
            style={[styles.paymentToggleSegment, paymentMode === 'cash' && styles.paymentToggleSegmentActive]}
          >
            <Wallet size={16} color={paymentMode === 'cash' ? '#1A2B4C' : '#8A8FA3'} />
            <Text
              style={[
                styles.paymentToggleText,
                paymentMode === 'cash' ? styles.paymentToggleTextActive : styles.paymentToggleTextInactive,
                { fontFamily: paymentMode === 'cash' ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
              ]}
            >
              Cash
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPaymentMode('upi')}
            style={[styles.paymentToggleSegment, paymentMode === 'upi' && styles.paymentToggleSegmentActive]}
          >
            <CheckSquare size={16} color={paymentMode === 'upi' ? '#1A2B4C' : '#8A8FA3'} />
            <Text
              style={[
                styles.paymentToggleText,
                paymentMode === 'upi' ? styles.paymentToggleTextActive : styles.paymentToggleTextInactive,
                { fontFamily: paymentMode === 'upi' ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
              ]}
            >
              UPI
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPaymentMode('card')}
            style={[styles.paymentToggleSegment, paymentMode === 'card' && styles.paymentToggleSegmentActive]}
          >
            <CreditCard size={16} color={paymentMode === 'card' ? '#1A2B4C' : '#8A8FA3'} />
            <Text
              style={[
                styles.paymentToggleText,
                paymentMode === 'card' ? styles.paymentToggleTextActive : styles.paymentToggleTextInactive,
                { fontFamily: paymentMode === 'card' ? 'Quicksand_700Bold' : 'Quicksand_500Medium' },
              ]}
            >
              Card
            </Text>
          </Pressable>
        </View>

      </ScrollView>

      {/* 4. Fixed Bottom Section */}
      <View style={styles.bottomSection}>
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

        <Pressable
          disabled={!isSaveEnabled}
          onPress={handleSave}
          style={[styles.saveButton, isSaveEnabled ? styles.saveButtonEnabled : styles.saveButtonDisabled]}
        >
          <Text
            style={[
              styles.saveButtonText,
              isSaveEnabled ? styles.saveButtonTextEnabled : styles.saveButtonTextDisabled,
              { fontFamily: 'Quicksand_700Bold' },
            ]}
          >
            Save Expense
          </Text>
        </Pressable>
      </View>

    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
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
    color: '#1A2B4C',
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
    fontSize: 24,
    color: '#B0B4C0',
    marginRight: 4,
  },
  amountValue: {
    fontSize: 60,
  },
  amountActive: {
    color: '#1A2B4C',
  },
  amountInactive: {
    color: '#B0B4C0',
  },
  amountUnderline: {
    height: 1,
    width: 80,
    backgroundColor: '#D8DCE3',
    marginTop: 8,
  },
  scrollSection: {
    flex: 1,
    paddingHorizontal: 24,
    marginTop: 24,
  },
  sectionLabel: {
    fontSize: 12,
    color: '#8A8FA3',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  categoryScroll: {
    flexDirection: 'row',
    marginBottom: 24,
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
  categoryChipSelected: {
    backgroundColor: '#B8E0C8',
    borderColor: '#B8E0C8',
  },
  categoryChipUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E0E2E8',
  },
  categoryChipText: {
    fontSize: 14,
    marginLeft: 8,
    color: '#1A2B4C',
  },
  inputContainer: {
    backgroundColor: '#F1F2F5',
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 24,
  },
  inputText: {
    fontSize: 16,
    color: '#1A2B4C',
    padding: 0,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F1F2F5',
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
    color: '#1A2B4C',
  },
  paymentToggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F2F5',
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
    backgroundColor: '#F4B8AE',
    borderRadius: 9999,
  },
  paymentToggleText: {
    fontSize: 14,
    marginLeft: 8,
  },
  paymentToggleTextActive: {
    color: '#1A2B4C',
  },
  paymentToggleTextInactive: {
    color: '#8A8FA3',
  },
  bottomSection: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    backgroundColor: '#FFFFFF',
  },
  keypadGrid: {
    flexDirection: 'column',
    gap: 12,
    marginTop: 8,
  },
  keypadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  saveButton: {
    borderRadius: 9999,
    paddingVertical: 20,
    marginTop: 24,
    alignItems: 'center',
  },
  saveButtonEnabled: {
    backgroundColor: '#B8E0C8',
  },
  saveButtonDisabled: {
    backgroundColor: '#E5E7ED',
  },
  saveButtonText: {
    fontSize: 18,
  },
  saveButtonTextEnabled: {
    color: '#1A2B4C',
  },
  saveButtonTextDisabled: {
    color: '#A8ADBD',
  },
});
