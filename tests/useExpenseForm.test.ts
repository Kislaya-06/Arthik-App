import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('react', async () => {
  const actual = await vi.importActual<any>('react');
  const rt = await import('./helpers/hookRuntime');
  return { ...actual, ...rt.reactHooks, default: { ...actual, ...rt.reactHooks } };
});

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  addExpense: vi.fn(async () => {}),
  updateExpense: vi.fn(async () => {}),
  fetchCategories: vi.fn(),
  syncWithExpenses: vi.fn(),
}));

vi.mock('react-native', () => ({ Alert: { alert: mocks.alert } }));

vi.mock('../src/store/expenseStore', async () => {
  const { createFakeStore } = await import('./helpers/fakeStore');
  const useExpenseStore = createFakeStore<any>({
    expenses: [],
    addExpense: mocks.addExpense,
    updateExpense: mocks.updateExpense,
  });
  return { useExpenseStore };
});
vi.mock('../src/store/categoryStore', async () => {
  const { createFakeStore } = await import('./helpers/fakeStore');
  const useCategoryStore = createFakeStore<any>({
    categories: [],
    fetchCategories: mocks.fetchCategories,
    loading: false,
    isFetched: true,
  });
  return { useCategoryStore };
});
vi.mock('../src/store/dailyBudgetStore', async () => {
  const { createFakeStore } = await import('./helpers/fakeStore');
  const useDailyBudgetStore = createFakeStore<any>({
    isBudgetModeEnabled: false,
    budgetCadence: 'daily',
    dailyBudgetAmount: 0,
    weeklyBudgetAmount: 0,
    monthlyBudgetAmount: 0,
    isAutoRenew: true,
    gullakDeposits: [],
    syncWithExpenses: mocks.syncWithExpenses,
  });
  return { useDailyBudgetStore };
});

import { renderHook, act } from './helpers/hookRuntime';
import { MAX_NOTE_CHARS, MAX_NOTE_WORDS, countWords, useExpenseForm } from '../src/hooks/useExpenseForm';
import { evaluateExpression } from '../src/lib/amountKeypad';
import { useExpenseStore } from '../src/store/expenseStore';
import { useCategoryStore } from '../src/store/categoryStore';
import { useDailyBudgetStore } from '../src/store/dailyBudgetStore';

const CATS = [
  { id: 'c1', user_id: 'u', name: 'Food & Drinks', icon: 'Utensils', color: '#FF857A', is_default: true },
  { id: 'c2', user_id: 'u', name: 'Transport', icon: 'Car', color: '#4A90D9', is_default: true },
];
// Pure mode needs money in the vault before an expense can be added, so most tests start with income
const INCOME: any = { id: 'inc', user_id: 'u', amount: 5000, type: 'income', category_id: null, payment_mode: 'upi', expense_date: '2026-10-01' };

const navigation = () => {
  const unsubscribe = vi.fn();
  return { addListener: vi.fn(() => unsubscribe), goBack: vi.fn(), unsubscribe } as any;
};
const addRoute = { name: 'AddExpense' } as any;
const editRoute = (expenseId = 'e1') => ({ name: 'EditExpense', params: { expenseId } }) as any;

const setup = (route: any = addRoute, nav: any = navigation()) => {
  const h = renderHook(() => useExpenseForm({ route, navigation: nav }));
  return { h, nav, r: () => h.result.current };
};
const press = (h: ReturnType<typeof setup>, keys: string[]) => keys.forEach((k) => h.r().handleKeyPress(k));

describe('useExpenseForm (the add / edit income-expense form)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-04T10:00:00'));
    vi.clearAllMocks();
    mocks.addExpense.mockImplementation(async () => {});
    mocks.updateExpense.mockImplementation(async () => {});
    useExpenseStore.setState({ expenses: [INCOME] });
    useCategoryStore.setState({ categories: CATS, loading: false, isFetched: true });
    useDailyBudgetStore.setState({
      isBudgetModeEnabled: false, budgetCadence: 'daily', dailyBudgetAmount: 0, weeklyBudgetAmount: 0,
      monthlyBudgetAmount: 0, isAutoRenew: true, gullakDeposits: [],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('note helpers', () => {
    it('countWords counts words however they are spaced', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords('lunch')).toBe(1);
      expect(countWords('  two   words  ')).toBe(2);
      expect(countWords('a\tb\nc')).toBe(3);
    });
    it('limits are 50 words and 250 characters', () => {
      expect(MAX_NOTE_WORDS).toBe(50);
      expect(MAX_NOTE_CHARS).toBe(250);
    });
  });

  describe('a fresh add form', () => {
    it('starts empty, as an expense, paid by UPI, dated today, with Save disabled', () => {
      const { r } = setup();
      expect(r().isEdit).toBe(false);
      expect(r().amount).toBe('');
      expect(r().evaluatedAmount).toBe(0);
      expect(r().transactionType).toBe('expense');
      expect(r().paymentMode).toBe('upi');
      expect(r().note).toBe('');
      expect(r().selectedDate.getFullYear()).toBe(2026);
      expect(r().selectedDate.getMonth()).toBe(9);
      expect(r().selectedDate.getDate()).toBe(4);
      expect(r().isSaveEnabled).toBe(false);
      expect(r().isSubmitting).toBe(false);
    });

    it('loads categories on open and again every time the screen regains focus', () => {
      const { nav } = setup();
      expect(mocks.fetchCategories).toHaveBeenCalledWith();
      const onFocus = nav.addListener.mock.calls[0];
      expect(onFocus[0]).toBe('focus');
      onFocus[1]();
      expect(mocks.fetchCategories).toHaveBeenCalledWith(true);
    });

    it('removes its focus listener when the screen closes', () => {
      const { h, nav } = setup();
      h.unmount();
      expect(nav.unsubscribe).toHaveBeenCalledTimes(1);
    });

    it('pre-selects the first REAL category (never a placeholder)', () => {
      useCategoryStore.setState({
        categories: [{ ...CATS[0], id: 'ph', isPlaceholder: true }, ...CATS],
      });
      expect(setup().r().selectedCategoryId).toBe('c1');
    });

    it('selects nothing while only placeholders exist', () => {
      useCategoryStore.setState({ categories: [{ ...CATS[0], id: 'ph', isPlaceholder: true }], isFetched: false });
      const { r } = setup();
      expect(r().selectedCategoryId).toBeNull();
      expect(r().areCategoriesPlaceholder).toBe(true);
    });
  });

  describe('the calculator keypad', () => {
    it('typing digits builds the amount and enables Save', () => {
      const s = setup();
      press(s, ['1', '2', '5']);
      expect(s.r().amount).toBe('125');
      expect(s.r().evaluatedAmount).toBe(125);
      expect(s.r().formattedExpression).toBe('125');
      expect(s.r().isSaveEnabled).toBe(true);
    });

    it('a decimal point and backspace work', () => {
      const s = setup();
      press(s, ['1', '2', '.', '5']);
      expect(s.r().evaluatedAmount).toBe(12.5);
      press(s, ['backspace']);
      expect(s.r().amount).toBe('12.');
      press(s, ['backspace', 'backspace']);
      expect(s.r().amount).toBe('1');
    });

    it('operators calculate live: 10 + 5 = 15', () => {
      const s = setup();
      press(s, ['1', '0', '+', '5']);
      expect(s.r().hasOperator).toBe(true);
      expect(s.r().evaluatedAmount).toBe(15);
      expect(s.r().isSaveEnabled).toBe(true);
    });

    it('division by zero is flagged and blocks Save', () => {
      const s = setup();
      press(s, ['8', '÷', '0']);
      expect(s.r().isDivisionByZero).toBe(true);
      expect(s.r().isSaveEnabled).toBe(false);
    });

    it('zero is not a valid amount', () => {
      const s = setup();
      press(s, ['0']);
      expect(s.r().evaluatedAmount).toBe(0);
      expect(s.r().isSaveEnabled).toBe(false);
    });
  });

  describe('form fields', () => {
    it('switching to income keeps UPI/cash, but a card payment falls back to UPI (no cards for income)', () => {
      const s = setup();
      s.r().setPaymentMode('card');
      expect(s.r().paymentMode).toBe('card');
      s.r().handleTypeChange('income');
      expect(s.r().transactionType).toBe('income');
      expect(s.r().paymentMode).toBe('upi');

      s.r().setPaymentMode('cash');
      s.r().handleTypeChange('expense');
      s.r().handleTypeChange('income');
      expect(s.r().paymentMode).toBe('cash');
    });

    it('category, date and picker state can be changed', () => {
      const s = setup();
      s.r().handleCategorySelect('c2');
      expect(s.r().selectedCategoryId).toBe('c2');
      s.r().handleDateConfirm(new Date('2026-09-30T12:00:00'));
      expect(s.r().selectedDate.getDate()).toBe(30);
      s.r().setShowDatePicker(true);
      expect(s.r().showDatePicker).toBe(true);
    });

    it('a note longer than 50 words is cut to 50 words', () => {
      const s = setup();
      const long = Array.from({ length: 70 }, (_, i) => `w${i}`).join(' ');
      s.r().handleNoteChange(long);
      expect(countWords(s.r().note)).toBe(50);
      expect(s.r().note.startsWith('w0 w1 w2')).toBe(true);
    });

    it('a normal note is kept exactly as typed', () => {
      const s = setup();
      s.r().handleNoteChange('Lunch with  friends ');
      expect(s.r().note).toBe('Lunch with  friends ');
    });

    it('picking a note suggestion fills the note', () => {
      const s = setup();
      s.r().handleSelectNoteSuggestion('Auto rickshaw');
      expect(s.r().note).toBe('Auto rickshaw');
    });
  });

  describe('saving a new expense', () => {
    it('adds it with the right values, re-syncs the budget, and goes back', async () => {
      const nav = navigation();
      const s = setup(addRoute, nav);
      press(s, ['2', '5', '0']);
      s.r().handleCategorySelect('c2');
      s.r().handleNoteChange('  Metro  ');
      s.r().setPaymentMode('cash');

      await act(async () => {
        await s.r().handleSave();
      });

      expect(mocks.addExpense).toHaveBeenCalledTimes(1);
      expect(mocks.addExpense).toHaveBeenCalledWith(250, 'c2', 'Metro', 'cash', '2026-10-04', 'expense');
      expect(mocks.syncWithExpenses).toHaveBeenCalledWith(useExpenseStore.getState().expenses);
      expect(nav.goBack).toHaveBeenCalledTimes(1);
      expect(mocks.alert).not.toHaveBeenCalled();
    });

    it('runs the caller\'s onSuccess before going back', async () => {
      const order: string[] = [];
      const nav = navigation();
      nav.goBack.mockImplementation(() => order.push('goBack'));
      const s = setup(addRoute, nav);
      press(s, ['9']);
      await act(async () => {
        await s.r().handleSave(async () => {
          order.push('onSuccess');
        });
      });
      expect(order).toEqual(['onSuccess', 'goBack']);
    });

    it('uses the calculated result, not the typed expression', async () => {
      const s = setup();
      press(s, ['1', '0', '+', '5']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect((mocks.addExpense.mock.calls[0] as any)[0]).toBe(15);
    });

    it('turns a long note into at most 50 words and 250 characters', async () => {
      const s = setup();
      press(s, ['5']);
      s.r().handleNoteChange(Array.from({ length: 50 }, () => 'abcdefghij').join(' ')); // 50 words, 549 characters
      await act(async () => {
        await s.r().handleSave();
      });
      const savedNote = (mocks.addExpense.mock.calls[0] as any)[2] as string;
      expect(savedNote.length).toBe(MAX_NOTE_CHARS);
      expect(countWords(savedNote)).toBeLessThanOrEqual(MAX_NOTE_WORDS);
    });

    it('with a calculation and an empty note, writes the calculation as the note ("Breakdown: ...")', async () => {
      const s = setup();
      press(s, ['1', '0', '+', '5']);
      const clean = evaluateExpression(s.r().amount).cleanExpression;
      await act(async () => {
        await s.r().handleSave();
      });
      expect((mocks.addExpense.mock.calls[0] as any)[2]).toBe(`Breakdown: ${clean}`);
      expect(clean.length).toBeGreaterThan(0);
    });

    it('a note the user typed is never replaced by the breakdown', async () => {
      const s = setup();
      press(s, ['1', '0', '+', '5']);
      s.r().handleNoteChange('Tea and snacks');
      await act(async () => {
        await s.r().handleSave();
      });
      expect((mocks.addExpense.mock.calls[0] as any)[2]).toBe('Tea and snacks');
    });

    it('does nothing when the amount is zero or a division by zero', async () => {
      const s = setup();
      await act(async () => {
        await s.r().handleSave();
      });
      press(s, ['8', '÷', '0']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.addExpense).not.toHaveBeenCalled();
      expect(mocks.alert).not.toHaveBeenCalled();
    });

    it('a second tap while saving is ignored (no double expense)', async () => {
      let release!: () => void;
      mocks.addExpense.mockImplementationOnce(() => new Promise<void>((res) => { release = res; }));
      const s = setup();
      press(s, ['7']);
      const first = s.r().handleSave();
      expect(s.r().isSubmitting).toBe(true);
      expect(s.r().isSaveEnabled).toBe(false);
      await s.r().handleSave();
      expect(mocks.addExpense).toHaveBeenCalledTimes(1);
      release();
      await first;
    });

    it('if saving fails the user sees the error, and can try again', async () => {
      mocks.addExpense.mockRejectedValueOnce(new Error('Network down'));
      const nav = navigation();
      const s = setup(addRoute, nav);
      press(s, ['7']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Network down');
      expect(nav.goBack).not.toHaveBeenCalled();
      expect(s.r().isSubmitting).toBe(false);
      expect(s.r().isSaveEnabled).toBe(true);
    });

    it('an error without a message gets a friendly default', async () => {
      mocks.addExpense.mockRejectedValueOnce({});
      const s = setup();
      press(s, ['7']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Could not save transaction. Please try again.');
    });
  });

  describe('expense validation', () => {
    it('asks the user to wait while categories are still loading', async () => {
      useCategoryStore.setState({ isFetched: false });
      const s = setup();
      press(s, ['5']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.alert).toHaveBeenCalledWith('Categories Loading', expect.any(String));
      expect(mocks.addExpense).not.toHaveBeenCalled();
    });

    it('asks the user to create a category when there is none', async () => {
      useCategoryStore.setState({ categories: [] });
      const s = setup();
      press(s, ['5']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.alert).toHaveBeenCalledWith('No Category', expect.any(String));
      expect(mocks.addExpense).not.toHaveBeenCalled();
    });

    it('asks for a category when an old expense without one is edited and saved as it is', async () => {
      // New expenses always pre-select a category; the only way to reach "none selected" is editing a legacy row.
      useExpenseStore.setState({
        expenses: [{ id: 'e1', user_id: 'u', amount: 80, type: 'expense', category_id: null, payment_mode: 'upi', expense_date: '2026-10-01' }],
      });
      const s = setup(editRoute());
      expect(s.r().selectedCategoryId).toBeNull();
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.alert).toHaveBeenCalledWith('Category Required', expect.any(String));
      expect(mocks.updateExpense).not.toHaveBeenCalled();
    });

    it('then lets the user save once they pick a category', async () => {
      useExpenseStore.setState({
        expenses: [{ id: 'e1', user_id: 'u', amount: 80, type: 'expense', category_id: null, payment_mode: 'upi', expense_date: '2026-10-01' }],
      });
      const s = setup(editRoute());
      s.r().handleCategorySelect('c1');
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.updateExpense).toHaveBeenCalledWith('e1', 80, 'c1', '', 'upi', '2026-10-01', 'expense');
    });
  });

  describe('income', () => {
    it('is saved WITHOUT a category and needs none', async () => {
      useCategoryStore.setState({ categories: [] });
      const s = setup();
      s.r().handleTypeChange('income');
      press(s, ['3', '0', '0', '0']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.addExpense).toHaveBeenCalledWith(3000, null, '', 'upi', '2026-10-04', 'income');
      expect(mocks.alert).not.toHaveBeenCalled();
    });

    it('is never blocked by the vault guard (that is how money gets in)', async () => {
      useExpenseStore.setState({ expenses: [] });
      const s = setup();
      s.r().handleTypeChange('income');
      press(s, ['5', '0', '0']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.addExpense).toHaveBeenCalledTimes(1);
      expect(s.r().showVaultGuard).toBe(false);
    });
  });

  describe('Digital Vault Spending Guard (you can not spend money that does not exist)', () => {
    it('Pure mode, no money at all: an expense is blocked and the guard sheet opens', async () => {
      useExpenseStore.setState({ expenses: [] });
      const s = setup();
      press(s, ['1', '0', '0']);
      expect(s.r().vaultLiquidity.canAddExpense).toBe(false);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(s.r().showVaultGuard).toBe(true);
      expect(mocks.addExpense).not.toHaveBeenCalled();
    });

    it('Pure mode where everything is already spent: still blocked', async () => {
      useExpenseStore.setState({
        expenses: [INCOME, { id: 'x', user_id: 'u', amount: 5000, type: 'expense', category_id: 'c1', payment_mode: 'upi', expense_date: '2026-10-02' }],
      });
      const s = setup();
      press(s, ['1']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(s.r().showVaultGuard).toBe(true);
    });

    it('Pure mode with income logged: allowed', async () => {
      const s = setup();
      press(s, ['1', '0', '0']);
      expect(s.r().vaultLiquidity.canAddExpense).toBe(true);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.addExpense).toHaveBeenCalledTimes(1);
      expect(s.r().showVaultGuard).toBe(false);
    });

    it('Budget mode: the allowance alone is enough, even with no income', async () => {
      useExpenseStore.setState({ expenses: [] });
      useDailyBudgetStore.setState({ isBudgetModeEnabled: true, budgetCadence: 'daily', dailyBudgetAmount: 500 });
      const s = setup();
      press(s, ['1', '0', '0']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.addExpense).toHaveBeenCalledTimes(1);
    });

    it('Budget mode with no allowance and no income is blocked; the guard can be closed again', async () => {
      useExpenseStore.setState({ expenses: [] });
      useDailyBudgetStore.setState({ isBudgetModeEnabled: true, budgetCadence: 'daily', dailyBudgetAmount: 0 });
      const s = setup();
      press(s, ['1']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(s.r().showVaultGuard).toBe(true);
      expect(s.r().isBudgetModeEnabled).toBe(true);
      s.r().setShowVaultGuard(false);
      expect(s.r().showVaultGuard).toBe(false);
    });

    it('money in the Gullak (external deposits) counts as available in Budget mode', async () => {
      useExpenseStore.setState({ expenses: [] });
      useDailyBudgetStore.setState({ isBudgetModeEnabled: true, dailyBudgetAmount: 0, gullakDeposits: [{ amount: 400 }, { amount: 100 }] as any });
      const s = setup();
      expect(s.r().vaultLiquidity.totalVaultLiquidity).toBe(500);
      press(s, ['5']);
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.addExpense).toHaveBeenCalledTimes(1);
    });

    it('an income category (legacy rows without a type) counts as income, not as spending', () => {
      useCategoryStore.setState({ categories: [...CATS, { id: 'sal', user_id: 'u', name: 'Salary', icon: 'x', color: '#000', is_default: true }] });
      useExpenseStore.setState({ expenses: [{ id: 'old', user_id: 'u', amount: 900, category_id: 'sal', payment_mode: 'upi', expense_date: '2026-10-01' }] });
      expect(setup().r().vaultLiquidity.totalVaultLiquidity).toBe(900);
    });
  });

  describe('editing an existing transaction', () => {
    const existing: any = { id: 'e1', user_id: 'u', amount: 250, type: 'expense', category_id: 'c2', note: 'Metro', payment_mode: 'cash', expense_date: '2026-10-01' };
    beforeEach(() => {
      useExpenseStore.setState({ expenses: [existing] });
    });

    it('opens pre-filled with the saved values', () => {
      const { r } = setup(editRoute());
      expect(r().isEdit).toBe(true);
      expect(r().amount).toBe('250');
      expect(r().selectedCategoryId).toBe('c2');
      expect(r().note).toBe('Metro');
      expect(r().paymentMode).toBe('cash');
      expect(r().transactionType).toBe('expense');
      expect(r().selectedDate.getDate()).toBe(1);
      expect(r().selectedDate.getMonth()).toBe(9);
    });

    it('opens an income as income', () => {
      useExpenseStore.setState({ expenses: [{ ...existing, id: 'e1', type: 'income', category_id: null }] as any });
      expect(setup(editRoute()).r().transactionType).toBe('income');
    });

    it('pre-fills only ONCE: later edits are not overwritten when the store changes', () => {
      const s = setup(editRoute());
      press(s, ['9']);
      expect(s.r().amount).toBe('2509');
      useExpenseStore.setState({ expenses: [{ ...existing, amount: 1 }] as any });
      s.h.rerender();
      expect(s.r().amount).toBe('2509');
    });

    it('waits for the transaction if it is not in memory yet, then pre-fills', () => {
      useExpenseStore.setState({ expenses: [] });
      const s = setup(editRoute());
      expect(s.r().amount).toBe('');
      useExpenseStore.setState({ expenses: [existing] });
      s.h.rerender();
      expect(s.r().amount).toBe('250');
    });

    it('does not auto-pick a category in edit mode', () => {
      useExpenseStore.setState({ expenses: [{ ...existing, category_id: null }] as any });
      expect(setup(editRoute()).r().selectedCategoryId).toBeNull();
    });

    it('saves with updateExpense (not addExpense) using the transaction id', async () => {
      const nav = navigation();
      const s = setup(editRoute(), nav);
      s.r().handleNoteChange('Metro and bus');
      await act(async () => {
        await s.r().handleSave();
      });
      expect(mocks.updateExpense).toHaveBeenCalledWith('e1', 250, 'c2', 'Metro and bus', 'cash', '2026-10-01', 'expense');
      expect(mocks.addExpense).not.toHaveBeenCalled();
      expect(mocks.syncWithExpenses).toHaveBeenCalledTimes(1);
      expect(nav.goBack).toHaveBeenCalledTimes(1);
    });

    it('is NOT blocked by the vault guard (the money was already spent)', async () => {
      useExpenseStore.setState({ expenses: [existing] }); // net is negative: no money left
      const s = setup(editRoute());
      await act(async () => {
        await s.r().handleSave();
      });
      expect(s.r().showVaultGuard).toBe(false);
      expect(mocks.updateExpense).toHaveBeenCalledTimes(1);
    });
  });

  it('shows the date the way the rest of the app does', () => {
    const { r } = setup();
    expect(typeof r().formattedDate).toBe('string');
    expect(r().formattedDate.length).toBeGreaterThan(0);
  });
});
