import { useMemo } from 'react';
import { ControlHeight } from '../config/theme';
import { SegmentedControl, SegmentedOption } from './ui/SegmentedControl';

export interface BouncyFilterToggleProps<T extends string> {
  value: T;
  onChange: (filter: T) => void;
  options: readonly T[];
  style?: any;
  /** Report the change only after the pill lands (heavy screens). */
  commitOnSettle?: boolean;
}

/**
 * Standardized BouncyFilterToggle, consolidated to use the canonical SegmentedControl primitive.
 */
export function BouncyFilterToggle<T extends string>({
  value,
  onChange,
  options,
  style,
  commitOnSettle,
}: BouncyFilterToggleProps<T>) {
  const segOptions = useMemo<SegmentedOption[]>(
    () =>
      options.map((opt) => ({
        key: opt,
        label: opt,
      })),
    [options]
  );

  return (
    <SegmentedControl
      options={segOptions}
      selectedKey={value}
      onChange={(key) => onChange(key as T)}
      height={ControlHeight.standard}
      style={style}
      commitOnSettle={commitOnSettle}
    />
  );
}

export default BouncyFilterToggle;
