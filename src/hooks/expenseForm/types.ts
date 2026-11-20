import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, VaultLiquidityInfo } from '../../types';
import { Category } from '../../store/categoryStore';
import { BackdatedSpendingNotice } from '../../lib/budgetUtils';
import { type PersonLedger, type RefundCandidate, type RecoveryPlan } from '../../lib/splitLedger';

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
  backdatedSpendingNotice: BackdatedSpendingNotice | null;
  shortfallAmount: number;

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
