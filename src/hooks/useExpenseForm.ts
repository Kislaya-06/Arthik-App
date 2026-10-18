import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Alert } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, parseISO } from 'date-fns';

import { RootStackParamList, VaultLiquidityInfo } from '../types';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { formatDate } from '../lib/formatters';
import {
  applyKeypadPress,
  evaluateExpression,
  formatExpressionWithCommas,
} from '../lib/amountKeypad';
import { getNoteSuggestions } from '../lib/noteSuggestions';
import { calculateVaultLiquidity } from '../lib/vaultSpendingGuard';
import * as Crypto from 'expo-crypto';
import { isCountedIncome, isCountedExpense } from '../lib/transactionUtils';
import { useTransferRulesStore } from '../store/transferRulesStore';
import { findMatchingTransferRule, normalizeTransferDescriptor } from '../lib/transferRules';
import {
  buildPeopleLedger,
  cleanPersonName,
  validateSplitAllocations,
  planSettlement,
  planRefund,
  refundCandidates,
  minAmountForExpense,
  minShareForExpense,
  settledPersonsForExpense,
  grossAmountOf,
  personKey,
  type PersonLedger,
  type RefundCandidate,
  type RecoveryPlan,
} from '../lib/splitLedger';
import { recordMoneyBack } from '../store/expense/moneyBack';
import { round2 } from '../lib/formatters';

let memberIdCounter = 0;
const nextMemberId = () => `mem_${Date.now()}_${++memberIdCounter}`;

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
  evaluatedAmount: number;
  formattedExpression: string;
  hasOperator: boolean;
  isDivisionByZero: boolean;
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
  showVaultGuard: boolean;
  setShowVaultGuard: (show: boolean) => void;
  vaultLiquidity: VaultLiquidityInfo;
  isBudgetModeEnabled: boolean;

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
  handleSave: (onSuccess?: () => Promise<void> | void) => Promise<void>;
  handleSaveWithIncome: (addedAmount: number, addedPaymentMode?: 'cash' | 'upi') => Promise<void>;
  noteSuggestions: string[];
  handleSelectNoteSuggestion: (suggestion: string) => void;

  // Self-transfer (TXN-003)
  isSelfTransfer: boolean;
  toggleSelfTransfer: (on: boolean) => void;
  rememberMode: 'always' | 'once';
  setRememberMode: (m: 'always' | 'once') => void;
  canRememberTransfer: boolean;
  transferRuleMatched: boolean;

  // Split expense (SPL-001) and money back (SPL-003 / SPL-004 / SPL-006)
  split: SplitFormState;
  moneyBack: MoneyBackFormState;
}

export interface SplitMemberState {
  id?: string;
  person: string;
  shareText: string;
  share: number;
}

export interface SplitFormState {
  /** Shown for new and edited expenses (not income, not self-transfers). */
  visible: boolean;
  on: boolean;
  members: SplitMemberState[];
  totalShare: number;
  /** The user's own part: amount minus total shared. */
  myShare: number;
  /** Names used before, newest first. */
  knownNames: string[];
  /** Error to show under the fields, or null. */
  error: string | null;
  setOn: (on: boolean) => void;
  addMember: (name?: string) => void;
  removeMember: (index: number) => void;
  updateMemberName: (index: number, name: string) => void;
  updateMemberShareText: (index: number, text: string) => void;
  splitEqually: () => void;
  person: string;
  /** What the user typed for the other person's share (first person). */
  shareText: string;
  share: number;
  setPerson: (name: string) => void;
  setShareText: (text: string) => void;
  /** Fill the share with half of the amount. */
  splitHalf: () => void;
}

export type MoneyBackMode = 'income' | 'friend' | 'refund';

export interface MoneyBackFormState {
  /** Shown only when adding new income. */
  visible: boolean;
  mode: MoneyBackMode;
  setMode: (mode: MoneyBackMode) => void;
  /** People who still owe money, for the "friend paid back" chips. */
  people: PersonLedger[];
  person: string;
  setPerson: (name: string) => void;
  /** Refund: who paid it back (shop / company). */
  refundWho: string;
  setRefundWho: (who: string) => void;
  refundExpenseId: string | null;
  setRefundExpenseId: (id: string | null) => void;
  /** Solution 2: Interactive recipient choice ('everyone' | 'user' | person name). */
  refundTarget: string;
  setRefundTarget: (target: string) => void;
  refundOptions: RefundCandidate[];
  /** What will happen with the typed amount (live). */
  plan: RecoveryPlan | null;
  /** Error to show, or null. */
  error: string | null;
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
  const [showVaultGuard, setShowVaultGuard] = useState(false);

  const [splitOn, setSplitOn] = useState(false);
  const [splitMembers, setSplitMembers] = useState<SplitMemberState[]>([
    { id: nextMemberId(), person: '', shareText: '', share: 0 },
  ]);
  const [moneyBackMode, setMoneyBackMode] = useState<MoneyBackMode>('income');
  const [moneyBackPerson, setMoneyBackPerson] = useState('');
  const [refundWho, setRefundWho] = useState('');
  const [refundExpenseId, setRefundExpenseId] = useState<string | null>(null);
  const [refundTarget, setRefundTarget] = useState<string>('everyone');

  const [isSelfTransfer, setIsSelfTransfer] = useState(false);
  const [rememberMode, setRememberMode] = useState<'always' | 'once'>('once');
  const selfTransferTouched = useRef(false);

  const transferRules = useTransferRulesStore((s) => s.rules);
  const fetchTransferRules = useTransferRulesStore((s) => s.fetchAll);

  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const weeklyBudgetAmount = useDailyBudgetStore((s) => s.weeklyBudgetAmount);
  const monthlyBudgetAmount = useDailyBudgetStore((s) => s.monthlyBudgetAmount);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const gullakDeposits = useDailyBudgetStore((s) => s.gullakDeposits);

  const catMap = useMemo(() => {
    const map: Record<string, Category> = {};
    for (let i = 0; i < categories.length; i++) {
      map[categories[i].id] = categories[i];
    }
    return map;
  }, [categories]);

  const { totalIncome, totalExpenses } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const cat = e.category_id ? catMap[e.category_id] : undefined;
      const amt = Number(e.amount) || 0;
      if (isCountedIncome(e, cat)) {
        inc += amt;
      } else if (isCountedExpense(e, cat)) {
        exp += amt;
      }
    }
    return { totalIncome: inc, totalExpenses: exp };
  }, [expenses, catMap]);

  // Only EXTERNAL deposits are new money. "From income" deposits just move income into Gullak (already counted).
  const externalGullakSum = useMemo(() => {
    let sum = 0;
    for (let i = 0; i < gullakDeposits.length; i++) {
      if (gullakDeposits[i].source === 'income') continue;
      sum += Number(gullakDeposits[i].amount) || 0;
    }
    return sum;
  }, [gullakDeposits]);

  const getTotalAccountRemaining = useDailyBudgetStore((s) => s.getTotalAccountRemaining);
  const dailyRecordsForGuard = useDailyBudgetStore((s) => s.dailyRecords);
  const budgetPeriodsForGuard = useDailyBudgetStore((s) => s.budgetPeriods);
  const planChangesForGuard = useDailyBudgetStore((s) => s.planChanges);
  const accountRemaining = useMemo(
    () => (typeof getTotalAccountRemaining === 'function' ? getTotalAccountRemaining() : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isBudgetModeEnabled, getTotalAccountRemaining, expenses, gullakDeposits, dailyRecordsForGuard, budgetPeriodsForGuard, planChangesForGuard]
  );

  const vaultLiquidity = useMemo(
    () =>
      calculateVaultLiquidity({
        isBudgetModeEnabled,
        budgetCadence,
        dailyBudgetAmount,
        weeklyBudgetAmount,
        monthlyBudgetAmount,
        totalIncome,
        totalExpenses,
        externalGullakDeposits: externalGullakSum,
        isAutoRenew,
        accountRemaining,
      }),
    [
      isBudgetModeEnabled,
      budgetCadence,
      dailyBudgetAmount,
      weeklyBudgetAmount,
      monthlyBudgetAmount,
      totalIncome,
      totalExpenses,
      externalGullakSum,
      accountRemaining,
      isAutoRenew,
    ]
  );

  const hasPrefilled = useRef(false);

  const areCategoriesPlaceholder = !isCategoriesFetched || categories.some((c) => c.isPlaceholder);

  // ─── Fetch categories on mount & on focus (e.g. returning from AddEditCategory) ───
  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    if (!isEdit) fetchTransferRules();
  }, [isEdit, fetchTransferRules]);

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
      // The form always edits the amount PAID; the store's `amount` is the counted amount (SPL-003).
      setAmount(grossAmountOf(currentExpense).toString());
      if (currentExpense.split_allocations && currentExpense.split_allocations.length > 0) {
        setSplitOn(true);
        setSplitMembers(
          currentExpense.split_allocations.map((a) => ({
            id: nextMemberId(),
            person: a.person,
            shareText: String(a.amount),
            share: Number(a.amount),
          }))
        );
      } else if (currentExpense.split_person && Number(currentExpense.split_amount) > 0) {
        setSplitOn(true);
        setSplitMembers([
          {
            id: nextMemberId(),
            person: currentExpense.split_person,
            shareText: String(currentExpense.split_amount),
            share: Number(currentExpense.split_amount),
          },
        ]);
      }
      if ((route.params as { splitOn?: boolean } | undefined)?.splitOn) setSplitOn(true);
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
      if (isEdit && expenseId && type !== transactionType) {
        const minAmount = minAmountForExpense(expenses, expenseId);
        if (minAmount > 0) {
          Alert.alert(
            'Cannot Change Type',
            'Money that came back is linked to this expense. Delete that money-back entry first.'
          );
          return;
        }
      }
      setTransactionType(type);
      // Auto-fallback: Card is excluded in Add Money mode
      if (type === 'income' && paymentMode === 'card') {
        setPaymentMode('upi');
      }
    },
    [isEdit, expenseId, transactionType, expenses, paymentMode]
  );

  // ─── Calculator / Expression evaluation ────────────────────────────────────
  const {
    result: evaluatedAmount,
    isDivisionByZero,
    hasOperator,
    hasCalculation,
    cleanExpression,
  } = useMemo(() => evaluateExpression(amount), [amount]);

  const formattedExpression = useMemo(() => formatExpressionWithCommas(amount), [amount]);

  // ─── Self-transfer: remembered rule suggestion (visible + reversible) ───
  const matchedRule = useMemo(() => findMatchingTransferRule(transferRules, note), [transferRules, note]);
  useEffect(() => {
    if (isEdit || selfTransferTouched.current) return;
    setIsSelfTransfer(!!matchedRule);
  }, [matchedRule, isEdit]);

  const canRememberTransfer = !!normalizeTransferDescriptor(note);

  const toggleSelfTransfer = useCallback((on: boolean) => {
    selfTransferTouched.current = true;
    setIsSelfTransfer(on);
  }, []);

  // ─── Split expense (SPL-001) ──────────────────────────────────────────────
  const people = useMemo(() => buildPeopleLedger(expenses), [expenses]);
  const knownNames = useMemo(() => people.map((p) => p.name), [people]);

  const addMember = useCallback(
    (name?: string) => {
      setSplitMembers((prev) => {
        if (prev.length === 1 && !prev[0].person.trim()) {
          return [{ id: prev[0].id || nextMemberId(), person: name || '', shareText: prev[0].shareText, share: prev[0].share }];
        }
        const next = [...prev, { id: nextMemberId(), person: name || '', shareText: '', share: 0 }];
        if (evaluatedAmount > 0) {
          const prevCount = prev.length + 1;
          const prevEqualShare = round2(evaluatedAmount / prevCount);
          const wasAutoEqual = prev.every((m) => m.share === prevEqualShare);
          if (wasAutoEqual) {
            const count = next.length + 1;
            const equalShare = round2(evaluatedAmount / count);
            return next.map((m) => ({
              ...m,
              share: equalShare,
              shareText: String(equalShare),
            }));
          }
        }
        return next;
      });
    },
    [evaluatedAmount]
  );

  const removeMember = useCallback((index: number) => {
    if (isEdit && expenseId) {
      const target = splitMembers[index];
      if (target?.person) {
        const minShare = minShareForExpense(expenses, expenseId, target.person);
        if (minShare > 0) {
          Alert.alert(
            'Cannot Remove Person',
            `${target.person} has already paid back ₹${minShare} for this expense. Delete that money-back entry first if you want to remove them.`
          );
          return;
        }
      }
    }
    setSplitMembers((prev) => {
      if (prev.length <= 1) {
        return [{ id: nextMemberId(), person: '', shareText: '', share: 0 }];
      }
      return prev.filter((_, i) => i !== index);
    });
  }, [isEdit, expenseId, expenses, splitMembers]);

  const updateMemberName = useCallback((index: number, name: string) => {
    setSplitMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, person: name } : m))
    );
  }, []);

  const updateMemberShareText = useCallback((index: number, text: string) => {
    const clean = text.replace(/[^0-9.]/g, '');
    const n = parseFloat(clean);
    const num = Number.isFinite(n) ? round2(n) : 0;
    setSplitMembers((prev) =>
      prev.map((m, i) => (i === index ? { ...m, shareText: clean, share: num } : m))
    );
  }, []);

  const splitEqually = useCallback(() => {
    if (evaluatedAmount <= 0) return;
    setSplitMembers((prev) => {
      const count = prev.length + 1;
      const equalShare = round2(evaluatedAmount / count);
      return prev.map((m) => ({
        ...m,
        share: equalShare,
        shareText: String(equalShare),
      }));
    });
  }, [evaluatedAmount]);

  const handleSplitOn = useCallback((on: boolean) => {
    if (!on && isEdit && expenseId) {
      const minShare = minShareForExpense(expenses, expenseId);
      if (minShare > 0) {
        Alert.alert(
          'Cannot Remove Split',
          `Money that came back (₹${minShare}) is linked to this split. Delete that money-back entry first if you want to remove the split.`
        );
        return;
      }
    }
    setSplitOn(on);
    if (!on) {
      setSplitMembers([{ id: nextMemberId(), person: '', shareText: '', share: 0 }]);
    }
  }, [isEdit, expenseId, expenses]);

  const totalShare = useMemo(
    () => round2(splitMembers.reduce((sum, m) => sum + m.share, 0)),
    [splitMembers]
  );

  const splitVisible = transactionType === 'expense' && !isSelfTransfer;
  const splitActive = splitVisible && splitOn;

  const splitError = useMemo(() => {
    if (!splitActive) return null;
    const hasAnyInput = splitMembers.some((m) => m.person.trim() || m.shareText.trim());
    if (!hasAnyInput) return null;
    const allocations = splitMembers.map((m) => ({
      person: m.person,
      amount: m.share,
    }));
    const base = validateSplitAllocations(evaluatedAmount, allocations);
    if (base) return evaluatedAmount > 0 ? base : null;
    if (isEdit && expenseId) {
      const minAmount = minAmountForExpense(expenses, expenseId);
      if (minAmount > 0 && evaluatedAmount < minAmount) {
        return `Amount cannot be less than ₹${minAmount} that already came back.`;
      }
      const settledPeople = settledPersonsForExpense(expenses, expenseId);
      for (const p of settledPeople) {
        const member = splitMembers.find((m) => personKey(m.person) === p.key);
        if (!member) {
          return `${p.name} has already paid back ₹${p.amount} and cannot be removed.`;
        }
        if (member.share < p.amount) {
          return `${p.name}'s share cannot be less than ₹${p.amount} they already paid back.`;
        }
      }
      const minShare = minShareForExpense(expenses, expenseId);
      if (minShare > 0 && totalShare < minShare) {
        return `Their share cannot be less than ₹${minShare} they already paid back.`;
      }
    }
    return null;
  }, [splitActive, splitMembers, totalShare, evaluatedAmount, isEdit, expenseId, expenses]);

  const split: SplitFormState = {
    visible: splitVisible,
    on: splitActive,
    members: splitMembers,
    totalShare,
    myShare: round2(Math.max(0, evaluatedAmount - totalShare)),
    knownNames,
    error: splitError,
    setOn: handleSplitOn,
    addMember,
    removeMember,
    updateMemberName,
    updateMemberShareText,
    splitEqually,
    person: splitMembers[0]?.person || '',
    shareText: splitMembers[0]?.shareText || '',
    share: totalShare,
    setPerson: (name) => updateMemberName(0, name),
    setShareText: (text) => updateMemberShareText(0, text),
    splitHalf: splitEqually,
  };

  // ─── Money back (SPL-003 / SPL-004 / SPL-006) ─────────────────────────────
  const moneyBackVisible = transactionType === 'income' && !isEdit;
  const openPeople = useMemo(() => people.filter((p) => p.owed > 0), [people]);
  const refundOptions = useMemo(() => refundCandidates(expenses), [expenses]);
  const handleSetRefundExpenseId = useCallback((id: string | null) => {
    setRefundExpenseId(id);
    setRefundTarget('everyone');
  }, []);

  const moneyBackPlan = useMemo<RecoveryPlan | null>(() => {
    if (!moneyBackVisible || evaluatedAmount <= 0) return null;
    if (moneyBackMode === 'friend') return planSettlement(expenses, moneyBackPerson, evaluatedAmount);
    if (moneyBackMode === 'refund' && refundExpenseId)
      return planRefund(expenses, refundExpenseId, evaluatedAmount, refundTarget);
    return null;
  }, [moneyBackVisible, moneyBackMode, moneyBackPerson, refundExpenseId, evaluatedAmount, expenses, refundTarget]);
  const moneyBackError =
    moneyBackVisible && moneyBackMode === 'friend' && moneyBackPerson && moneyBackPlan && moneyBackPlan.allocated <= 0
      ? 'This person does not owe anything.'
      : null;

  const moneyBack: MoneyBackFormState = {
    visible: moneyBackVisible,
    mode: moneyBackMode,
    setMode: setMoneyBackMode,
    people: openPeople,
    person: moneyBackPerson,
    setPerson: setMoneyBackPerson,
    refundWho,
    setRefundWho,
    refundExpenseId,
    setRefundExpenseId: handleSetRefundExpenseId,
    refundTarget,
    setRefundTarget,
    refundOptions,
    plan: moneyBackPlan,
    error: moneyBackError,
  };

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

  // ─── Auto-select first real category for new expenses ────────────────────
  useEffect(() => {
    if (!isEdit && !selectedCategoryId && categories.length > 0) {
      const firstReal = categories.find((c) => !c.isPlaceholder);
      if (firstReal) {
        setSelectedCategoryId(firstReal.id);
      }
    }
  }, [isEdit, selectedCategoryId, categories]);

  // ─── Save / Update ────────────────────────────────────────────────────────
  const handleSave = async (onSuccess?: () => Promise<void> | void) => {
    if (isSubmitting || isDivisionByZero) return;

    const numAmount = evaluatedAmount;
    if (numAmount <= 0) return;

    const selfTransferNow = !isEdit && isSelfTransfer;
    let categoryIdToSave = transactionType === 'income' || selfTransferNow ? null : selectedCategoryId;

    // Split: the user typed a split, so it must be valid before anything is saved.
    if (splitActive) {
      const allocations = splitMembers.map((m) => ({
        person: m.person,
        amount: m.share,
      }));
      const err = splitError || validateSplitAllocations(numAmount, allocations);
      if (err) {
        Alert.alert('Split', err);
        return;
      }
    }

    // SPL-006: edit guards for expenses where money has already come back
    if (isEdit && expenseId) {
      const minAmount = minAmountForExpense(expenses, expenseId);
      if (minAmount > 0 && numAmount < minAmount) {
        Alert.alert(
          'Amount Too Low',
          `Amount cannot be less than ₹${minAmount} that already came back for this expense.`
        );
        return;
      }
      const settledPeople = settledPersonsForExpense(expenses, expenseId);
      for (const p of settledPeople) {
        const member = splitMembers.find((m) => personKey(m.person) === p.key);
        if (!member) {
          Alert.alert(
            'Cannot Remove Person',
            `${p.name} has already paid back ₹${p.amount} and cannot be removed from this split.`
          );
          return;
        }
        if (member.share < p.amount) {
          Alert.alert(
            'Share Too Low',
            `${p.name}'s share cannot be less than ₹${p.amount} they already paid back.`
          );
          return;
        }
      }
      const minShare = minShareForExpense(expenses, expenseId);
      if (minShare > 0) {
        if (!splitActive || totalShare < minShare) {
          Alert.alert(
            'Split Required',
            `Their share cannot be less than ₹${minShare} already paid back for this split.`
          );
          return;
        }
      }
    }
    // Money back: a friend paying back or a refund needs a person / an expense to go back to.
    if (moneyBackVisible && moneyBackMode === 'friend' && !cleanPersonName(moneyBackPerson)) {
      Alert.alert('Who paid back?', 'Choose the person who paid you back.');
      return;
    }
    if (moneyBackVisible && moneyBackMode === 'refund' && (!refundExpenseId || !cleanPersonName(refundWho))) {
      Alert.alert('Refund', 'Add who sent the refund and choose the expense it is for.');
      return;
    }

    if (transactionType === 'expense' && !selfTransferNow) {
      // ─── Digital Vault Spending Guard (ADR 0011 / Clip 5-8) ─────────────
      if (!isEdit && !vaultLiquidity.canAddExpense) {
        setShowVaultGuard(true);
        return;
      }

      if (areCategoriesPlaceholder) {
        Alert.alert('Categories Loading', 'Please wait a moment for categories to finish loading.');
        return;
      }
      if (categories.length === 0) {
        Alert.alert('No Category', 'Please create a category first to add an expense.');
        return;
      }
      if (!categoryIdToSave) {
        Alert.alert('Category Required', 'Please select a category for this expense.');
        return;
      }
    }

    setIsSubmitting(true);

    const dateStr = format(selectedDate, 'yyyy-MM-dd');

    const trimmedNote = note.trim();
    let clampedNote = trimmedNote
      ? trimmedNote.split(/\s+/).slice(0, MAX_NOTE_WORDS).join(' ').slice(0, MAX_NOTE_CHARS)
      : '';

    // Auto-Breakdown Note feature: if user did a calculation and note was left blank
    if (!trimmedNote && hasCalculation && cleanExpression) {
      clampedNote = `Breakdown: ${cleanExpression}`.slice(0, MAX_NOTE_CHARS);
    }

    try {
      const validAllocations = splitMembers
        .map((m) => ({ person: cleanPersonName(m.person), amount: m.share }))
        .filter((a) => a.person && a.amount > 0);

      const splitPayload =
        splitActive && validAllocations.length > 0
          ? {
              person: validAllocations.map((a) => a.person).join(', '),
              amount: round2(validAllocations.reduce((sum, a) => sum + a.amount, 0)),
              allocations: validAllocations,
            }
          : null;

      if (isEdit && expenseId) {
        const existingExp = expenses.find((e) => e.id === expenseId);
        const hadSplit = !!(
          existingExp?.split_person ||
          (Array.isArray(existingExp?.split_allocations) && existingExp.split_allocations.length > 0)
        );
        await updateExpense(
          expenseId,
          numAmount,
          categoryIdToSave,
          clampedNote,
          paymentMode,
          dateStr,
          transactionType,
          ...(transactionType === 'expense' && (splitActive || hadSplit)
            ? [{ split: splitPayload }]
            : [])
        );
      } else if (moneyBackVisible && moneyBackMode !== 'income') {
        // Money that came back is recorded as money back, never as income (SPL-003). Extra is income (SPL-004).
        await recordMoneyBack({
          kind: moneyBackMode === 'refund' ? 'refund' : 'settlement',
          who: moneyBackMode === 'refund' ? refundWho : moneyBackPerson,
          amount: numAmount,
          date: dateStr,
          paymentMode: paymentMode === 'cash' ? 'cash' : 'upi',
          refundExpenseId: refundExpenseId || undefined,
          refundTarget: moneyBackMode === 'refund' ? refundTarget : undefined,
          note: clampedNote || undefined,
        });
      } else {
        const newId = Crypto.randomUUID();
        let transactionClass: 'normal' | 'self_transfer' = 'normal';
        let transferRuleId: string | null = null;
        if (selfTransferNow) {
          transactionClass = 'self_transfer';
          if (matchedRule) {
            transferRuleId = matchedRule.id;
          } else if (rememberMode === 'always' && canRememberTransfer) {
            try {
              const rule = await useTransferRulesStore.getState().addRule(clampedNote, clampedNote);
              transferRuleId = rule?.id ?? null;
            } catch {
              // Remembering is best-effort; the transaction itself must still be saved.
            }
          }
        }

        await addExpense(numAmount, categoryIdToSave, clampedNote, paymentMode, dateStr, transactionType, {
          id: newId,
          transactionClass,
          transferRuleId,
          ...(splitPayload ? { split: splitPayload } : {}),
        });
      }
      // Keep daily budget and smart notifications in sync
      const currentExpenses = useExpenseStore.getState().expenses;
      useDailyBudgetStore.getState().syncWithExpenses(currentExpenses);

      if (onSuccess) {
        await onSuccess();
      }

      navigation.goBack();
    } catch (e: any) {
      setIsSubmitting(false);
      Alert.alert('Error', e?.message || 'Could not save transaction. Please try again.');
    }
  };

  const handleSaveWithIncome = async (
    addedAmount: number,
    addedPaymentMode: 'cash' | 'upi' = 'upi',
    onSuccess?: () => Promise<void> | void
  ) => {
    if (isSubmitting) return;
    setIsSubmitting(true);

    const numAmount = evaluatedAmount;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const incomeId = Crypto.randomUUID();

    try {
      // 1. Record incoming funds to vault (real money deposit)
      await addExpense(
        addedAmount,
        null,
        'Added to balance',
        addedPaymentMode,
        dateStr,
        'income',
        { id: incomeId, transactionClass: 'normal' }
      );

      // 2. Now record the pending expense with form data
      const newId = Crypto.randomUUID();
      const trimmedNote = note.trim();
      let clampedNote = trimmedNote
        ? trimmedNote.split(/\s+/).slice(0, MAX_NOTE_WORDS).join(' ').slice(0, MAX_NOTE_CHARS)
        : '';
      if (!trimmedNote && hasCalculation && cleanExpression) {
        clampedNote = `Breakdown: ${cleanExpression}`.slice(0, MAX_NOTE_CHARS);
      }

      const validAllocations = splitMembers
        .map((m) => ({ person: cleanPersonName(m.person), amount: m.share }))
        .filter((a) => a.person && a.amount > 0);

      const splitPayload =
        splitActive && validAllocations.length > 0
          ? {
              person: validAllocations.map((a) => a.person).join(', '),
              amount: round2(validAllocations.reduce((sum, a) => sum + a.amount, 0)),
              allocations: validAllocations,
            }
          : null;

      const categoryIdToSave = selectedCategoryId;

      await addExpense(
        numAmount,
        categoryIdToSave,
        clampedNote,
        paymentMode,
        dateStr,
        'expense',
        {
          id: newId,
          transactionClass: 'normal',
          ...(splitPayload ? { split: splitPayload } : {}),
        }
      );

      // 3. Keep daily budget and smart notifications in sync
      const currentExpenses = useExpenseStore.getState().expenses;
      useDailyBudgetStore.getState().syncWithExpenses(currentExpenses);

      setShowVaultGuard(false);

      if (onSuccess) {
        await onSuccess();
      }

      navigation.goBack();
    } catch (e: any) {
      setIsSubmitting(false);
      Alert.alert('Error', e?.message || 'Could not save transaction. Please try again.');
    } finally {
      setIsSubmitting(false);
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
  const isSaveEnabled = evaluatedAmount > 0 && !isDivisionByZero && !isSubmitting;

  return {
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
    toggleSelfTransfer,
    rememberMode,
    setRememberMode,
    canRememberTransfer,
    transferRuleMatched: !!matchedRule,
    split,
    moneyBack,
  };
}
