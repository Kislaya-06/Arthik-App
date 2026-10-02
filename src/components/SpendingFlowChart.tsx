import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import {
  ThemeColors,
  FontFamily,
  FontSize,
  Spacing,
  BorderRadius,
} from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { calculatePillFillHeight } from '../lib/chartUtils';

export interface SpendingDayData {
  day: string;
  dateStr: string;
  amount: number;
  subLabel?: string;
  startDate?: string;
  endDate?: string;
}

export interface SpendingFlowChartProps {
  title?: string;
  data: SpendingDayData[];
  maxDay: SpendingDayData | null;
  percentageChange?: number;
  isIncrease?: boolean;
  isDark: boolean;
  colors: ThemeColors;
  subTitle?: string;
  trackWidth?: number;
  onDayPress?: (item: SpendingDayData) => void;
  triggerKey?: string | number;
}

const DEFAULT_TRACK_HEIGHT = 130;
const DEFAULT_TRACK_WIDTH = 32;
const MIN_FILL_HEIGHT = 28;

interface FlowBarColumnProps {
  item: SpendingDayData;
  targetHeight: number;
  trackWidth: number;
  isPeak: boolean;
  isDark: boolean;
  colors: ThemeColors;
  gradStart: string;
  gradEnd: string;
  onPress?: () => void;
}

const FlowBarColumn: React.FC<FlowBarColumnProps> = React.memo(({
  item,
  targetHeight,
  trackWidth,
  isPeak,
  isDark,
  colors,
  gradStart,
  gradEnd,
  onPress,
}) => {
  const heightAnim = useRef(new Animated.Value(targetHeight)).current;

  useEffect(() => {
    // Value-to-value continuous transition without resetting to zero
    Animated.spring(heightAnim, {
      toValue: targetHeight,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [targetHeight, heightAnim]);

  const animatedTranslateY = heightAnim.interpolate({
    inputRange: [0, DEFAULT_TRACK_HEIGHT],
    outputRange: [DEFAULT_TRACK_HEIGHT, 0],
    extrapolate: 'clamp',
  });

  return (
    <Pressable
      style={styles.column}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
      accessibilityRole="button"
      accessibilityLabel={`${item.day}: ${formatCurrency(item.amount)}`}
    >
      {/* Outer vertical capsule track */}
      <View
        style={[
          styles.track,
          {
            width: trackWidth,
            backgroundColor: isDark
              ? 'rgba(255, 255, 255, 0.05)'
              : colors.chartTrack,
          },
        ]}
      >
        {/* Inner animated fill pill with SVG gradient mask */}
        {item.amount > 0 ? (
          <Animated.View
            style={[
              styles.fillBar,
              {
                width: trackWidth,
                height: DEFAULT_TRACK_HEIGHT,
                transform: [{ translateY: animatedTranslateY }],
              },
            ]}
          >
            <Svg width={trackWidth} height={DEFAULT_TRACK_HEIGHT}>
              <Defs>
                <LinearGradient id={`grad_${item.day}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor={gradStart} />
                  <Stop offset="100%" stopColor={gradEnd} />
                </LinearGradient>
              </Defs>
              <Rect
                width={trackWidth}
                height={DEFAULT_TRACK_HEIGHT}
                rx={trackWidth / 2}
                ry={trackWidth / 2}
                fill={`url(#grad_${item.day})`}
              />
            </Svg>
          </Animated.View>
        ) : null}
      </View>

      {/* Day / Week Label */}
      <Text
        style={[
          styles.dayLabel,
          {
            color: isPeak
              ? (isDark ? colors.mintGreen : colors.mintGreenDark)
              : (isDark ? colors.textMuted : colors.textSecondary),
            fontFamily: isPeak ? FontFamily.bold : FontFamily.medium,
          },
        ]}
      >
        {item.day.toUpperCase()}
      </Text>

      {/* Optional sub-label */}
      {item.subLabel ? (
        <Text
          style={[
            styles.subDateLabel,
            {
              color: isDark ? colors.textMuted : colors.textSecondary,
              fontFamily: FontFamily.regular,
            },
          ]}
          numberOfLines={1}
        >
          {item.subLabel}
        </Text>
      ) : null}
    </Pressable>
  );
});

export const SpendingFlowChart: React.FC<SpendingFlowChartProps> = ({
  title = 'Spending Flow',
  data,
  maxDay,
  percentageChange,
  isIncrease = false,
  isDark,
  colors,
  subTitle,
  trackWidth = DEFAULT_TRACK_WIDTH,
  onDayPress,
  triggerKey,
}) => {
  // Calculate highest amount in the set
  const maxAmount = useMemo(() => {
    return Math.max(...data.map((d) => d.amount), 0);
  }, [data]);

  const gradStart = isDark ? '#ADEBB3' : '#7CD49A';
  const gradEnd = isDark ? '#3DA862' : '#2E8C4A';

  return (
    <View style={styles.card}>
      {/* ── Card Header ── */}
      <View style={styles.headerRow}>
        <View style={styles.titleContainer}>
          <Text style={[styles.title, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
            {title}
          </Text>
          {subTitle ? (
            <Text style={[styles.subTitle, { color: colors.textSecondary, fontFamily: FontFamily.medium }]}>
              {subTitle}
            </Text>
          ) : null}
        </View>

        {/* Trend badge */}
        {percentageChange !== undefined && (
          <View
            style={[
              styles.trendBadge,
              {
                backgroundColor: isIncrease
                  ? (isDark ? 'rgba(244, 184, 174, 0.14)' : '#FDEEEC')
                  : (isDark ? 'rgba(184, 224, 200, 0.14)' : '#E8F5EE'),
              },
            ]}
          >
            {isIncrease ? (
              <TrendingUp size={14} color={colors.coral} />
            ) : (
              <TrendingDown size={14} color={isDark ? colors.mintGreen : colors.mintGreenDark} />
            )}
            <Text
              style={[
                styles.trendText,
                {
                  color: isIncrease
                    ? colors.coral
                    : (isDark ? colors.mintGreen : colors.mintGreenDark),
                  fontFamily: FontFamily.bold,
                },
              ]}
            >
              {Math.abs(percentageChange)}% {isIncrease ? 'more' : 'less'}
            </Text>
          </View>
        )}
      </View>

      {/* ── Capsule Columns ── */}
      <View style={styles.chartContainer}>
        {data.map((d) => {
          const isPeak = maxDay?.day === d.day && d.amount > 0;
          const targetHeight = calculatePillFillHeight(
            d.amount,
            maxAmount,
            DEFAULT_TRACK_HEIGHT,
            MIN_FILL_HEIGHT
          );

          return (
            <FlowBarColumn
              key={d.day}
              item={d}
              targetHeight={targetHeight}
              trackWidth={trackWidth}
              isPeak={isPeak}
              isDark={isDark}
              colors={colors}
              gradStart={gradStart}
              gradEnd={gradEnd}
              onPress={() => onDayPress?.(d)}
            />
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingVertical: Spacing.gutter,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.card,
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.section,
    paddingHorizontal: 8,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.titleMedium,
    lineHeight: FontSize.titleMedium * 1.25,
    letterSpacing: -0.2,
  },
  subTitle: {
    fontSize: FontSize.bodySmall,
    marginTop: 2,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.pill,
  },
  trendText: {
    fontSize: FontSize.caption,
  },
  chartContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: DEFAULT_TRACK_HEIGHT + 44,
  },
  column: {
    flex: 1,
    alignItems: 'center',
  },
  track: {
    height: DEFAULT_TRACK_HEIGHT,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'flex-end',
  },
  fillBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
  },
  dayLabel: {
    fontSize: FontSize.caption,
    marginTop: 8,
    textAlign: 'center',
  },
  subDateLabel: {
    fontSize: 9,
    marginTop: 1,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
});

export default SpendingFlowChart;
