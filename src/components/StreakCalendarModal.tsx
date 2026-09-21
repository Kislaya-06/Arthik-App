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
} from 'react-native';
import { ChevronLeft, ChevronRight, Flame, X, CheckCircle2, AlertCircle } from 'lucide-react-native';
import { format, isToday as checkIsToday, parseISO } from 'date-fns';
import { useTheme } from '../store/themeStore';
import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useAuthStore } from '../store/authStore';
import { supabase } from '../config/supabase';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';
import { formatCurrency } from '../lib/formatters';

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
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const currentUser = useAuthStore((s) => s.user);

  // Month viewing state
  const [viewingDate, setViewingDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [activeTooltip, setActiveTooltip] = useState<TooltipState | null>(null);

  // Cache fetched month data per 'yyyy-MM' key to avoid re-fetching on navigation
  const monthCache = useRef<Record<string, Record<string, DayLogData>>>({});
  const [monthDataVersion, setMonthDataVersion] = useState(0);

  const viewingYear = viewingDate.getFullYear();
  const viewingMonth = viewingDate.getMonth();
  const monthKey = `${viewingYear}-${String(viewingMonth + 1).padStart(2, '0')}`;

  const now = new Date();
  const isCurrentMonth = viewingYear > now.getFullYear() || (viewingYear === now.getFullYear() && viewingMonth >= now.getMonth());

  // Month navigation handlers
  const handlePrevMonth = () => {
    setActiveTooltip(null);
    setViewingDate(new Date(viewingYear, viewingMonth - 1, 1));
  };

  const handleNextMonth = () => {
    if (isCurrentMonth) return;
    setActiveTooltip(null);
    setViewingDate(new Date(viewingYear, viewingMonth + 1, 1));
  };

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
                    SAVINGS & STREAK
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
                    <Flame size={14} color="#E05638" />
                    <Text style={[styles.streakPillText, { color: '#E05638' }]}>
                      {savingsStreak}d
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

              {/* Month Navigation Row */}
              <View style={styles.monthNavRow}>
                <Pressable
                  onPress={handlePrevMonth}
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
                    {format(viewingDate, 'MMMM yyyy')}
                  </Text>
                  {loading && (
                    <ActivityIndicator size="small" color={colors.mintGreenDark} style={{ marginLeft: 6 }} />
                  )}
                </View>

                <Pressable
                  disabled={isCurrentMonth}
                  onPress={handleNextMonth}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.navArrow,
                    {
                      backgroundColor: colors.cardSubtle,
                      borderColor: colors.borderSubtle,
                      opacity: isCurrentMonth ? 0.3 : pressed ? 0.7 : 1,
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
              <View style={styles.calendarGrid}>
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
              </View>

              {/* Interactive Tooltip Popover Card */}
              {activeTooltip && (
                <View
                  style={[
                    styles.tooltipCard,
                    {
                      backgroundColor: isDark ? '#1A263B' : '#F5F6F9',
                      borderColor: activeTooltip.status === 'saved' ? colors.mintGreen : colors.peachCoral,
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
                </View>
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
});
