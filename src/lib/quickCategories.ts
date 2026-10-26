import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore } from '../store/categoryStore';
import { pickQuickCategories, QuickCategory, QUICK_CATEGORY_LIMIT } from './quickCategoryPick';

export { pickQuickCategories, QUICK_CATEGORY_LIMIT };
export type { QuickCategory };

/**
 * "Quick categories": the few expense categories the user picks most often.
 * Automatic Logging shows them as buttons inside the "logged" notification, so a transaction can be given its
 * category without opening the app. The list is saved on the phone because the notification can be built while
 * the app is closed (stores not loaded).
 *
 * Money logic is not touched: this only chooses which category NAMES to show as buttons.
 */

const keyFor = (userId: string) => `@arthik_quick_categories_${userId}`;

export const saveQuickCategories = async (userId: string, list: QuickCategory[]): Promise<void> => {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(list));
  } catch {
    // best effort: the notification just shows no buttons
  }
};

export const loadQuickCategories = async (userId: string): Promise<QuickCategory[]> => {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string' && c.id && c.name)
      .slice(0, QUICK_CATEGORY_LIMIT);
  } catch {
    return [];
  }
};

/** Keeps the saved list fresh while the app runs. Returns a cleanup function. */
export const startQuickCategorySync = (): (() => void) => {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let lastWritten = '';

  const run = () => {
    timer = null;
    const userId = useAuthStore.getState().user?.id;
    if (!userId) return;
    const { expenses, isExpensesLoaded } = useExpenseStore.getState();
    const { categories, isFetched } = useCategoryStore.getState();
    if (!isExpensesLoaded || !isFetched) return;
    const list = pickQuickCategories(expenses, categories);
    const serialized = userId + JSON.stringify(list);
    if (serialized === lastWritten) return;
    lastWritten = serialized;
    saveQuickCategories(userId, list);
  };
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(run, 2000);
  };

  const unsubExpenses = useExpenseStore.subscribe(schedule);
  const unsubCategories = useCategoryStore.subscribe(schedule);
  const unsubAuth = useAuthStore.subscribe(schedule);
  schedule();

  return () => {
    if (timer) clearTimeout(timer);
    unsubExpenses();
    unsubCategories();
    unsubAuth();
  };
};
