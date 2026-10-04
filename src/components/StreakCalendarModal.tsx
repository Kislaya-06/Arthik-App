import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  useAnimatedValue,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { format, parseISO, isToday as checkIsToday, eachDayOfInterval } from 'date-fns';
import { useTheme } from '../store/themeStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../config/supabase';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency } from '../lib/formatters';
import { formatCadenceStreakLabel } from '../lib/budgetModeUtils';
import { computeCalendarConnections } from '../lib/budgetPeriods';
import { StreakFlame } from './StreakFlame';

interface StreakCalendarModalProps {
  visible: boolean;
  onClose: () => void;
}

interface DayLogData {
  date: string;
  status: 'saved' | 'missed' | 'unknown';
  amount: number;
}

interface TooltipState {
  dateStr: string;
  formattedDate: string;
  status: 'saved' | 'missed';
  amount: number;
}

const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const StreakCalendarModal: React.FC<StreakCalendarModalProps> = ({
  visible,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const savingsStreak = useDailyBudgetStore((s) => s.savingsStreak);
  const bestStreak = useDailyBudgetStore((s) => s.bestStreak);
  const bestStreakByCadence = useDailyBudgetStore((s) => s.bestStreakByCadence);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const currentUser = useAuthStore((s) => s.user);

  // Month viewing state
  const [viewingDate, setViewingDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  // Animations: Grid entrance, Tooltip pop
  const gridAnim = useAnimatedValue(0);
  const tooltipAnim = useAnimatedValue(0);

  // Cache fetched month data per 'yyyy-MM' key to avoid re-fetching on navigation
  const monthCache = useRef<Record<string, Record<string, DayLogData>>>({});
  const [monthDataVersion, setMonthDataVersion] = useState(0);

  const viewingYear = viewingDate.getFullYear();
  const viewingMonth = viewingDate.getMonth();
  const monthKey = `${viewingYear}-${String(viewingMonth + 1).padStart(2, '0')}`;

  const now = new Date();
  const isCurrentMonth =
    viewingYear > now.getFullYear() ||
    (viewingYear === now.getFullYear() && viewingMonth >= now.getMonth());

  useEffect(() => {
    if (visible) {
      gridAnim.setValue(0);
      Animated.timing(gridAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }
  }, [visible, monthKey, gridAnim]);

  useEffect(() => {
    if (activeTooltip) {
      tooltipAnim.setValue(0);
      Animated.spring(tooltipAnim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [activeTooltip, tooltipAnim]);

  const currentCadenceBest = bestStreakByCadence?.[budgetCadence] ?? bestStreak;
  const streakPillUnit =
    budgetCadence === 'weekly' ? 'w' : budgetCadence === 'monthly' ? 'm' : 'd';

  // Period navigation handlers
  const handlePrevPeriod = () => {
    setActiveTooltip(null);
    setViewingDate(new Date(viewingYear, viewingMonth - 1, 1));
  };

  const handleNextPeriod = () => {
    setActiveTooltip(null);
    if (isCurrentMonth) return;
    setViewingDate(new Date(viewingYear, viewingMonth + 1, 1));
  };

  const periodNavTitle = format(viewingDate, 'MMMM yyyy');

  // Fetch or retrieve cached data for the current viewing month
  const loadMonthData = useCallback(async () => {
    // 1. Build from local store's dailyRecords & budgetPeriods as immediate offline baseline
    const localMap: Record<string, DayLogData> = {};
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Populate from finalized budgetPeriods (Weekly & Monthly)
    Object.values(budgetPeriods).forEach((period) => {
      if (period.activeStart && period.activeEnd) {
        try {
          const pStart = parseISO(period.activeStart);
          const pEnd = parseISO(period.activeEnd);
          const pDays = eachDayOfInterval({ start: pStart, end: pEnd });
          pDays.forEach((d) => {
            const dStr = format(d, 'yyyy-MM-dd');
            if (dStr.startsWith(monthKey) && dStr < todayStr) {
              if (period.status === 'saved' && period.amountSaved > 0) {
                localMap[dStr] = {
                  date: dStr,
                  status: 'saved',
                  amount: period.amountSaved,
                };
              } else if (period.status === 'missed') {
                localMap[dStr] = {
                  date: dStr,
                  status: 'missed',
                  amount: 0,
                };
              }
            }
          });
        } catch {
          // Skip invalid period dates
        }
      }
    });

    // Daily records take precedence for daily-governed dates
    Object.values(dailyRecords).forEach((rec) => {
      if (rec.date.startsWith(monthKey)) {
        if (rec.isFinalized && rec.date < todayStr) {
          if (rec.status === 'unknown') {
            localMap[rec.date] = {
              date: rec.date,
              status: 'unknown',
              amount: 0,
            };
          } else if (rec.status === 'saved' && rec.saved > 0) {
            localMap[rec.date] = {
              date: rec.date,
              status: 'saved',
              amount: rec.saved,
            };
          } else if (
            rec.status === 'exceeded' ||
            rec.status === 'even' ||
            (rec.budget > 0 && rec.saved === 0)
          ) {
            localMap[rec.date] = {
              date: rec.date,
              status: 'missed',
              amount: 0,
            };
          }
        }
      }
    });

    // If cached, use cached version (merged with local updates taking precedence)
    if (monthCache.current[monthKey]) {
      monthCache.current[monthKey] = { ...monthCache.current[monthKey], ...localMap };
      setMonthDataVersion((v) => v + 1);
      return;
    }

    monthCache.current[monthKey] = localMap;
    setMonthDataVersion((v) => v + 1);

    // 2. Query Supabase daily_savings_log if authenticated
    if (currentUser?.id) {
      try {
        setLoading(true);
        const daysInMonth = new Date(viewingYear, viewingMonth + 1, 0).getDate();
        const startDate = `${monthKey}-01`;
        const endDate = `${monthKey}-${String(daysInMonth).padStart(2, '0')}`;

        const { data, error } = await supabase
          .from('daily_savings_log')
          .select('date, amount_saved, status')
          .eq('user_id', currentUser.id)
          .gte('date', startDate)
          .lte('date', endDate);

        if (!error && data && data.length > 0) {
          const remoteMap: Record<string, DayLogData> = {};
          data.forEach((row: any) => {
            if (row.status === 'unknown') {
              remoteMap[row.date] = {
                date: row.date,
                status: 'unknown',
                amount: 0,
              };
            } else {
              const isSaved = row.status === 'saved' && Number(row.amount_saved) > 0;
              remoteMap[row.date] = {
                date: row.date,
                status: isSaved ? 'saved' : 'missed',
                amount: Number(row.amount_saved) || 0,
              };
            }
          });

          // Merge remote over local
          monthCache.current[monthKey] = { ...localMap, ...remoteMap };
          setMonthDataVersion((v) => v + 1);
        }
      } catch {
        // Fall back gracefully to localMap
      } finally {
        setLoading(false);
      }
    }
  }, [monthKey, viewingYear, viewingMonth, dailyRecords, budgetPeriods, currentUser]);

  useEffect(() => {
    if (visible) {
      loadMonthData();
    } else {
      setActiveTooltip(null);
    }
  }, [visible, monthKey, loadMonthData]);

  // Compute 7-column calendar matrix
  const calendarCells = useMemo(() => {
    const daysInMonth = new Date(viewingYear, viewingMonth + 1, 0).getDate();
    const firstDayOfWeek = new Date(viewingYear, viewingMonth, 1).getDay();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const monthLogs = monthCache.current[monthKey] || {};

    const cells: Array<{
      day: number | null;
      date: Date | null;
      dateStr: string | null;
      isTodayDate: boolean;
      status: 'saved' | 'missed' | 'neutral';
      amount: number;
    }> = [];

    // Leading empty slots
    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({
        day: null,
        date: null,
        dateStr: null,
        isTodayDate: false,
        status: 'neutral',
        amount: 0,
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(viewingYear, viewingMonth, d);
      const dateStr = `${monthKey}-${String(d).padStart(2, '0')}`;
      const isTodayDate = checkIsToday(cellDate);

      const log = monthLogs[dateStr];
      let status: 'saved' | 'missed' | 'neutral' = 'neutral';
      let amount = 0;

      if (log) {
        if (log.status === 'unknown') {
          status = 'neutral';
          amount = 0;
        } else {
          status = log.status;
          amount = log.amount;
        }
      } else if (dateStr < todayStr) {
        // Check if there was any recorded activity in dailyRecords
        const rec = dailyRecords[dateStr];
        if (rec && rec.isFinalized) {
          if (rec.status === 'unknown') {
            status = 'neutral';
            amount = 0;
          } else if (rec.status === 'saved' && rec.saved > 0) {
            status = 'saved';
            amount = rec.saved;
          } else {
            status = 'missed';
            amount = 0;
          }
        }
      }

      cells.push({
        day: d,
        date: cellDate,
        dateStr,
        isTodayDate,
        status,
        amount,
      });
    }

    return cells;
  }, [viewingYear, viewingMonth, monthKey, dailyRecords, monthDataVersion]);

  // Compute Cadence-Aware Connection Metadata for underlay
  const connectionsMap = useMemo(() => {
    return computeCalendarConnections(
      calendarCells,
      planChanges,
      budgetCadence || 'daily',
      isBudgetModeEnabled
    );
  }, [calendarCells, planChanges, budgetCadence, isBudgetModeEnabled]);

  // Handle tapping a day cell
  const handleDayPress = (cell: typeof calendarCells[0]) => {
    if (cell.status === 'neutral' || !cell.date || !cell.dateStr) {
      setActiveTooltip(null);
      return;
    }

    if (activeTooltip && activeTooltip.dateStr === cell.dateStr) {
      setActiveTooltip(null);
      return;
    }

    setActiveTooltip({
      dateStr: cell.dateStr,
      formattedDate: format(cell.date, 'd MMM yyyy'),
      status: cell.status,
      amount: cell.amount,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => setActiveTooltip(null)}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              {/* Header: Title & Close Button */}
              <View style={styles.header}>
                <View style={styles.headerLeft}>
                  <Text
                    style={[
                      styles.headerSubtitle,
                      { color: colors.textSecondary },
                    ]}
                  >
                    SAVINGS & STREAK • BEST: {formatCadenceStreakLabel(currentCadenceBest, budgetCadence).toUpperCase()}
                  </Text>
                  <Text
                    style={[
                      styles.headerTitle,
                      { color: colors.textPrimary },
                    ]}
                  >
                    Streak Calendar
                  </Text>
                </View>

                {/* Top-Right Streak Badge + Close */}
                <View style={styles.headerRight}>
                  <View
                    style={[
                      styles.streakPill,
                      {
                        backgroundColor: isDark ? 'rgba(244, 184, 174, 0.18)' : '#FDEEEC',
                        borderColor: colors.peachCoral,
                      },
                    ]}
                  >
                    <StreakFlame streak={savingsStreak} size={15} />
                    <Text style={[styles.streakPillText, { color: '#E05638' }]}>
                      {savingsStreak}{streakPillUnit}
                    </Text>
                  </View>

                  <Pressable
                    onPress={onClose}
                    hitSlop={8}
                    style={[
                      styles.closeButton,
                      {
                        backgroundColor: colors.cardSubtle,
                        borderColor: colors.borderSubtle,
                      },
                    ]}
                  >
                    <X size={16} color={colors.textSecondary} />
                  </Pressable>
                </View>
              </View>

              {/* Month / Period Navigation Row */}
              <View style={styles.monthNavRow}>
                <Pressable
                  onPress={handlePrevPeriod}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.navArrow,
                    {
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.borderSubtle,
                      opacity: pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ChevronLeft size={18} color={colors.textPrimary} />
                </Pressable>

                <View style={styles.monthLabelWrap}>
                  <Text
                    style={[
                      styles.monthLabel,
                      { color: colors.textPrimary },
                    ]}
                  >
                    {periodNavTitle}
                  </Text>
                  {loading && (
                    <ActivityIndicator size="small" color={colors.mintGreenDark} style={{ marginLeft: 6 }} />
                  )}
                </View>

                <Pressable
                  disabled={isCurrentMonth}
                  onPress={handleNextPeriod}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.navArrow,
                    {
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.borderSubtle,
                      opacity: isCurrentMonth ? 0.25 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ChevronRight size={18} color={isCurrentMonth ? colors.textMuted : colors.textPrimary} />
                </Pressable>
              </View>

              {/* Days of Week Header */}
              <View style={styles.daysOfWeekRow}>
                {DAYS_OF_WEEK.map((d, index) => (
                  <View key={index} style={styles.dayOfWeekCell}>
                    <Text
                      style={[
                        styles.dayOfWeekText,
                        { color: colors.textMuted },
                      ]}
                    >
                      {d}
                    </Text>
                  </View>
                ))}
              </View>

              {/* 7-Column Calendar Grid */}
              <Animated.View
                style={[
                  styles.calendarGrid,
                  {
                    opacity: gridAnim,
                    transform: [
                      {
                        translateY: gridAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [8, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                {calendarCells.map((cell, index) => {
                  if (cell.day === null) {
                    return <View key={`blank-${index}`} style={styles.dayCellWrapper} />;
                  }

                  const connection = cell.dateStr ? connectionsMap[cell.dateStr] : null;
                  const hasLeft = connection?.hasLeftConnection ?? false;
                  const hasRight = connection?.hasRightConnection ?? false;
                  const hasAnyConnection = hasLeft || hasRight;

                  const isSaved = cell.status === 'saved';
                  const isMissed = cell.status === 'missed';
                  const isNeutral = cell.status === 'neutral';
                  const isToday = cell.isTodayDate;
                  const isSelected = activeTooltip?.dateStr === cell.dateStr;

                  // Filled circle background
                  let circleBg = hasAnyConnection ? (isDark ? colors.card : '#FFFFFF') : 'transparent';
                  if (isSaved) circleBg = '#B8E0C8';
                  else if (isMissed) circleBg = '#E08A8A';

                  // Text color: Dark navy on filled colored circles, muted/normal on neutral
                  let textColor = colors.textMuted;
                  if (isSaved || isMissed) {
                    textColor = '#1A2B4C';
                  } else if (isToday) {
                    textColor = colors.textPrimary;
                  }

                  // Ring styling for Today
                  const ringBorderWidth = isToday ? 2 : isSelected ? 2 : 0;
                  const ringBorderColor = isToday
                    ? (isDark ? '#F8FAFC' : '#1A2B4C')
                    : isSelected
                    ? colors.mintGreenDark
                    : 'transparent';

                  // Subtle connection line color matching theme
                  const lineColor = isDark
                    ? 'rgba(255, 255, 255, 0.16)'
                    : 'rgba(0, 0, 0, 0.12)';

                  return (
                    <View key={`day-${cell.dateStr}`} style={styles.dayCellWrapper}>
                      {/* Underlay horizontal connection (left half) */}
                      {hasLeft && (
                        <View
                          style={[
                            styles.connectionLineLeft,
                            { backgroundColor: lineColor },
                          ]}
                        />
                      )}

                      {/* Underlay horizontal connection (right half) */}
                      {hasRight && (
                        <View
                          style={[
                            styles.connectionLineRight,
                            { backgroundColor: lineColor },
                          ]}
                        />
                      )}

                      {/* Foreground Date Circle */}
                      <Pressable
                        disabled={isNeutral}
                        onPress={() => handleDayPress(cell)}
                        style={({ pressed }) => [
                          styles.dayCircle,
                          {
                            backgroundColor: circleBg,
                            borderWidth: ringBorderWidth,
                            borderColor: ringBorderColor,
                            opacity: pressed ? 0.8 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dayText,
                            {
                              color: textColor,
                              fontFamily: isSaved || isMissed || isToday
                                ? FontFamily.bold
                                : FontFamily.semibold,
                            },
                          ]}
                        >
                          {cell.day}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </Animated.View>

              {/* Interactive Tooltip Popover Card */}
              {activeTooltip && (
                <Animated.View
                  style={[
                    styles.tooltipCard,
                    {
                      backgroundColor: isDark ? '#1A263B' : '#F5F6F9',
                      borderColor: activeTooltip.status === 'saved' ? colors.mintGreen : colors.peachCoral,
                      opacity: tooltipAnim,
                      transform: [
                        {
                          scale: tooltipAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.94, 1],
                          }),
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.tooltipIconWrap}>
                    {activeTooltip.status === 'saved' ? (
                      <CheckCircle2 size={16} color={colors.mintGreenDark} />
                    ) : (
                      <AlertCircle size={16} color="#E05638" />
                    )}
                  </View>
                  <View style={styles.tooltipTextWrap}>
                    {activeTooltip.status === 'saved' ? (
                      <Text style={[styles.tooltipTitle, { color: colors.textPrimary }]}>
                        You saved{' '}
                        <Text style={{ color: colors.mintGreenDark, fontFamily: FontFamily.bold }}>
                          {formatCurrency(activeTooltip.amount)}
                        </Text>{' '}
                        on {activeTooltip.formattedDate}
                      </Text>
                    ) : (
                      <Text style={[styles.tooltipTitle, { color: colors.textPrimary }]}>
                        No savings — full allowance spent on {activeTooltip.formattedDate}
                      </Text>
                    )}
                  </View>
                  <Pressable
                    onPress={() => setActiveTooltip(null)}
                    hitSlop={6}
                    style={styles.tooltipClose}
                  >
                    <X size={13} color={colors.textSecondary} />
                  </Pressable>
                </Animated.View>
              )}

              {/* Legend Row at Bottom */}
              <View style={[styles.legendRow, { borderTopColor: colors.borderSubtle }]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#B8E0C8' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Saved
                  </Text>
                </View>

                <View style={styles.legendDivider} />

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#E08A8A' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Missed
                  </Text>
                </View>

                <View style={styles.legendDivider} />

                <View style={styles.legendItem}>
                  <View
                    style={[
                      styles.legendRing,
                      { borderColor: isDark ? '#F8FAFC' : '#1A2B4C' },
                    ]}
                  />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Today
                  </Text>
                </View>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.gutter,
  },
  card: {
    width: '100%',
    borderRadius: BorderRadius.cardLarge,
    borderWidth: 1,
    padding: Spacing.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.group,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.element,
  },
  headerSubtitle: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: FontSize.titleMedium,
    fontFamily: FontFamily.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    gap: 4,
  },
  streakPillText: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.group,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  daysOfWeekRow: {
    flexDirection: 'row',
    marginBottom: Spacing.element,
  },
  dayOfWeekCell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.micro,
  },
  dayOfWeekText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.bold,
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: Spacing.group,
  },
  dayCellWrapper: {
    width: '14.28%',
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  connectionLineLeft: {
    position: 'absolute',
    top: '50%',
    marginTop: -1.5,
    height: 3,
    left: 0,
    right: '50%',
    zIndex: 0,
  },
  connectionLineRight: {
    position: 'absolute',
    top: '50%',
    marginTop: -1.5,
    height: 3,
    left: '50%',
    right: 0,
    zIndex: 0,
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  dayText: {
    fontSize: 13,
  },
  tooltipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: Spacing.group,
    marginBottom: 14,
    gap: Spacing.element,
  },
  tooltipIconWrap: {
    marginTop: 1,
  },
  tooltipTextWrap: {
    flex: 1,
  },
  tooltipTitle: {
    fontSize: FontSize.caption,
    lineHeight: 17,
    fontFamily: FontFamily.semibold,
  },
  tooltipClose: {
    padding: 2,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    gap: Spacing.group,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: BorderRadius.pill,
  },
  legendRing: {
    width: 9,
    height: 9,
    borderRadius: BorderRadius.pill,
    borderWidth: 1.5,
  },
  legendText: {
    fontSize: 11,
    fontFamily: FontFamily.semibold,
  },
  legendDivider: {
    width: 3,
    height: 3,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(148, 163, 184, 0.4)',
  },
});
