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
 * The Add Transaction mode switch: the page's main switch, so it is one step bigger than the 48dp choices under it
 * (Paid via, What is this money?): a full-width 56dp track.
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
      backgroundColor={colors.cardSubtle}
      fontSize={FontSize.body}
      commitOnSettle
      style={style}
    />
  );
});

export default BouncyTypeToggle;
