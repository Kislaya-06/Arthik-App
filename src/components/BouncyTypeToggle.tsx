import React from 'react';
import { useTheme } from '../store/themeStore';
import { ControlHeight, FontSize } from '../config/theme';
import { SegmentedControl, SegmentedOption } from './ui/SegmentedControl';

export interface BouncyTypeToggleProps {
  value: 'expense' | 'income';
  onChange: (type: 'expense' | 'income') => void;
  style?: any;
}


/**
 * Standardized BouncyTypeToggle, consolidated to use the canonical SegmentedControl primitive.
 * Enforces ControlHeight.row (56) matching the Date Picker trigger and standard form input row height.
 */
export const BouncyTypeToggle: React.FC<BouncyTypeToggleProps> = React.memo(({
  value,
  onChange,
  style,
}) => {
  const { colors } = useTheme();

  const typeOptions = React.useMemo<SegmentedOption[]>(() => [
    { key: 'expense', label: 'Expense', activePillColor: colors.peachCoral },
    { key: 'income', label: 'Income', activePillColor: colors.mintGreen },
  ], [colors.peachCoral, colors.mintGreen]);

  return (
    <SegmentedControl
      options={typeOptions}
      selectedKey={value}
      onChange={(key) => onChange(key as 'expense' | 'income')}
      height={ControlHeight.row}
      activeTextColor={colors.forestGreen}
      backgroundColor={colors.inputBg}
      fontSize={FontSize.body}
      commitOnSettle
      style={style}
    />
  );
});

export default BouncyTypeToggle;
