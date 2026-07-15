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
};

export type TabParamList = {
  Home: undefined;
  History: undefined;
  AddExpensePlaceholder: undefined;
  Insights: undefined;
  Profile: undefined;
};
