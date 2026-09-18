import React from 'react';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors } from '../config/theme';

export type DonutProps = {
  spent: number;
  total: number;
  colors: ThemeColors;
};

const DonutChartBase: React.FC<DonutProps> = ({ spent, total, colors }) => {
  const size = 100;
  const strokeWidth = 14;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const cx = size / 2;
  const cy = size / 2;

  const hasData = total > 0;
  const spentRatio = hasData ? Math.max(0, Math.min(spent / total, 1)) : 0;
  const incomeRatio = hasData ? Math.max(0, 1 - spentRatio) : 0;

  // Spent arc (peach) starts at -90° (top)
  const spentDash = spentRatio * circumference;
  // Income arc (mint) follows
  const incomeDash = incomeRatio * circumference;
  const incomeOffset = -(spentDash);

  return (
    <Svg width={size} height={size}>
      {/* Track (grey bg) */}
      <Circle
        cx={cx} cy={cy} r={r}
        stroke={colors.chartTrack}
        strokeWidth={strokeWidth}
        fill="none"
      />
      {/* Income arc (mint) */}
      {incomeRatio > 0 && (
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={colors.mintGreen}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${incomeDash} ${circumference}`}
          strokeDashoffset={incomeOffset}
          rotation={-90}
          origin={`${cx},${cy}`}
          strokeLinecap={incomeRatio >= 0.999 ? 'butt' : 'round'}
        />
      )}
      {/* Spent arc (peach) */}
      {spentRatio > 0 && (
        <Circle
          cx={cx} cy={cy} r={r}
          stroke={colors.peachCoral}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${spentDash} ${circumference}`}
          strokeDashoffset={0}
          rotation={-90}
          origin={`${cx},${cy}`}
          strokeLinecap={spentRatio >= 0.999 ? 'butt' : 'round'}
        />
      )}
    </Svg>
  );
};

export const DonutChart = React.memo(DonutChartBase);
