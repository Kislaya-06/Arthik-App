export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Auth: undefined;
  ProfileSetup: undefined;
  AppTabs: { screen?: keyof TabParamList; params?: any } | undefined;
  AddExpense: undefined;
  EditExpense: { expenseId: string };
  ExpenseDetail: { expenseId: string };
  GullakDepositDetail: { depositId: string };
  CategoryDetail: { categoryId: string };
  ManageCategories: undefined;
  AddEditCategory: { categoryId?: string } | undefined;
  Notifications: undefined;
  Profile: undefined;
  Savings: undefined;
  ResetPassword: { initialError?: string } | undefined;
  Faq: undefined;
};

export type TabParamList = {
  Home: undefined;
  History: { targetDate?: string; startDate?: string; endDate?: string } | undefined;
  AddExpensePlaceholder: undefined;
  Savings: undefined;
  Insights: undefined;
};

// ─── Budget Modes & Cadence Types (Oct 2026) ─────────────────────────────────

export type BudgetCadence = 'daily' | 'weekly' | 'monthly';

export interface BudgetPlanChange {
  id: string;
  userId: string;
  effectiveFrom: string; // 'yyyy-MM-dd'
  isEnabled: boolean;
  cadence: BudgetCadence;
  amount: number;
  carryMode?: 'additive' | 'allocation';
  carriedOverAmount?: number;
  createdAt?: string;
}

export type BudgetPeriodStatus = 'saved' | 'missed' | 'even' | 'unknown';

export interface BudgetPeriodRecord {
  id: string;
  userId: string;
  cadence: 'weekly' | 'monthly';
  periodStart: string; // 'yyyy-MM-dd'
  periodEnd: string;   // 'yyyy-MM-dd'
  activeStart: string; // 'yyyy-MM-dd'
  activeEnd: string;   // 'yyyy-MM-dd'
  budgetAmount: number;
  spentAmount: number;
  amountSaved: number;
  status: BudgetPeriodStatus;
  isProrated: boolean;
  carriedOverAmount?: number;
  carryMode?: 'additive' | 'allocation';
  createdAt?: string;
}
