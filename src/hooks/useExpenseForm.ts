import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, parseISO } from 'date-fns';

import { RootStackParamList } from '../types';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { formatDate } from '../lib/formatters';
import { applyKeypadPress } from '../lib/amountKeypad';
import { getNoteSuggestions } from '../lib/noteSuggestions';

export const MAX_NOTE_WORDS = 50;
export const MAX_NOTE_CHARS = 250;

export const countWords = (text: string): number => {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
};

export interface UseExpenseFormParams {
  route: RouteProp<RootStackParamList, 'AddExpense' | 'EditExpense'>;
  navigation: NativeStackNavigationProp<RootStackParamList, 'AddExpense' | 'EditExpense'>;
}

export interface UseExpenseFormReturn {
  // Form Values
  amount: string;
  transactionType: 'expense' | 'income';
  selectedCategoryId: string | null;
  note: string;
  selectedDate: Date;
  formattedDate: string;
  paymentMode: 'cash' | 'upi' | 'card';

  // Form / UI Status
  isEdit: boolean;
  isSubmitting: boolean;
  isSaveEnabled: boolean;
  showDatePicker: boolean;

  // Category Store Status
  categories: Category[];
  isCategoriesLoading: boolean;
  areCategoriesPlaceholder: boolean;
  isCategoriesFetched: boolean;

  // Handlers
  handleTypeChange: (type: 'expense' | 'income') => void;
  handleKeyPress: (val: string) => void;
  handleCategorySelect: (id: string) => void;
  handleNoteChange: (text: string) => void;
  handleDateConfirm: (date: Date) => void;
  setShowDatePicker: (show: boolean) => void;
  setPaymentMode: (mode: 'cash' | 'upi' | 'card') => void;
  handleSave: () => Promise<void>;
  noteSuggestions: string[];
  handleSelectNoteSuggestion: (suggestion: string) => void;
}

export function useExpenseForm({ route, navigation }: UseExpenseFormParams): UseExpenseFormReturn {
  const isEdit = route.name === 'EditExpense';
  const expenseId = isEdit ? (route.params as { expenseId: string }).expenseId : undefined;

  const addExpense = useExpenseStore((s) => s.addExpense);
  const updateExpense = useExpenseStore((s) => s.updateExpense);
  const expenses = useExpenseStore((s) => s.expenses);

  const categories = useCategoryStore((s) => s.categories);
  const fetchCategories = useCategoryStore((s) => s.fetchCategories);
  const isCategoriesLoading = useCategoryStore((s) => s.loading);
  const isCategoriesFetched = useCategoryStore((s) => s.isFetched);

  const [transactionType, setTransactionType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'cash' | 'upi' | 'card'>('upi');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasPrefilled = useRef(false);

  const areCategoriesPlaceholder = !isCategoriesFetched || categories.some((c) => c.isPlaceholder);

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

  // ─── Note change handler ──────────────────────────────────────────────────
  const handleNoteChange = useCallback((text: string) => {
    const words = text.trim().split(/\s+/).filter(Boolean);
    if (words.length > MAX_NOTE_WORDS) {
      const clamped = text.split(/\s+/).slice(0, MAX_NOTE_WORDS).join(' ');
      setNote(clamped);
    } else {
      setNote(text);
    }
  }, []);

  // ─── Category select handler ──────────────────────────────────────────────
  const handleCategorySelect = useCallback((id: string) => {
    setSelectedCategoryId(id);
  }, []);

  // ─── Date confirm handler ─────────────────────────────────────────────────
  const handleDateConfirm = useCallback((date: Date) => {
    setSelectedDate(date);
  }, []);

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

  const noteSuggestions = useMemo(
    () => getNoteSuggestions(expenses, note, { currentCategoryId: selectedCategoryId, limit: 4 }),
    [expenses, note, selectedCategoryId]
  );

  const handleSelectNoteSuggestion = useCallback((suggestion: string) => {
    setNote(suggestion);
  }, []);

  const formattedDate = formatDate(selectedDate, true);
  const numAmount = parseFloat(amount || '0');
  const selectedCat = categories.find((c) => c.id === selectedCategoryId);
  const isCategorySelectedAndReal =
    transactionType === 'income' ||
    Boolean(selectedCategoryId !== null && selectedCat && !selectedCat.isPlaceholder);

  const isSaveEnabled =
    Boolean(numAmount > 0 && isCategorySelectedAndReal && !isSubmitting);

  return {
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
  };
}
