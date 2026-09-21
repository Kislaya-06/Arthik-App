import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ThemeColors, FontFamily } from '../config/theme';

export type DonutProps = {
  spent: number;
  total: number;
  colors: ThemeColors;
};

const SIZE = 100;
const STROKE_WIDTH = 14;
const R = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * R;
const CENTER = SIZE / 2;

const DonutChartBase: React.FC<DonutProps> = ({ spent, total, colors }) => {
  const hasData = total > 0;
  const spentRatio = hasData ? Math.max(0, Math.min(spent / total, 1)) : 0;
  const incomeRatio = hasData ? Math.max(0, 1 - spentRatio) : 0;

  const spentDash = spentRatio * CIRCUMFERENCE;
  const incomeDash = incomeRatio * CIRCUMFERENCE;
  const incomeOffset = -spentDash;

  const spentPercentage = hasData ? Math.round((spent / total) * 100) : 0;
  const isOverspent = hasData && spent > total;

  return (
    <View style={styles.container}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        {/* Track (grey bg) */}
        <Circle
          cx={CENTER} cy={CENTER} r={R}
          stroke={colors.chartTrack}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />
        {/* Income arc (mint) */}
        {incomeRatio > 0 && (
          <Circle
            cx={CENTER} cy={CENTER} r={R}
            stroke={colors.mintGreen}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${incomeDash} ${CIRCUMFERENCE}`}
            strokeDashoffset={incomeOffset}
            rotation={-90}
            origin={`${CENTER},${CENTER}`}
            strokeLinecap={incomeRatio >= 0.999 ? 'butt' : 'round'}
          />
        )}
        {/* Spent arc (peach) */}
        {spentRatio > 0 && (
          <Circle
            cx={CENTER} cy={CENTER} r={R}
            stroke={colors.peachCoral}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${spentDash} ${CIRCUMFERENCE}`}
            strokeDashoffset={0}
            rotation={-90}
            origin={`${CENTER},${CENTER}`}
            strokeLinecap={spentRatio >= 0.999 ? 'butt' : 'round'}
          />
        )}
      </Svg>
      <View style={styles.centerContent} pointerEvents="none">
        <Text
          style={[
            styles.percentageText,
            { color: isOverspent ? colors.danger : colors.textPrimary },
          ]}
          numberOfLines={1}
        >
          {`${spentPercentage}%`}
        </Text>
        <Text style={[styles.labelText, { color: colors.textSecondary }]}>
          SPENT
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentageText: {
    fontSize: 16,
    fontFamily: FontFamily.bold,
    includeFontPadding: false,
    lineHeight: 20,
  },
  labelText: {
    fontSize: 9,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.6,
    marginTop: 1,
    includeFontPadding: false,
  },
});

export const DonutChart = React.memo(DonutChartBase);

