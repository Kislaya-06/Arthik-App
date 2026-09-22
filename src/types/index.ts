export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Auth: undefined;
  ProfileSetup: undefined;
  AppTabs: undefined;
  AddExpense: undefined;
  EditExpense: { expenseId: string };
  ExpenseDetail: { expenseId: string };
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
  History: undefined;
  AddExpensePlaceholder: undefined;
  Savings: undefined;
  Insights: undefined;
};
