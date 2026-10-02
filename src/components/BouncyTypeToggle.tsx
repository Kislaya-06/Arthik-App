import React from 'react';
import { useTheme } from '../store/themeStore';
import { ControlHeight, FontSize } from '../config/theme';
import { SegmentedControl, SegmentedOption } from './ui/SegmentedControl';

export interface BouncyTypeToggleProps {
  value: 'expense' | 'income';
  onChange: (type: 'expense' | 'income') => void;
  style?: any;
}

const TYPE_OPTIONS: SegmentedOption[] = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
];

/**
 * Standardized BouncyTypeToggle, consolidated to use the canonical SegmentedControl primitive.
 * Enforces ControlHeight.row (56) matching the Date Picker trigger and standard form input row height.
 */
export const BouncyTypeToggle: React.FC<BouncyTypeToggleProps> = ({
  value,
  onChange,
  style,
}) => {
  const { colors } = useTheme();
  const isExpense = value === 'expense';
  const activePillColor = isExpense ? colors.peachCoral : colors.mintGreen;

  return (
    <SegmentedControl
      options={TYPE_OPTIONS}
      selectedKey={value}
      onChange={(key) => onChange(key as 'expense' | 'income')}
      height={ControlHeight.row}
      activePillColor={activePillColor}
      activeTextColor={colors.forestGreen}
      backgroundColor={colors.inputBg}
      fontSize={FontSize.body}
      style={style}
    />
  );
};

export default BouncyTypeToggle;
