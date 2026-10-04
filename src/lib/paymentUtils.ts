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
