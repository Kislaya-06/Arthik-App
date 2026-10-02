import React from 'react';
import { Wallet, CheckSquare, CreditCard } from 'lucide-react-native';
import { useTheme } from '../store/themeStore';
import { ControlHeight } from '../config/theme';
import { SegmentedControl, SegmentedOption } from './ui/SegmentedControl';

export const EXPENSE_PAYMENT_OPTIONS = [
  { mode: 'cash' as const, label: 'Cash', Icon: Wallet },
  { mode: 'upi' as const, label: 'UPI', Icon: CheckSquare },
  { mode: 'card' as const, label: 'Card', Icon: CreditCard },
];

export const INCOME_PAYMENT_OPTIONS = [
  { mode: 'cash' as const, label: 'Cash', Icon: Wallet },
  { mode: 'upi' as const, label: 'UPI', Icon: CheckSquare },
];

export interface BouncyPaymentToggleProps {
  value: 'cash' | 'upi' | 'card';
  onChange: (mode: 'cash' | 'upi' | 'card') => void;
  options?: readonly { mode: 'cash' | 'upi' | 'card'; label: string; Icon: any }[];
  activeColor?: string;
  style?: any;
}

/**
 * Standardized BouncyPaymentToggle, consolidated to use the canonical SegmentedControl primitive.
 * Enforces ControlHeight.row (56) matching the Date Picker trigger and standard form input row height.
 */
export const BouncyPaymentToggle: React.FC<BouncyPaymentToggleProps> = ({
  value,
  onChange,
  options = EXPENSE_PAYMENT_OPTIONS,
  activeColor,
  style,
}) => {
  const { colors } = useTheme();

  const isIncome =
    options === INCOME_PAYMENT_OPTIONS ||
    (options.length === 2 && !options.some((o) => o.mode === 'card'));

  const resolvedActivePill = activeColor ?? (isIncome ? colors.mintGreen : colors.peachCoral);
  // CRITICAL ACCESSIBILITY FIX: Active text must always be deep contrast (colors.forestGreen / #1A2B4C)
  // on both peachCoral and mintGreen active pills. Never use colors.coral, which matches the pill background.
  const resolvedActiveText = colors.forestGreen;

  const segOptions: SegmentedOption[] = options.map((opt) => ({
    key: opt.mode,
    label: opt.label,
    icon: ({ size, color }) => <opt.Icon size={size} color={color} />,
  }));

  return (
    <SegmentedControl
      options={segOptions}
      selectedKey={value}
      onChange={(key) => onChange(key as 'cash' | 'upi' | 'card')}
      height={ControlHeight.row}
      activePillColor={resolvedActivePill}
      activeTextColor={resolvedActiveText}
      backgroundColor={colors.inputBg}
      iconSize={16}
      style={style}
    />
  );
};

export default BouncyPaymentToggle;
