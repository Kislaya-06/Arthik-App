import React, { useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
  Easing,
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
  // Animated height driver for smooth pill fill transitions
  const animValue = useRef(new Animated.Value(0)).current;

  // Entrance animation whenever data / triggerKey changes
  useEffect(() => {
    animValue.setValue(0);
    Animated.spring(animValue, {
      toValue: 1,
      tension: 60,
      friction: 8,
      useNativeDriver: false,
    }).start();
  }, [triggerKey]);

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

        {/* Trend badge (matching reference design) */}
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
              <TrendingUp size={12} color={isDark ? '#F4B8AE' : '#E8956A'} />
            ) : (
              <TrendingDown size={12} color={isDark ? '#B8E0C8' : colors.mintGreenDark} />
            )}
            <Text
              style={[
                styles.trendText,
                {
                  color: isIncrease
                    ? (isDark ? '#F4B8AE' : '#E8956A')
                    : (isDark ? '#B8E0C8' : colors.mintGreenDark),
                  fontFamily: FontFamily.bold,
                },
              ]}
            >
              {isIncrease ? `+${percentageChange}%` : `-${percentageChange}%`}
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

          const animatedTranslateY = animValue.interpolate({
            inputRange: [0, 1],
            outputRange: [DEFAULT_TRACK_HEIGHT, DEFAULT_TRACK_HEIGHT - targetHeight],
          });

          return (
            <Pressable
              key={d.day}
              style={styles.column}
              onPress={() => onDayPress?.(d)}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              accessibilityRole="button"
              accessibilityLabel={`${d.day}: ${formatCurrency(d.amount)}`}
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
                {d.amount > 0 ? (
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
                        <LinearGradient id={`grad_${d.day}`} x1="0" y1="0" x2="0" y2="1">
                          <Stop offset="0" stopColor={gradStart} />
                          <Stop offset="1" stopColor={gradEnd} />
                        </LinearGradient>
                      </Defs>
                      <Rect
                        width={trackWidth}
                        height={DEFAULT_TRACK_HEIGHT}
                        rx={trackWidth / 2}
                        ry={trackWidth / 2}
                        fill={`url(#grad_${d.day})`}
                      />
                    </Svg>
                  </Animated.View>
                ) : null}
              </View>

              {/* Day / Week Label (e.g. MON, TUE or W1, W2) */}
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
                {d.day.toUpperCase()}
              </Text>

              {/* Optional sub-label (e.g. '1–7' for Monthly weeks) */}
              {d.subLabel ? (
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
                  {d.subLabel}
                </Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    marginTop: Spacing.section,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.gutter,
  },
  titleContainer: {
    flex: 1,
    marginRight: Spacing.element,
  },
  title: {
    fontSize: 18,
  },
  subTitle: {
    fontSize: FontSize.bodySmall,
    marginTop: Spacing.nano,
  },
  trendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.element,
    paddingVertical: Spacing.micro,
    gap: Spacing.nano + 1,
  },
  trendText: {
    fontSize: 11,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.nano,
  },
  column: {
    alignItems: 'center',
    flex: 1,
  },
  track: {
    height: DEFAULT_TRACK_HEIGHT,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  fillBar: {
    borderRadius: BorderRadius.pill,
  },
  dayLabel: {
    marginTop: 10,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  subDateLabel: {
    fontSize: 9,
    marginTop: 2,
    letterSpacing: 0.2,
  },
});
