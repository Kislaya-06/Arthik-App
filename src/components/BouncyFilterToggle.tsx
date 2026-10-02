import React from 'react';
import { ControlHeight } from '../config/theme';
import { SegmentedControl, SegmentedOption } from './ui/SegmentedControl';

export interface BouncyFilterToggleProps<T extends string> {
  value: T;
  onChange: (filter: T) => void;
  options: readonly T[];
  style?: any;
}

/**
 * Standardized BouncyFilterToggle, consolidated to use the canonical SegmentedControl primitive.
 */
export function BouncyFilterToggle<T extends string>({
  value,
  onChange,
  options,
  style,
}: BouncyFilterToggleProps<T>) {
  const segOptions: SegmentedOption[] = options.map((opt) => ({
    key: opt,
    label: opt,
  }));

  return (
    <SegmentedControl
      options={segOptions}
      selectedKey={value}
      onChange={(key) => onChange(key as T)}
      height={ControlHeight.standard}
      style={style}
    />
  );
}

export default BouncyFilterToggle;
