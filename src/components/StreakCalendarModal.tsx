import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
  ActivityIndicator,
  TouchableWithoutFeedback,
  Animated,
  Easing,
  ScrollView,
} from 'react-native';
import { ChevronLeft, ChevronRight, X, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { format, isToday as checkIsToday, parseISO } from 'date-fns';
import { useTheme } from '../store/themeStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useAuthStore } from '../store/authStore';
import { useExpenseStore } from '../store/expenseStore';
import { useCategoryStore, Category } from '../store/categoryStore';
import { supabase } from '../config/supabase';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency, formatAmountWithCommas } from '../lib/formatters';
import { isIncomeTransaction } from '../lib/paymentUtils';
import {
  buildWeeklyStreakCards,
  buildMonthlyStreakMatrix,
  formatCadenceStreakLabel,
} from '../lib/budgetModeUtils';
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
  const budgetPeriods = useDailyBudgetStore((s) => s.budgetPeriods);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const currentUser = useAuthStore((s) => s.user);
  const expenses = useExpenseStore((s) => s.expenses);
  const categories = useCategoryStore((s) => s.categories);

  // Month viewing state
  const [viewingDate, setViewingDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  // Animations: Grid entrance, Tooltip pop
  const gridAnim = useRef(new Animated.Value(0)).current;
  const tooltipAnim = useRef(new Animated.Value(0)).current;

  // Cache fetched month data per 'yyyy-MM' key to avoid re-fetching on navigation
  const monthCache = useRef<Record<string, Record<string, DayLogData>>>({});
  const [monthDataVersion, setMonthDataVersion] = useState(0);

  const viewingYear = viewingDate.getFullYear();
  const viewingMonth = viewingDate.getMonth();
  const monthKey = `${viewingYear}-${String(viewingMonth + 1).padStart(2, '0')}`;

  const now = new Date();
  const isCurrentMonth = viewingYear > now.getFullYear() || (viewingYear === now.getFullYear() && viewingMonth >= now.getMonth());

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

  const catMap = useMemo(() => {
    const m: Record<string, Category> = {};
    for (const c of categories) m[c.id] = c;
    return m;
  }, [categories]);

  const spentByDate = useMemo(() => {
    const map: Record<string, number> = {};
    for (let i = 0; i < expenses.length; i++) {
      const e = expenses[i];
      const cat = e.category_id ? catMap[e.category_id] : undefined;
      if (isIncomeTransaction(e, cat)) continue;
      const cleanDate = e.expense_date?.split('T')[0]?.trim();
      if (!cleanDate) continue;
      map[cleanDate] = (map[cleanDate] || 0) + (Number(e.amount) || 0);
    }
    return map;
  }, [expenses, catMap]);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), []);

  const weeklyCards = useMemo(() => {
    if (budgetCadence !== 'weekly') return [];
    return buildWeeklyStreakCards(planChanges, budgetPeriods, spentByDate, todayStr, 8);
  }, [budgetCadence, planChanges, budgetPeriods, spentByDate, todayStr]);

  const monthlyCells = useMemo(() => {
    if (budgetCadence !== 'monthly') return [];
    return buildMonthlyStreakMatrix(planChanges, budgetPeriods, spentByDate, todayStr, viewingYear);
  }, [budgetCadence, planChanges, budgetPeriods, spentByDate, todayStr, viewingYear]);

  const currentCadenceBest = bestStreakByCadence?.[budgetCadence] ?? bestStreak;
  const streakPillUnit = budgetCadence === 'weekly' ? 'w' : budgetCadence === 'monthly' ? 'm' : 'd';

  const pulseAnim = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.4, duration: 800, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [pulseAnim]);

  const isCurrentYear = viewingYear >= now.getFullYear();

  // Period navigation handlers
  const handlePrevPeriod = () => {
    setActiveTooltip(null);
    if (budgetCadence === 'daily') {
      setViewingDate(new Date(viewingYear, viewingMonth - 1, 1));
    } else if (budgetCadence === 'monthly') {
      setViewingDate(new Date(viewingYear - 1, 0, 1));
    }
  };

  const handleNextPeriod = () => {
    setActiveTooltip(null);
    if (budgetCadence === 'daily') {
      if (isCurrentMonth) return;
      setViewingDate(new Date(viewingYear, viewingMonth + 1, 1));
    } else if (budgetCadence === 'monthly') {
      if (isCurrentYear) return;
      setViewingDate(new Date(viewingYear + 1, 0, 1));
    }
  };

  const isNextDisabled =
    budgetCadence === 'daily'
      ? isCurrentMonth
      : budgetCadence === 'monthly'
      ? isCurrentYear
      : true;

  const periodNavTitle = useMemo(() => {
    if (budgetCadence === 'daily') {
      return format(viewingDate, 'MMMM yyyy');
    }
    if (budgetCadence === 'weekly') {
      return 'Last 8 weeks';
    }
    return String(viewingYear);
  }, [budgetCadence, viewingDate, viewingYear]);

  // Fetch or retrieve cached data for the current viewing month
  const loadMonthData = useCallback(async () => {
    // 1. Build from local store's dailyRecords as immediate offline baseline
    const localMap: Record<string, DayLogData> = {};
    const todayStr = format(new Date(), 'yyyy-MM-dd');

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
          } else if (rec.status === 'exceeded' || rec.status === 'even' || (rec.budget > 0 && rec.saved === 0)) {
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
  }, [monthKey, viewingYear, viewingMonth, dailyRecords, currentUser]);

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
                  disabled={budgetCadence === 'weekly'}
                  onPress={handlePrevPeriod}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.navArrow,
                    {
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.borderSubtle,
                      opacity: budgetCadence === 'weekly' ? 0.25 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ChevronLeft size={18} color={budgetCadence === 'weekly' ? colors.textMuted : colors.textPrimary} />
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
                  {loading && budgetCadence === 'daily' && (
                    <ActivityIndicator size="small" color={colors.mintGreenDark} style={{ marginLeft: 6 }} />
                  )}
                </View>

                <Pressable
                  disabled={isNextDisabled}
                  onPress={handleNextPeriod}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.navArrow,
                    {
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.borderSubtle,
                      opacity: isNextDisabled ? 0.25 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <ChevronRight size={18} color={isNextDisabled ? colors.textMuted : colors.textPrimary} />
                </Pressable>
              </View>

              {budgetCadence === 'daily' && (
                <>
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

                  const isSaved = cell.status === 'saved';
                  const isMissed = cell.status === 'missed';
                  const isNeutral = cell.status === 'neutral';
                  const isToday = cell.isTodayDate;
                  const isSelected = activeTooltip?.dateStr === cell.dateStr;

                  // Filled circle background
                  let circleBg = 'transparent';
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

                  return (
                    <View key={`day-${cell.dateStr}`} style={styles.dayCellWrapper}>
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
            </>
          )}

          {/* Weekly Cadence: Vertical Week Cards */}
          {budgetCadence === 'weekly' && (
            <>
              <ScrollView
                style={styles.weeklyScroll}
                contentContainerStyle={styles.weeklyScrollContent}
                showsVerticalScrollIndicator={false}
                nestedScrollEnabled
              >
                {weeklyCards.map((card) => {
                  const isSaved = card.status === 'saved' || card.status === 'on_track';
                  const isMissed = card.status === 'missed' || card.status === 'over';
                  const isPaused = card.status === 'paused';

                  const badgeBg = isPaused
                    ? isDark ? 'rgba(148, 163, 184, 0.15)' : '#F1F5F9'
                    : isMissed
                    ? isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2'
                    : isSaved
                    ? isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5'
                    : isDark ? 'rgba(148, 163, 184, 0.1)' : '#F8FAFC';

                  const badgeColor = isPaused
                    ? colors.textMuted
                    : isMissed
                    ? '#EF4444'
                    : isSaved
                    ? colors.mintGreenDark
                    : colors.textSecondary;

                  return (
                    <View
                      key={card.key}
                      style={[
                        styles.weekCard,
                        {
                          backgroundColor: card.isCurrentWeek
                            ? isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4'
                            : colors.cardSubtle,
                          borderColor: card.isCurrentWeek
                            ? colors.mintGreen
                            : colors.borderSubtle,
                        },
                      ]}
                    >
                      <View style={styles.weekCardHeader}>
                        <View style={styles.weekCardMeta}>
                          <Text style={[styles.weekCardTitle, { color: colors.textPrimary }]}>
                            {card.weekLabel}
                          </Text>
                          <Text style={[styles.weekCardSubtitle, { color: colors.textMuted }]}>
                            {card.dateRange}
                          </Text>
                        </View>

                        {card.isCurrentWeek ? (
                          <Animated.View
                            style={[
                              styles.weekBadge,
                              { backgroundColor: badgeBg, opacity: pulseAnim },
                            ]}
                          >
                            <Text style={[styles.weekBadgeText, { color: badgeColor, fontFamily: FontFamily.bold }]}>
                              {card.badgeText}
                            </Text>
                          </Animated.View>
                        ) : (
                          <View style={[styles.weekBadge, { backgroundColor: badgeBg }]}>
                            <Text style={[styles.weekBadgeText, { color: badgeColor, fontFamily: FontFamily.semibold }]}>
                              {card.badgeText}
                            </Text>
                          </View>
                        )}
                      </View>

                      {/* Micro progress bar */}
                      {!isPaused && card.budget > 0 && (
                        <View style={styles.microProgressWrap}>
                          <View style={[styles.microProgressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                            <View
                              style={[
                                styles.microProgressFill,
                                {
                                  width: `${Math.min(100, Math.round(card.progressRatio * 100))}%`,
                                  backgroundColor: isMissed ? '#EF4444' : colors.mintGreen,
                                },
                              ]}
                            />
                          </View>
                          <View style={styles.microProgressMeta}>
                            <Text style={[styles.microProgressLabel, { color: colors.textMuted }]}>
                              Spent {formatCurrency(card.spent)} of {formatCurrency(card.budget)}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                })}
              </ScrollView>

              {/* Weekly Legend */}
              <View style={[styles.legendRow, { borderTopColor: colors.borderSubtle }]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#B8E0C8' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    On Track / Saved
                  </Text>
                </View>

                <View style={styles.legendDivider} />

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#E08A8A' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Over
                  </Text>
                </View>

                <View style={styles.legendDivider} />

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Paused
                  </Text>
                </View>
              </View>
            </>
          )}

          {/* Monthly Cadence: 12-Month Matrix */}
          {budgetCadence === 'monthly' && (
            <>
              <View style={styles.monthlyGrid}>
                {monthlyCells.map((cell) => {
                  const isCurrent = cell.status === 'current';
                  const isFuture = cell.status === 'future';
                  const isPaused = cell.status === 'paused';
                  const isSaved = cell.status === 'saved';
                  const isMissed = cell.status === 'missed';

                  return (
                    <View
                      key={cell.monthKey}
                      style={[
                        styles.monthCell,
                        {
                          backgroundColor: isCurrent
                            ? isDark ? 'rgba(16, 185, 129, 0.08)' : '#F0FDF4'
                            : colors.cardSubtle,
                          borderColor: isCurrent
                            ? colors.mintGreen
                            : colors.borderSubtle,
                          opacity: isFuture ? 0.35 : 1,
                        },
                      ]}
                    >
                      <Text style={[styles.monthCellName, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                        {cell.monthName}
                      </Text>

                      {isSaved && (
                        <View style={[styles.monthCellBadge, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.15)' : '#ECFDF5' }]}>
                          <Text style={[styles.monthCellBadgeText, { color: colors.mintGreenDark }]}>
                            +₹{cell.amountSaved >= 1000 ? `${(cell.amountSaved / 1000).toFixed(cell.amountSaved % 1000 === 0 ? 0 : 1)}k` : cell.amountSaved}
                          </Text>
                        </View>
                      )}

                      {isMissed && (
                        <View style={[styles.monthCellBadge, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEE2E2' }]}>
                          <Text style={[styles.monthCellBadgeText, { color: '#EF4444' }]}>
                            Missed
                          </Text>
                        </View>
                      )}

                      {isPaused && (
                        <Text style={[styles.monthCellPausedText, { color: colors.textMuted }]}>
                          Paused
                        </Text>
                      )}

                      {isCurrent && (
                        <View style={styles.monthCellCurrentWrap}>
                          <Text
                            style={[
                              styles.monthCellCurrentText,
                              { color: cell.spent > cell.budget && cell.budget > 0 ? '#EF4444' : colors.mintGreenDark },
                            ]}
                          >
                            {cell.badgeText}
                          </Text>
                          {cell.budget > 0 && (
                            <View style={[styles.microProgressTrack, { backgroundColor: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', height: 3, marginTop: 3 }]}>
                              <View
                                style={[
                                  styles.microProgressFill,
                                  {
                                    width: `${Math.min(100, Math.round(cell.progressRatio * 100))}%`,
                                    backgroundColor: cell.spent > cell.budget && cell.budget > 0 ? '#EF4444' : colors.mintGreen,
                                  },
                                ]}
                              />
                            </View>
                          )}
                        </View>
                      )}

                      {(isFuture || cell.status === 'untracked') && (
                        <Text style={[styles.monthCellFutureText, { color: colors.textMuted }]}>—</Text>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Monthly Legend */}
              <View style={[styles.legendRow, { borderTopColor: colors.borderSubtle }]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#B8E0C8' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Saved / On Track
                  </Text>
                </View>

                <View style={styles.legendDivider} />

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: '#E08A8A' }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Missed / Over
                  </Text>
                </View>

                <View style={styles.legendDivider} />

                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.textMuted }]} />
                  <Text style={[styles.legendText, { color: colors.textSecondary }]}>
                    Paused
                  </Text>
                </View>
              </View>
            </>
          )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.block,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: BorderRadius.cardLarge,
    borderWidth: 1,
    padding: Spacing.surface,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
      },
      android: {
        elevation: 14,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.block,
  },
  headerLeft: {
    flex: 1,
  },
  headerSubtitle: {
    fontSize: 10,
    letterSpacing: 1,
    fontFamily: FontFamily.bold,
    textTransform: 'uppercase',
    marginBottom: Spacing.nano,
  },
  headerTitle: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.element,
  },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.micro,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    overflow: 'visible',
  },
  streakPillText: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.caption,
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
    marginBottom: 14,
    paddingHorizontal: Spacing.micro,
  },
  monthLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  monthLabel: {
    fontSize: 15,
    fontFamily: FontFamily.bold,
  },
  navArrow: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
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
  },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
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
  weeklyScroll: {
    maxHeight: 310,
    marginBottom: Spacing.group,
  },
  weeklyScrollContent: {
    gap: Spacing.element,
    paddingVertical: 2,
  },
  weekCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.group,
  },
  weekCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekCardMeta: {
    flex: 1,
    marginRight: Spacing.element,
  },
  weekCardTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  weekCardSubtitle: {
    fontSize: 11,
    fontFamily: FontFamily.regular,
    marginTop: 1,
  },
  weekBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: BorderRadius.pill,
  },
  weekBadgeText: {
    fontSize: 11,
  },
  microProgressWrap: {
    marginTop: Spacing.element,
  },
  microProgressTrack: {
    height: 5,
    borderRadius: 2.5,
    width: '100%',
    overflow: 'hidden',
  },
  microProgressFill: {
    height: '100%',
    borderRadius: 2.5,
  },
  microProgressMeta: {
    marginTop: 3,
  },
  microProgressLabel: {
    fontSize: 10,
    fontFamily: FontFamily.medium,
  },
  monthlyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: Spacing.group,
  },
  monthCell: {
    width: '31%',
    height: 68,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    padding: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  monthCellName: {
    fontSize: 13,
  },
  monthCellBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
    marginTop: 3,
  },
  monthCellBadgeText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
  },
  monthCellPausedText: {
    fontSize: 10,
    fontFamily: FontFamily.regular,
    marginTop: 4,
  },
  monthCellCurrentWrap: {
    width: '100%',
    alignItems: 'center',
    marginTop: 3,
  },
  monthCellCurrentText: {
    fontSize: 10,
    fontFamily: FontFamily.bold,
  },
  monthCellFutureText: {
    fontSize: 12,
    marginTop: 3,
  },
});
