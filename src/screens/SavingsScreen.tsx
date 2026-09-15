import React, { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TextInput,
  Modal,
  TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import {
  Coins,
  Flame,
  Check,
  X,
  Trophy,
  Calendar,
  AlertCircle,
  Sparkles,
  Settings,
  SquarePen,
} from 'lucide-react-native';
import { PiggyBankCoinIcon } from '../components/PiggyBankCoinIcon';
import { format, isYesterday, parseISO, isSameWeek, isSameMonth, isSameYear } from 'date-fns';

import { useDailyBudgetStore, DailyRecord } from '../store/dailyBudgetStore';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import { formatCurrency, formatAmountWithCommas, cleanAmountString } from '../lib/formatters';
import { useScrollDirection } from '../hooks/useScrollDirection';
import { StreakCalendarModal } from '../components/StreakCalendarModal';

const FILTERS = ['All', 'This Week', 'This Month'] as const;
type Filter = (typeof FILTERS)[number];

// ─── Memoized History Record Row for High Performance ─────────────────────────
interface SavingsRecordRowProps {
  rec: DailyRecord;
  colors: ReturnType<typeof useTheme>['colors'];
  isDark: boolean;
}

const SavingsRecordRowBase: React.FC<SavingsRecordRowProps> = ({ rec, colors, isDark }) => {
  const isSaved = rec.saved > 0;
  const isExceeded = rec.status === 'exceeded';

  const dateLabel = useMemo(() => {
    try {
      const dateObj = parseISO(rec.date);
      return isYesterday(dateObj)
        ? `Yesterday, ${format(dateObj, 'd MMM')}`
        : format(dateObj, 'EEE, d MMM yyyy');
    } catch {
      return rec.date;
    }
  }, [rec.date]);

  return (
    <View
      style={[
        styles.recordCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          borderWidth: isDark ? 1 : 0,
        },
      ]}
    >
      <View style={styles.recordLeft}>
        <View
          style={[
            styles.recordIconBox,
            {
              backgroundColor: isSaved
                ? colors.mintGreenSoft
                : isExceeded
                ? isDark
                  ? 'rgba(239, 68, 68, 0.2)'
                  : '#FEE2E2'
                : colors.cardSubtle,
            },
          ]}
        >
          {isSaved ? (
            <Sparkles size={20} color={colors.mintGreenDark} />
          ) : isExceeded ? (
            <AlertCircle size={20} color="#DC2626" />
          ) : (
            <Coins size={20} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.recordDetails}>
          <Text style={[styles.recordDateText, { color: colors.textPrimary }]}>
            {dateLabel}
          </Text>
          <Text style={[styles.recordSubText, { color: colors.textSecondary }]}>
            Spent {formatCurrency(rec.spent)} of {formatCurrency(rec.budget)}
          </Text>
        </View>
      </View>

      {/* Savings Pill */}
      <View
        style={[
          styles.recordSavedPill,
          {
            backgroundColor: isSaved
              ? colors.mintGreenSoft
              : isExceeded
              ? isDark
                ? 'rgba(239, 68, 68, 0.15)'
                : '#FEF2F2'
              : colors.cardSubtle,
          },
        ]}
      >
        <Text
          style={[
            styles.recordSavedText,
            {
              color: isSaved
                ? colors.mintGreenDark
                : isExceeded
                ? '#DC2626'
                : colors.textSecondary,
            },
          ]}
        >
          {isSaved
            ? `+${formatCurrency(rec.saved)} Saved 🎉`
            : isExceeded
            ? `Over by ${formatCurrency(rec.spent - rec.budget)}`
            : `Exact Budget (₹0)`}
        </Text>
      </View>
    </View>
  );
};

const SavingsRecordRow = React.memo(SavingsRecordRowBase);

// ─── Main Savings Screen ──────────────────────────────────────────────────────
export const SavingsScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const handleScroll = useScrollDirection();

  const fetchExpenses = useExpenseStore((s) => s.fetchExpenses);

  // Granular Zustand selectors to prevent unnecessary re-renders
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const isAutoRenew = useDailyBudgetStore((s) => s.isAutoRenew);
  const totalAccumulatedSavings = useDailyBudgetStore((s) => s.totalAccumulatedSavings);
  const savingsStreak = useDailyBudgetStore((s) => s.savingsStreak);
  const bestStreak = useDailyBudgetStore((s) => s.bestStreak);
  const setDailyBudget = useDailyBudgetStore((s) => s.setDailyBudget);
  const toggleAutoRenew = useDailyBudgetStore((s) => s.toggleAutoRenew);
  const setTodayBudget = useDailyBudgetStore((s) => s.setTodayBudget);
  const addToTodayBudget = useDailyBudgetStore((s) => s.addToTodayBudget);
  const syncWithExpenses = useDailyBudgetStore((s) => s.syncWithExpenses);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const getTodayRecord = useDailyBudgetStore((s) => s.getTodayRecord);
  const getPastRecordsList = useDailyBudgetStore((s) => s.getPastRecordsList);

  // Modal states
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [streakCalendarVisible, setStreakCalendarVisible] = useState(false);
  const [inputBudget, setInputBudget] = useState('');
  const [modalMode, setModalMode] = useState<'recurring' | 'today'>('recurring');
  const [activeFilter, setActiveFilter] = useState<Filter>('All');

  useFocusEffect(
    useCallback(() => {
      fetchExpenses().then(() => {
        syncWithExpenses(useExpenseStore.getState().expenses);
      });
    }, [fetchExpenses, syncWithExpenses])
  );

  const todayRecord = useMemo(() => getTodayRecord(), [getTodayRecord, dailyRecords]);
  const pastRecords = useMemo(() => getPastRecordsList(), [getPastRecordsList, dailyRecords]);

  // Filter past records with memoization (Week strictly starts Monday, Month strictly starts on 1st)
  const filteredRecords = useMemo(() => {
    if (activeFilter === 'All') return pastRecords;
    const now = new Date();

    return pastRecords.filter((rec) => {
      try {
        const d = parseISO(rec.date);
        if (activeFilter === 'This Week') {
          return isSameWeek(d, now, { weekStartsOn: 1 });
        } else if (activeFilter === 'This Month') {
          return isSameMonth(d, now) && isSameYear(d, now);
        }
      } catch {
        return false;
      }
      return true;
    });
  }, [pastRecords, activeFilter]);

  // Today calculations
  const savedDaysCount = pastRecords.filter((r) => r.isFinalized && r.saved > 0).length;
  // Guard: if savedDaysCount === 0, streak and bestStreak must be 0
  const effectiveStreak = savedDaysCount === 0 ? 0 : savingsStreak;
  const effectiveBestStreak = savedDaysCount === 0 ? 0 : bestStreak;
  const todayBudget = todayRecord.budget;
  const todaySpent = todayRecord.spent;
  const todayRemaining = Math.max(0, todayBudget - todaySpent);
  const progressRatio = todayBudget > 0 ? Math.min(todaySpent / todayBudget, 1) : 0;
  const isOverBudget = todayBudget > 0 && todaySpent > todayBudget;
  const overAmount = isOverBudget ? todaySpent - todayBudget : 0;

  const handleOpenBudgetModal = useCallback((mode: 'recurring' | 'today') => {
    setModalMode(mode);
    const rawVal =
      mode === 'recurring'
        ? String(dailyBudgetAmount)
        : String(todayBudget > 0 ? todayBudget : dailyBudgetAmount);
    setInputBudget(formatAmountWithCommas(rawVal));
    setBudgetModalVisible(true);
  }, [dailyBudgetAmount, todayBudget]);

  const handleSaveBudget = useCallback(() => {
    const num = parseFloat(cleanAmountString(inputBudget));
    if (!isNaN(num) && num >= 0) {
      if (modalMode === 'recurring') {
        setDailyBudget(num);
      } else {
        setTodayBudget(num);
      }
    }
    setBudgetModalVisible(false);
  }, [inputBudget, modalMode, setDailyBudget, setTodayBudget]);

  const handleTopUp100 = useCallback(() => addToTodayBudget(100), [addToTodayBudget]);
  const handleTopUp200 = useCallback(() => addToTodayBudget(200), [addToTodayBudget]);
  const handleToggleAutoRenew = useCallback((val: boolean) => toggleAutoRenew(val), [toggleAutoRenew]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={isDark ? 'light' : 'dark'} />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: insets.top + 16,
            paddingBottom: insets.bottom + 120,
          },
        ]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.screenSubtitle, { color: colors.textSecondary }]}>
              Savings & Gullak
            </Text>
            <Text style={[styles.screenTitle, { color: colors.textPrimary }]}>
              Daily Savings
            </Text>
          </View>

          {/* Streak Badge (Bonus Feature #2 - Tappable for Calendar) */}
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setStreakCalendarVisible(true)}
            style={[
              styles.streakBadge,
              {
                backgroundColor: isDark ? 'rgba(244, 184, 174, 0.18)' : '#FDEEEC',
                borderColor: colors.peachCoral,
              },
            ]}
          >
            <Flame size={18} color="#E05638" />
            <Text style={[styles.streakBadgeText, { color: '#E05638' }]}>
              {effectiveStreak} Day Streak
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Hero Card: Total Accumulated Savings ── */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          {/* Header Row: Title on Left, Piggy Icon Badge on Right */}
          <View style={styles.heroTopRow}>
            <View style={styles.heroTitleWrap}>
              <Text style={[styles.heroSub, { color: colors.textSecondary }]}>
                Total Lifetime Savings
              </Text>
              <Text style={[styles.heroTitle, { color: colors.textPrimary }]}>
                Your Daily Gullak
              </Text>
            </View>
            <View style={[styles.heroIconWrap, { backgroundColor: colors.mintGreenSoft }]}>
              <PiggyBankCoinIcon size={24} color={colors.mintGreenDark} />
            </View>
          </View>

          {/* Large currency amount with strict alignItems: 'center' per project rule */}
          <View style={styles.heroAmountBlock}>
            <View style={styles.currencyRow}>
              <Text style={[styles.currencySymbol, { color: colors.mintGreenDark }]}>₹</Text>
              <Text style={[styles.heroAmount, { color: colors.textPrimary }]}>
                {Math.round(totalAccumulatedSavings).toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={[styles.heroHelperText, { color: colors.textSecondary }]}>
              Auto-saved from unspent daily allowance
            </Text>
          </View>

          {/* Balanced 2-Column Stat Tiles */}
          <View style={styles.heroStatsRow}>
            <View
              style={[
                styles.heroStatTile,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={[styles.heroStatIconWrap, { backgroundColor: 'rgba(245, 158, 11, 0.12)' }]}>
                <Trophy size={14} color="#F59E0B" />
              </View>
              <View style={styles.heroStatTextWrap}>
                <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>
                  Best Streak
                </Text>
                <Text style={[styles.heroStatValue, { color: colors.textPrimary }]}>
                  {effectiveBestStreak} {effectiveBestStreak === 1 ? 'Day' : 'Days'}
                </Text>
              </View>
            </View>

            <View
              style={[
                styles.heroStatTile,
                {
                  backgroundColor: colors.cardSubtle,
                  borderColor: colors.borderSubtle,
                },
              ]}
            >
              <View style={[styles.heroStatIconWrap, { backgroundColor: colors.mintGreenSoft }]}>
                <Sparkles size={14} color={colors.mintGreenDark} />
              </View>
              <View style={styles.heroStatTextWrap}>
                <Text style={[styles.heroStatLabel, { color: colors.textSecondary }]}>
                  Saved Days
                </Text>
                <Text style={[styles.heroStatValue, { color: colors.textPrimary }]}>
                  {savedDaysCount} {savedDaysCount === 1 ? 'Day' : 'Days'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* ── Today's Live Allowance Tracker Card ── */}
        <View
          style={[
            styles.todayCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          {/* Header */}
          <View style={styles.todayHeader}>
            <View>
              <Text style={[styles.todayDateText, { color: colors.textSecondary }]}>
                Today, {format(new Date(), 'd MMMM')}
              </Text>
              <Text style={[styles.todayTitleText, { color: colors.textPrimary }]}>
                Today's Allowance
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor: isOverBudget
                    ? isDark
                      ? 'rgba(239, 68, 68, 0.2)'
                      : '#FEE2E2'
                    : progressRatio >= 0.8
                    ? isDark
                      ? 'rgba(245, 158, 11, 0.2)'
                      : '#FEF3C7'
                    : colors.mintGreenSoft,
                },
              ]}
            >
              <Text
                style={[
                  styles.statusBadgeText,
                  {
                    color: isOverBudget
                      ? '#DC2626'
                      : progressRatio >= 0.8
                      ? '#D97706'
                      : colors.mintGreenDark,
                  },
                ]}
              >
                {isOverBudget
                  ? 'Over Budget 🚨'
                  : progressRatio >= 0.8
                  ? 'Almost Full ⚠️'
                  : 'On Track 👍'}
              </Text>
            </View>
          </View>

          {/* Today's Remaining & Spent Summary */}
          <View style={styles.todayNumbersRow}>
            <View style={styles.todayNumberBlock}>
              <Text style={[styles.todayNumberLabel, { color: colors.textSecondary }]}>
                {isOverBudget ? 'Exceeded By' : 'Remaining to Spend'}
              </Text>
              <View style={styles.currencyRow}>
                <Text
                  style={[
                    styles.smallCurrencySymbol,
                    { color: isOverBudget ? '#DC2626' : colors.mintGreenDark },
                  ]}
                >
                  ₹
                </Text>
                <Text
                  style={[
                    styles.todayMainNumber,
                    { color: isOverBudget ? '#DC2626' : colors.textPrimary },
                  ]}
                >
                  {isOverBudget
                    ? Math.round(overAmount).toLocaleString('en-IN')
                    : Math.round(todayRemaining).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            <View style={styles.todaySubNumbers}>
              <Text style={[styles.subNumberSpent, { color: colors.textPrimary }]}>
                Spent {formatCurrency(todaySpent)}
              </Text>
              <Text style={[styles.subNumberBudget, { color: colors.textSecondary }]}>
                of {formatCurrency(todayBudget)} budget
              </Text>
            </View>
          </View>

          {/* Sleek 6px Progress Bar */}
          <View style={[styles.progressBarTrack, { backgroundColor: colors.chartTrack }]}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.round(progressRatio * 100)}%`,
                  backgroundColor: isOverBudget
                    ? '#EF4444'
                    : progressRatio >= 0.8
                    ? '#F59E0B'
                    : colors.mintGreen,
                },
              ]}
            />
          </View>

          {/* Single Meaningful Status Hint */}
          <Text style={[styles.progressHint, { color: colors.textSecondary }]}>
            {isOverBudget
              ? '🚨 Daily budget exceeded for today'
              : todayBudget > 0
              ? `✨ Save ₹${Math.round(todayRemaining)} if unspent today`
              : 'Set a daily budget to start saving'}
          </Text>

          {/* Balanced 3-Tile Action Row */}
          <View style={[styles.topUpRow, { borderTopColor: colors.borderSubtle }]}>
            <TouchableOpacity
              style={[
                styles.topUpBtn,
                { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle },
              ]}
              onPress={handleTopUp100}
              activeOpacity={0.7}
            >
              <Text style={[styles.topUpBtnText, { color: colors.textPrimary }]}>+₹100</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.topUpBtn,
                { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle },
              ]}
              onPress={handleTopUp200}
              activeOpacity={0.7}
            >
              <Text style={[styles.topUpBtnText, { color: colors.textPrimary }]}>+₹200</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.topUpBtn,
                { backgroundColor: colors.cardSubtle, borderColor: colors.borderSubtle },
              ]}
              onPress={() => handleOpenBudgetModal('today')}
              activeOpacity={0.7}
            >
              <SquarePen size={12} color={colors.textSecondary} style={{ marginRight: 4 }} />
              <Text style={[styles.topUpBtnText, { color: colors.textPrimary }]}>Edit</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Auto-Renew vs Manual Settings Card ── */}
        <View
          style={[
            styles.settingsCard,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              borderWidth: isDark ? 1 : 0,
            },
          ]}
        >
          <View style={styles.settingsHeader}>
            <View style={styles.settingsTitleRow}>
              <Settings size={20} color={colors.textPrimary} />
              <Text style={[styles.settingsTitle, { color: colors.textPrimary }]}>
                Daily Budget Mode
              </Text>
            </View>

            <Switch
              value={isAutoRenew}
              onValueChange={handleToggleAutoRenew}
              trackColor={{ false: colors.chartTrack, true: colors.mintGreen }}
              thumbColor={isAutoRenew ? colors.forestGreen : '#f4f3f4'}
            />
          </View>

          <Text style={[styles.settingsDesc, { color: colors.textSecondary }]}>
            {isAutoRenew
              ? 'Auto-Add is ON: Every day at midnight, ₹' +
                dailyBudgetAmount +
                ' is added automatically. Whatever you do not spend rolls over into your Daily Savings Gullak.'
              : 'Manual Mode: Auto-add is turned off. You can set or top-up your budget manually for each day whenever you want.'}
          </Text>

          <TouchableOpacity
            style={[
              styles.changeAmountBtn,
              {
                backgroundColor: colors.cardSubtle,
                borderColor: colors.border,
              },
            ]}
            onPress={() => handleOpenBudgetModal('recurring')}
            activeOpacity={0.75}
          >
            <View>
              <Text style={[styles.changeAmountSub, { color: colors.textSecondary }]}>
                Default Daily Allowance
              </Text>
              <View style={styles.currencyRow}>
                <Text style={[styles.smallCurrencySymbol, { color: colors.textPrimary }]}>₹</Text>
                <Text style={[styles.changeAmountText, { color: colors.textPrimary }]}>
                  {dailyBudgetAmount.toLocaleString('en-IN')}
                </Text>
              </View>
            </View>
            <View style={[styles.editPill, { backgroundColor: colors.mintGreenSoft }]}>
              <Text style={[styles.editPillText, { color: colors.mintGreenDark }]}>Change</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Day-by-Day Savings History ── */}
        <View style={styles.historySectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
            Day-by-Day Savings History
          </Text>
        </View>

        {/* Filter Pills */}
        <View style={styles.filterPillsRow}>
          {FILTERS.map((f) => {
            const active = f === activeFilter;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => setActiveFilter(f)}
                style={[
                  styles.filterPill,
                  active
                    ? [styles.filterPillActive, { backgroundColor: colors.mintGreenSoft, borderColor: colors.mintGreen }]
                    : [styles.filterPillInactive, { backgroundColor: colors.card, borderColor: colors.border }],
                ]}
                activeOpacity={0.75}
              >
                <Text
                  style={[
                    styles.filterPillText,
                    active
                      ? [styles.filterPillTextActive, { color: colors.textPrimary }]
                      : [styles.filterPillTextInactive, { color: colors.textSecondary }],
                  ]}
                >
                  {f}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Past Records List */}
        {filteredRecords.length === 0 ? (
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Calendar size={36} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.textPrimary }]}>
              No Past Savings History Yet
            </Text>
            <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
              At the end of each day, any unspent balance from your daily budget will automatically roll into your Savings Gullak and appear right here!
            </Text>
          </View>
        ) : (
          filteredRecords.map((rec) => (
            <SavingsRecordRow
              key={rec.date}
              rec={rec}
              colors={colors}
              isDark={isDark}
            />
          ))
        )}
      </ScrollView>

      {/* ── Edit Budget Modal ── */}
      <Modal
        visible={budgetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {modalMode === 'recurring'
                  ? 'Set Default Daily Allowance'
                  : "Set Today's Budget"}
              </Text>
              <TouchableOpacity
                onPress={() => setBudgetModalVisible(false)}
                hitSlop={10}
              >
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {modalMode === 'recurring'
                ? 'Kitne rupaye roz kharch ke liye budget banana chahte hain?'
                : "Sirf aaj ke liye kitna spending limit set karna chahte hain?"}
            </Text>

            <View style={[styles.modalInputRow, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.modalCurrencySign, { color: colors.textPrimary }]}>₹</Text>
              <TextInput
                style={[styles.modalTextInput, { color: colors.textPrimary }]}
                keyboardType="numeric"
                value={inputBudget}
                onChangeText={(val) => setInputBudget(formatAmountWithCommas(val))}
                placeholder="500"
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
            </View>

            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={() => setBudgetModalVisible(false)}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalSaveBtn, { backgroundColor: colors.mintGreen }]}
                onPress={handleSaveBudget}
              >
                <Check size={18} color={colors.forestGreen} style={{ marginRight: 6 }} />
                <Text style={[styles.modalSaveText, { color: colors.forestGreen }]}>
                  Save Budget
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Interactive Streak Calendar Modal ── */}
      <StreakCalendarModal
        visible={streakCalendarVisible}
        onClose={() => setStreakCalendarVisible(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  screenSubtitle: {
    fontSize: 13,
    fontFamily: 'Quicksand_500Medium',
  },
  screenTitle: {
    fontSize: 26,
    fontFamily: 'Quicksand_700Bold',
    marginTop: -2,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    gap: 4,
  },
  streakBadgeText: {
    fontSize: 12,
    fontFamily: 'Quicksand_700Bold',
  },

  // Hero Card
  heroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  heroTitleWrap: {
    justifyContent: 'center',
  },
  heroSub: {
    fontSize: 11,
    fontFamily: 'Quicksand_500Medium',
    marginBottom: 2,
  },
  heroTitle: {
    fontSize: 17,
    fontFamily: 'Quicksand_700Bold',
  },
  heroIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmountBlock: {
    marginTop: 2,
    marginBottom: 16,
  },
  // Strict rule: wrapping row container has alignItems: 'center'
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  currencySymbol: {
    fontSize: 26,
    fontFamily: 'Quicksand_700Bold',
    marginRight: 4,
  },
  heroAmount: {
    fontSize: 34,
    fontFamily: 'Quicksand_700Bold',
  },
  heroHelperText: {
    fontSize: 11,
    fontFamily: 'Quicksand_500Medium',
    marginTop: 3,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStatTile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  heroStatIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroStatTextWrap: {
    flex: 1,
  },
  heroStatLabel: {
    fontSize: 10,
    fontFamily: 'Quicksand_500Medium',
    marginBottom: 1,
  },
  heroStatValue: {
    fontSize: 13,
    fontFamily: 'Quicksand_700Bold',
  },

  // Today's Allowance Card
  todayCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  todayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  todayDateText: {
    fontSize: 11,
    fontFamily: 'Quicksand_500Medium',
    marginBottom: 2,
  },
  todayTitleText: {
    fontSize: 17,
    fontFamily: 'Quicksand_700Bold',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 11,
    fontFamily: 'Quicksand_700Bold',
  },
  todayNumbersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: 2,
    marginBottom: 12,
  },
  todayNumberBlock: {
    justifyContent: 'center',
  },
  todayNumberLabel: {
    fontSize: 11,
    fontFamily: 'Quicksand_500Medium',
    marginBottom: 2,
  },
  smallCurrencySymbol: {
    fontSize: 20,
    fontFamily: 'Quicksand_700Bold',
    marginRight: 3,
  },
  todayMainNumber: {
    fontSize: 28,
    fontFamily: 'Quicksand_700Bold',
  },
  todaySubNumbers: {
    alignItems: 'flex-end',
    marginBottom: 2,
  },
  subNumberSpent: {
    fontSize: 13,
    fontFamily: 'Quicksand_700Bold',
    marginBottom: 1,
  },
  subNumberBudget: {
    fontSize: 11,
    fontFamily: 'Quicksand_500Medium',
  },

  // Progress Bar
  progressBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressHint: {
    fontSize: 11,
    fontFamily: 'Quicksand_500Medium',
    marginBottom: 14,
  },

  // Top Up Row
  topUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: 1,
    paddingTop: 12,
    gap: 8,
  },
  topUpBtn: {
    flex: 1,
    height: 34,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topUpBtnText: {
    fontSize: 12,
    fontFamily: 'Quicksand_700Bold',
  },

  // Settings Card
  settingsCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 16,
  },
  settingsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  settingsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  settingsTitle: {
    fontSize: 15,
    fontFamily: 'Quicksand_700Bold',
  },
  settingsDesc: {
    fontSize: 12,
    fontFamily: 'Quicksand_500Medium',
    lineHeight: 17,
    marginBottom: 10,
  },
  changeAmountBtn: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  changeAmountSub: {
    fontSize: 11,
    fontFamily: 'Quicksand_500Medium',
    marginBottom: 2,
  },
  changeAmountText: {
    fontSize: 17,
    fontFamily: 'Quicksand_700Bold',
  },
  editPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
  },
  editPillText: {
    fontSize: 11,
    fontFamily: 'Quicksand_700Bold',
  },

  // History Section
  historySectionHeader: {
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontFamily: 'Quicksand_700Bold',
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  filterPillActive: {},
  filterPillInactive: {},
  filterPillText: {
    fontSize: 13,
    fontFamily: 'Quicksand_500Medium',
  },
  filterPillTextActive: {
    fontFamily: 'Quicksand_700Bold',
  },
  filterPillTextInactive: {},

  // Record Cards
  recordCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderRadius: 18,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  recordLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  recordIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordDetails: {
    flex: 1,
  },
  recordDateText: {
    fontSize: 14,
    fontFamily: 'Quicksand_700Bold',
  },
  recordSubText: {
    fontSize: 12,
    fontFamily: 'Quicksand_500Medium',
    marginTop: 2,
  },
  recordSavedPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  recordSavedText: {
    fontSize: 12,
    fontFamily: 'Quicksand_700Bold',
  },

  // Empty state
  emptyCard: {
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    marginTop: 4,
  },
  emptyTitle: {
    fontSize: 16,
    fontFamily: 'Quicksand_700Bold',
    marginTop: 12,
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    fontFamily: 'Quicksand_500Medium',
    textAlign: 'center',
    lineHeight: 18,
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    borderRadius: 24,
    padding: 22,
    borderWidth: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: 'Quicksand_700Bold',
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: 'Quicksand_500Medium',
    marginBottom: 18,
    lineHeight: 18,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 20,
  },
  modalCurrencySign: {
    fontSize: 22,
    fontFamily: 'Quicksand_700Bold',
    marginRight: 6,
  },
  modalTextInput: {
    flex: 1,
    fontSize: 22,
    fontFamily: 'Quicksand_700Bold',
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: 14,
    fontFamily: 'Quicksand_700Bold',
  },
  modalSaveBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
  },
  modalSaveText: {
    fontSize: 14,
    fontFamily: 'Quicksand_700Bold',
  },
});
