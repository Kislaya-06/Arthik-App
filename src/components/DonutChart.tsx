import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
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

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const DonutChartBase: React.FC<DonutProps> = ({ spent, total, colors }) => {
  const hasData = total > 0;
  const targetSpentRatio = hasData ? Math.max(0, Math.min(spent / total, 1)) : 0;
  const targetSpentPercentage = hasData ? Math.round((spent / total) * 100) : 0;
  const isOverspent = hasData && spent > total;

  const anim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const [displayPercentage, setDisplayPercentage] = useState(targetSpentPercentage);

  useEffect(() => {
    // Gentle spring scale on change
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();

    // Smooth arc sweep
    const sweep = Animated.timing(anim, {
      toValue: targetSpentRatio,
      duration: 480,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });

    const listenerId = anim.addListener(({ value }) => {
      setDisplayPercentage(Math.round(value * 100));
    });

    sweep.start(() => {
      setDisplayPercentage(targetSpentPercentage);
    });

    return () => {
      anim.removeListener(listenerId);
      sweep.stop();
    };
  }, [targetSpentRatio, targetSpentPercentage, anim, scaleAnim]);

  // Interpolated stroke dashoffset for the spent (peach) arc
  const spentOffset = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [CIRCUMFERENCE, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View style={[styles.container, { transform: [{ scale: scaleAnim }] }]}>
      <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
        {/* Track (grey bg) */}
        <Circle
          cx={CENTER}
          cy={CENTER}
          r={R}
          stroke={colors.chartTrack}
          strokeWidth={STROKE_WIDTH}
          fill="none"
        />

        {/* Base Income arc (mint green full ring when data present) */}
        {hasData && (
          <Circle
            cx={CENTER}
            cy={CENTER}
            r={R}
            stroke={colors.mintGreen}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={0}
            rotation={-90}
            origin={`${CENTER},${CENTER}`}
          />
        )}

        {/* Animated Spent arc (peach coral sweeping clockwise from top) */}
        {hasData && (
          <AnimatedCircle
            cx={CENTER}
            cy={CENTER}
            r={R}
            stroke={isOverspent ? colors.danger : colors.peachCoral}
            strokeWidth={STROKE_WIDTH}
            fill="none"
            strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
            strokeDashoffset={spentOffset}
            rotation={-90}
            origin={`${CENTER},${CENTER}`}
            strokeLinecap="round"
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
          {`${displayPercentage}%`}
        </Text>
        <Text style={[styles.labelText, { color: colors.textSecondary }]}>
          SPENT
        </Text>
      </View>
    </Animated.View>
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

