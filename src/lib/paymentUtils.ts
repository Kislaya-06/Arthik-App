import { Wallet, CheckSquare, CreditCard } from 'lucide-react-native';
import React from 'react';

export type PaymentMode = 'cash' | 'upi' | 'card';

type IconComponent = React.FC<{ size: number; color: string }>;

/**
 * Returns the Lucide icon component matching a payment mode.
 * cash → Wallet, card → CreditCard, upi → CheckSquare
 */
export const getPaymentIcon = (mode: PaymentMode): IconComponent => {
  if (mode === 'cash') return Wallet;
  if (mode === 'card') return CreditCard;
  return CheckSquare;
};

/**
 * Returns the human-readable label for a payment mode.
 * cash → 'Cash', card → 'Card', upi → 'UPI'
 */
export const getPaymentLabel = (mode: PaymentMode): string => {
  if (mode === 'cash') return 'Cash';
  if (mode === 'card') return 'Card';
  return 'UPI';
};

export const DEFAULT_INCOME_KEYWORDS = [
  'salary',
  'income',
  'freelance',
  'business',
  'dividend',
  'stipend',
  'rental',
  'bonus',
  'interest',
  'cashback',
  'refund',
  'pocket money',
  'gift',
  'sales',
];

/**
 * Robust check if a transaction is income.
 * Prioritizes expense.type === 'income' first, then falls back to category keywords for legacy rows.
 */
export const isIncomeTransaction = (
  item?: { type?: 'expense' | 'income' | string } | null,
  category?: { name?: string } | null
): boolean => {
  if (item?.type === 'income') return true;
  if (item?.type === 'expense') return false;
  if (!category?.name) return false;
  const lower = category.name.toLowerCase();
  return DEFAULT_INCOME_KEYWORDS.some((kw) => lower.includes(kw));
};
