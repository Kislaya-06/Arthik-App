import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Animated,
  ScrollView,
  useAnimatedValue,
} from 'react-native';
import { X, Check, Clock } from 'lucide-react-native';
import { format, parseISO, addDays, eachDayOfInterval } from 'date-fns';
import Svg, { Defs, Rect, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useExpenseStore } from '../store/expenseStore';
import {
  formatAmountWithCommas,
  cleanAmountString,
  formatCurrency,
  round2,
} from '../lib/formatters';
import { applyKeypadPress } from '../lib/amountKeypad';
import {
  formatEffectiveFrom,
} from '../lib/budgetModeUtils';
import { computeEffectiveFrom, getPeriodBounds, isFirstDayFirstEnable } from '../lib/budgetPeriods';
import { useAuthStore } from '../store/authStore';
import { getUserCreatedAtLocalDate } from '../store/dailyBudget/metrics';
import { computeSpentByDate } from '../lib/budgetCalculations';
import { buildEligibleIncomeClassifier } from '../store/dailyBudget/classifiers';
import { BudgetCadence } from '../types';
import { isCountedExpense } from '../lib/transactionUtils';
import { MoneyExplainerTopic } from '../lib/moneyExplainerContent';
import { MoneyHelpBadge, MoneyExplainerModal } from './MoneyExplainerModal';
import { CadenceSwitchModal } from './CadenceSwitchModal';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight } from '../config/theme';
import { SegmentedControl } from './ui/SegmentedControl';
import { KeypadGrid } from './ui/KeypadGrid';

export interface BudgetEditModalProps {
  visible: boolean;
  mode?: 'recurring';
  initialAmount?: number;
  initialCadence?: BudgetCadence;
  onClose: () => void;
}

const CADENCE_OPTIONS: Array<{ key: BudgetCadence; label: string }> = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

export const BudgetEditModal: React.FC<BudgetEditModalProps> = ({
  visible,
  initialAmount = 0,
  initialCadence,
  onClose,
}) => {
  const sheetAnim = useAnimatedValue(0);

  // Store state
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const weeklyBudgetAmount = useDailyBudgetStore((s) => s.weeklyBudgetAmount);
  const monthlyBudgetAmount = useDailyBudgetStore((s) => s.monthlyBudgetAmount);
  const dailyRecords = useDailyBudgetStore((s) => s.dailyRecords);
  const planChanges = useDailyBudgetStore((s) => s.planChanges);
  const getPendingPlanChange = useDailyBudgetStore((s) => s.getPendingPlanChange);

  // Store actions
  const setDailyBudget = useDailyBudgetStore((s) => s.setDailyBudget);
  const scheduleNextDailyBudget = useDailyBudgetStore((s) => s.scheduleNextDailyBudget);
  const setWeeklyBudget = useDailyBudgetStore((s) => s.setWeeklyBudget);
  const setMonthlyBudget = useDailyBudgetStore((s) => s.setMonthlyBudget);
  const setBudgetCadence = useDailyBudgetStore((s) => s.setBudgetCadence);
  const setBudgetModeEnabled = useDailyBudgetStore((s) => s.setBudgetModeEnabled);
  const userCreatedAt = useAuthStore((s) => s.user?.created_at);
  const cancelPendingPlanChange = useDailyBudgetStore((s) => s.cancelPendingPlanChange);

  // Local form state
  const [selectedCadence, setSelectedCadence] = useState<BudgetCadence>(
    initialCadence || budgetCadence || 'daily'
  );
  const [amountStr, setAmountStr] = useState('');
  const [showMoneyExplainer, setShowMoneyExplainer] = useState(false);
  const [showCadenceSwitchModal, setShowCadenceSwitchModal] = useState(false);
  const [modalSize, setModalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  const expenses = useExpenseStore((s) => s.expenses);

  const pendingChange = useMemo(() => getPendingPlanChange(), [getPendingPlanChange, planChanges]);



  // Sync state on modal open
  useEffect(() => {
    if (visible) {
      const activeCadence = initialCadence || budgetCadence || 'daily';
      setSelectedCadence(activeCadence);

      const defaultAmount =
        initialAmount > 0
          ? initialAmount
          : activeCadence === 'weekly'
          ? weeklyBudgetAmount
          : activeCadence === 'monthly'
          ? monthlyBudgetAmount
          : dailyBudgetAmount;

      setAmountStr(defaultAmount > 0 ? String(defaultAmount) : '');
      sheetAnim.setValue(0);
      Animated.spring(sheetAnim, {
        toValue: 1,
        tension: 70,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [
    visible,
    initialAmount,
    initialCadence,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    sheetAnim,
  ]);

  // When cadence segment changes, prefill that cadence's existing configured budget
  const handleSelectCadence = useCallback(
    (newCadence: BudgetCadence) => {
      setSelectedCadence(newCadence);
      const existingForCadence =
        newCadence === 'weekly'
          ? weeklyBudgetAmount
          : newCadence === 'monthly'
          ? monthlyBudgetAmount
          : dailyBudgetAmount;
      if (existingForCadence > 0) {
        setAmountStr(String(existingForCadence));
      }
    },
    [dailyBudgetAmount, weeklyBudgetAmount, monthlyBudgetAmount]
  );

  const handleKeyPress = useCallback((val: string) => {
    setAmountStr((prev) =>
      applyKeypadPress(prev, val, { maxIntegerDigits: 8, maxDecimals: 2 })
    );
  }, []);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [visible]);

  // What can really be carried into a new cadence: the money left in the running budget (weekly / monthly), or
  // carried money that is still unused. A daily day has nothing to carry (today's unused money goes to Gullak).
  const getCarryableAmount = useDailyBudgetStore((s) => s.getCarryableAmount);
  const carryableAmount = useMemo(
    () => (typeof getCarryableAmount === 'function' ? getCarryableAmount() : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [getCarryableAmount, expenses, planChanges, dailyRecords, budgetCadence, visible]
  );

  // Spent calculations for current period (zero-spend allows immediate budget modification)
  const isIncomeFn = useMemo(() => buildEligibleIncomeClassifier(), []);
  const spentByDate = useMemo(() => computeSpentByDate(expenses, isIncomeFn), [expenses, isIncomeFn]);

  const todaySpent = useMemo(() => {
    const rec = dailyRecords[todayStr];
    if (rec && typeof rec.spent === 'number') return rec.spent;
    return spentByDate[todayStr] || 0;
  }, [dailyRecords, todayStr, spentByDate]);

  const currentWeekSpent = useMemo(() => {
    const bounds = getPeriodBounds('weekly', todayStr);
    const days = eachDayOfInterval({
      start: parseISO(bounds.start),
      end: parseISO(todayStr),
    });
    let sum = 0;
    for (const d of days) {
      const dStr = format(d, 'yyyy-MM-dd');
      sum += spentByDate[dStr] || 0;
    }
    return round2(sum);
  }, [spentByDate, todayStr]);

  const currentMonthSpent = useMemo(() => {
    const bounds = getPeriodBounds('monthly', todayStr);
    const days = eachDayOfInterval({
      start: parseISO(bounds.start),
      end: parseISO(todayStr),
    });
    let sum = 0;
    for (const d of days) {
      const dStr = format(d, 'yyyy-MM-dd');
      sum += spentByDate[dStr] || 0;
    }
    return round2(sum);
  }, [spentByDate, todayStr]);

  // Compute effective date
  const totalExpenseCount = useMemo(() => expenses.filter((e) => isCountedExpense(e)).length, [expenses]);
  const userCreatedAtStr = getUserCreatedAtLocalDate(userCreatedAt);
  const isFirstEnable = !isBudgetModeEnabled && isFirstDayFirstEnable(planChanges, todayStr, userCreatedAtStr, totalExpenseCount);
  const effectiveFromStr = useMemo(() => {
    if (!isBudgetModeEnabled) {
      return computeEffectiveFrom('enable', todayStr, { changes: planChanges, userCreatedAtStr, totalExpenseCount });
    }
    if (selectedCadence !== budgetCadence) {
      return computeEffectiveFrom('cadence_switch', todayStr, { currentOwner: budgetCadence });
    }
    if (selectedCadence === 'daily') {
      return todaySpent === 0
        ? todayStr
        : format(addDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
    }
    if (selectedCadence === 'weekly') {
      return currentWeekSpent === 0
        ? todayStr
        : computeEffectiveFrom('weekly_amount', todayStr);
    }
    return currentMonthSpent === 0
      ? todayStr
      : computeEffectiveFrom('monthly_amount', todayStr);
  }, [
    isBudgetModeEnabled,
    planChanges,
    userCreatedAtStr,
    totalExpenseCount,
    selectedCadence,
    budgetCadence,
    todayStr,
    todaySpent,
    currentWeekSpent,
    currentMonthSpent,
  ]);

  const effectiveFromLabel = useMemo(() => {
    return formatEffectiveFrom(effectiveFromStr, todayStr, selectedCadence, isFirstEnable);
  }, [effectiveFromStr, todayStr, selectedCadence, isFirstEnable]);

  const evaluatedAmount = useMemo(() => {
    const clean = cleanAmountString(amountStr);
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }, [amountStr]);

  const explainerTopic: MoneyExplainerTopic = useMemo(() => {
    if (selectedCadence !== budgetCadence && isBudgetModeEnabled) {
      return 'cadence_switch';
    }
    return 'rollover_savings';
  }, [selectedCadence, budgetCadence, isBudgetModeEnabled]);

  const handleSave = useCallback(() => {
    if (evaluatedAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a budget amount greater than ₹0.');
      return;
    }
    if (evaluatedAmount > 100_000_000) {
      Alert.alert('Limit Exceeded', 'Budget amount cannot exceed ₹10,00,00,000.');
      return;
    }

    if (!isBudgetModeEnabled) {
      // First enable: applies today; Re-enabling existing user schedules tomorrow (PUR-003)
      if (selectedCadence === 'daily') {
        setDailyBudget(evaluatedAmount);
      } else if (selectedCadence === 'weekly') {
        setWeeklyBudget(evaluatedAmount);
      } else {
        setMonthlyBudget(evaluatedAmount);
      }
      setBudgetCadence(selectedCadence);
      setBudgetModeEnabled(true, { cadence: selectedCadence, amount: evaluatedAmount });
      onClose();
      return;
    }

    // Already enabled: changing cadence
    if (selectedCadence !== budgetCadence) {
      setShowCadenceSwitchModal(true);
      return;
    }

    // Same cadence: updating amount
    if (selectedCadence === 'daily') {
      if (dailyBudgetAmount > 0 && evaluatedAmount !== dailyBudgetAmount) {
        if (todaySpent > 0) {
          Alert.alert(
            'Change Daily Budget?',
            `You have spent ${formatCurrency(todaySpent)} today. Your new daily budget (${formatCurrency(evaluatedAmount)}) will take effect tomorrow at 12:00 AM. Today's budget (${formatCurrency(dailyBudgetAmount)}) remains active.\n\nDo you want to confirm?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Change',
                onPress: () => {
                  scheduleNextDailyBudget(evaluatedAmount);
                  onClose();
                },
              },
            ]
          );
          return;
        }
      }
      if (pendingChange) {
        cancelPendingPlanChange();
      }
      setDailyBudget(evaluatedAmount);
    } else if (selectedCadence === 'weekly') {
      if (weeklyBudgetAmount > 0 && evaluatedAmount !== weeklyBudgetAmount) {
        if (currentWeekSpent > 0) {
          Alert.alert(
            'Change Weekly Budget?',
            `You have spent ${formatCurrency(currentWeekSpent)} this week. Your new budget of ${formatCurrency(evaluatedAmount)} will take effect next Monday at 12:00 AM. Your current budget (${formatCurrency(weeklyBudgetAmount)}) stays active until Sunday.\n\nDo you want to confirm?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Change',
                onPress: () => {
                  setWeeklyBudget(evaluatedAmount);
                  onClose();
                },
              },
            ]
          );
          return;
        }
      }
      if (pendingChange) {
        cancelPendingPlanChange();
      }
      setWeeklyBudget(evaluatedAmount, { immediate: true });
    } else {
      if (monthlyBudgetAmount > 0 && evaluatedAmount !== monthlyBudgetAmount) {
        if (currentMonthSpent > 0) {
          Alert.alert(
            'Change Monthly Budget?',
            `You have spent ${formatCurrency(currentMonthSpent)} this month. Your new budget of ${formatCurrency(evaluatedAmount)} will take effect on the 1st of next month at 12:00 AM. Your current budget (${formatCurrency(monthlyBudgetAmount)}) stays active until then.\n\nDo you want to confirm?`,
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Yes, Change',
                onPress: () => {
                  setMonthlyBudget(evaluatedAmount);
                  onClose();
                },
              },
            ]
          );
          return;
        }
      }
      if (pendingChange) {
        cancelPendingPlanChange();
      }
      setMonthlyBudget(evaluatedAmount, { immediate: true });
    }
    onClose();
  }, [
    evaluatedAmount,
    isBudgetModeEnabled,
    selectedCadence,
    budgetCadence,
    dailyBudgetAmount,
    weeklyBudgetAmount,
    monthlyBudgetAmount,
    todaySpent,
    currentWeekSpent,
    currentMonthSpent,
    pendingChange,
    cancelPendingPlanChange,
    effectiveFromLabel,
    setDailyBudget,
    setWeeklyBudget,
    setMonthlyBudget,
    setBudgetCadence,
    setBudgetModeEnabled,
    scheduleNextDailyBudget,
    onClose,
  ]);



  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <Animated.View
          style={[
            styles.modalContent,
            {
              backgroundColor: '#581C87',
              borderColor: 'rgba(255, 255, 255, 0.15)',
              borderWidth: 1,
              opacity: sheetAnim,
              transform: [
                {
                  translateY: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [36, 0],
                  }),
                },
                {
                  scale: sheetAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.95, 1],
                  }),
                },
              ],
            },
          ]}
          onLayout={(e) => {
            const { width, height } = e.nativeEvent.layout;
            if (width > 0 && height > 0 && (width !== modalSize.width || height !== modalSize.height)) {
              setModalSize({ width, height });
            }
          }}
        >
          {/* Violet Gradient Backdrop matching Gullak Hero Card */}
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Svg
              key={`budget_modal_${modalSize.width}_${modalSize.height}`}
              width={modalSize.width || '100%'}
              height={modalSize.height ? modalSize.height + 6 : '100%'}
              style={StyleSheet.absoluteFill}
            >
              <Defs>
                <SvgLinearGradient id="budgetModalGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <Stop offset="0%" stopColor="#8B5CF6" />
                  <Stop offset="100%" stopColor="#581C87" />
                </SvgLinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width={modalSize.width || '100%'}
                height={modalSize.height ? modalSize.height + 6 : '100%'}
                fill="url(#budgetModalGrad)"
              />
            </Svg>
          </View>

          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Text style={[styles.modalTitle, { color: '#FFFFFF' }]}>
                  {isBudgetModeEnabled ? 'Change Budget Plan' : 'Set Smart Budget'}
                </Text>
                <MoneyHelpBadge
                  style={{ marginLeft: Spacing.element }}
                  onPress={() => setShowMoneyExplainer(true)}
                />
              </View>
              <TouchableOpacity
                onPress={onClose}
                hitSlop={12}
                style={[
                  styles.closeBtn,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  },
                ]}
              >
                <X size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            {/* Subtitle / Effective From Notice */}
            <Text style={[styles.modalSubtitle, { color: 'rgba(255, 255, 255, 0.75)' }]}>
              {effectiveFromLabel}
            </Text>

            {/* Pending Plan Change Banner (if exists) */}
            {pendingChange && (
              <View
                style={[
                  styles.pendingBanner,
                  {
                    backgroundColor: 'rgba(251, 191, 36, 0.15)',
                    borderColor: 'rgba(251, 191, 36, 0.35)',
                  },
                ]}
              >
                <Clock size={16} color="#FDE68A" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pendingBannerTitle, { color: '#FDE68A' }]}>
                    Scheduled Change Pending
                  </Text>
                  <Text style={[styles.pendingBannerSubtitle, { color: 'rgba(255, 255, 255, 0.85)' }]}>
                    {`${pendingChange.cadence.charAt(0).toUpperCase() + pendingChange.cadence.slice(1)} · ${formatCurrency(pendingChange.amount)} (${formatEffectiveFrom(pendingChange.effectiveFrom, todayStr, pendingChange.cadence)})`}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.cancelPendingBtn}
                  onPress={() => {
                    Alert.alert(
                      'Cancel Scheduled Change?',
                      'Do you want to discard this pending budget change?',
                      [
                        { text: 'Keep', style: 'cancel' },
                        {
                          text: 'Yes, Cancel',
                          style: 'destructive',
                          onPress: cancelPendingPlanChange,
                        },
                      ]
                    );
                  }}
                  hitSlop={6}
                >
                  <Text style={styles.cancelPendingText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* 3-Segment Cadence Toggle (Unified SegmentedControl) */}
            <View style={{ marginBottom: Spacing.block }}>
              <SegmentedControl
                options={CADENCE_OPTIONS.map((opt) => ({ key: opt.key, label: opt.label }))}
                selectedKey={selectedCadence}
                onChange={(key) => handleSelectCadence(key as BudgetCadence)}
                height={ControlHeight.standard}
                backgroundColor="rgba(255, 255, 255, 0.12)"
                borderColor="rgba(255, 255, 255, 0.2)"
                activePillColor="#FFFFFF"
                activeTextColor="#581C87"
                inactiveTextColor="rgba(255, 255, 255, 0.85)"
              />
            </View>

            {/* Prominent Amount Display Row */}
            <View
              style={[
                styles.modalInputRow,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
              ]}
            >
              <Text style={[styles.modalCurrencySign, { color: '#FFFFFF' }]}>₹</Text>
              <Text
                style={[
                  styles.modalAmountDisplay,
                  {
                    color: amountStr ? '#FFFFFF' : 'rgba(255, 255, 255, 0.4)',
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {amountStr ? formatAmountWithCommas(amountStr) : '0'}
              </Text>
            </View>

            {/* Tactile Keypad */}
            <KeypadGrid
              onKeyPress={handleKeyPress}
              buttonHeight={46}
              fontSize={20}
              gap={6}
              style={{ marginBottom: Spacing.surface }}
            />

            {/* Actions: Cancel & Save */}
            <View style={styles.modalActionRow}>
              <TouchableOpacity
                style={[
                  styles.modalCancelBtn,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.12)',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                  },
                ]}
                onPress={onClose}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalCancelText, { color: '#FFFFFF' }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  {
                    backgroundColor: evaluatedAmount > 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.15)',
                    borderColor: evaluatedAmount > 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.2)',
                    opacity: evaluatedAmount > 0 ? 1 : 0.6,
                  },
                ]}
                onPress={handleSave}
                disabled={evaluatedAmount <= 0}
                activeOpacity={0.8}
              >
                <Check
                  size={18}
                  color={evaluatedAmount > 0 ? '#581C87' : 'rgba(255, 255, 255, 0.4)'}
                  style={{ marginRight: 6 }}
                />
                <Text
                  style={[
                    styles.modalSaveText,
                    { color: evaluatedAmount > 0 ? '#581C87' : 'rgba(255, 255, 255, 0.4)' },
                  ]}
                >
                  Save Budget
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>

      <MoneyExplainerModal
        visible={showMoneyExplainer}
        topic={explainerTopic}
        onClose={() => setShowMoneyExplainer(false)}
      />

      <CadenceSwitchModal
        visible={showCadenceSwitchModal}
        currentCadence={budgetCadence}
        targetCadence={selectedCadence}
        initialTargetAmount={evaluatedAmount}
        currentBudget={carryableAmount}
        currentSpent={0}
        onConfirmSwitch={({ targetCadence: tc, amount, carryMode, carriedOverAmount }) => {
          if (tc === 'daily') setDailyBudget(amount);
          else if (tc === 'weekly') setWeeklyBudget(amount);
          else setMonthlyBudget(amount);
          setBudgetCadence(tc, { amount, carryMode, carriedOverAmount });
          setShowCadenceSwitchModal(false);
          onClose();
        }}
        onClose={() => setShowCadenceSwitchModal(false)}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.gutter,
  },
  modalContent: {
    width: '100%',
    maxHeight: '92%',
    borderRadius: BorderRadius.cardLarge,
    padding: 20,
    borderWidth: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.nano,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: Spacing.element,
  },
  modalTitle: {
    fontSize: FontSize.cta,
    fontFamily: FontFamily.bold,
  },
  modalSubtitle: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    marginBottom: Spacing.group,
    lineHeight: 18,
  },
  pendingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    marginBottom: Spacing.group,
  },
  pendingBannerTitle: {
    fontSize: 12,
    fontFamily: FontFamily.bold,
  },
  pendingBannerSubtitle: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    marginTop: 1,
  },
  cancelPendingBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    marginLeft: 8,
  },
  cancelPendingText: {
    fontSize: 11,
    fontFamily: FontFamily.bold,
    color: '#DC2626',
  },
  cadenceToggleContainer: {
    flexDirection: 'row',
    borderRadius: BorderRadius.pill,
    padding: 4,
    borderWidth: 1,
    position: 'relative',
    marginBottom: Spacing.surface,
  },
  cadenceSlidingPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    bottom: 4,
    borderRadius: BorderRadius.pill,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  cadenceSegment: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  cadenceSegmentText: {
    fontSize: 13,
  },
  modalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    paddingHorizontal: Spacing.block,
    paddingVertical: Spacing.element,
    marginBottom: Spacing.group,
  },
  modalCurrencySign: {
    fontSize: 26,
    fontFamily: FontFamily.bold,
    marginRight: 6,
  },
  modalAmountDisplay: {
    flex: 1,
    fontSize: 26,
    fontFamily: FontFamily.bold,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.group,
  },
  modalCancelBtn: {
    flex: 1,
    height: ControlHeight.row,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  modalSaveBtn: {
    flex: 1,
    height: ControlHeight.row,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSaveText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
});
