import React from 'react';
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
 */
export const BouncyTypeToggle: React.FC<BouncyTypeToggleProps> = ({
  value,
  onChange,
  style,
}) => {
  return (
    <SegmentedControl
      options={TYPE_OPTIONS}
      selectedKey={value}
      onChange={(key) => onChange(key as 'expense' | 'income')}
      height={48}
      style={style}
    />
  );
};

export default BouncyTypeToggle;
