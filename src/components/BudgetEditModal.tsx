import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Alert,
  Animated,
  Dimensions,
  ScrollView,
} from 'react-native';
import { X, Check, Clock, Sparkles } from 'lucide-react-native';
import { format, parseISO, addDays } from 'date-fns';
import Svg, { Defs, Rect, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';

import { useDailyBudgetStore } from '../store/dailyBudgetStore';
import { useExpenseStore } from '../store/expenseStore';
import { useTheme } from '../store/themeStore';
import {
  formatAmountWithCommas,
  cleanAmountString,
  formatCurrency,
} from '../lib/formatters';
import { applyKeypadPress } from '../lib/amountKeypad';
import {
  formatEffectiveFrom,
  getProrationPreview,
} from '../lib/budgetModeUtils';
import { computeEffectiveFrom, getPeriodBounds } from '../lib/budgetPeriods';
import { BudgetCadence } from '../types';
import { KeyButton } from './KeyButton';
import { MoneyHelpBadge, MoneyExplainerModal } from './MoneyExplainerModal';
import { CadenceSwitchModal } from './CadenceSwitchModal';
import { Spacing, BorderRadius, FontSize, FontFamily } from '../config/theme';

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

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
];

export const BudgetEditModal: React.FC<BudgetEditModalProps> = ({
  visible,
  initialAmount = 0,
  initialCadence,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const sheetAnim = useRef(new Animated.Value(0)).current;

  // Store state
  const isBudgetModeEnabled = useDailyBudgetStore((s) => s.isBudgetModeEnabled);
  const budgetCadence = useDailyBudgetStore((s) => s.budgetCadence);
  const dailyBudgetAmount = useDailyBudgetStore((s) => s.dailyBudgetAmount);
  const weeklyBudgetAmount = useDailyBudgetStore((s) => s.weeklyBudgetAmount);
  const monthlyBudgetAmount = useDailyBudgetStore((s) => s.monthlyBudgetAmount);
  const pendingChange = useDailyBudgetStore((s) => s.getPendingPlanChange());

  // Store actions
  const setDailyBudget = useDailyBudgetStore((s) => s.setDailyBudget);
  const scheduleNextDailyBudget = useDailyBudgetStore((s) => s.scheduleNextDailyBudget);
  const setWeeklyBudget = useDailyBudgetStore((s) => s.setWeeklyBudget);
  const setMonthlyBudget = useDailyBudgetStore((s) => s.setMonthlyBudget);
  const setBudgetCadence = useDailyBudgetStore((s) => s.setBudgetCadence);
  const setBudgetModeEnabled = useDailyBudgetStore((s) => s.setBudgetModeEnabled);
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
  const todayRecord = useDailyBudgetStore((s) => s.getTodayRecord());

  // 3-Segment sliding pill animation
  const cadenceIndex = CADENCE_OPTIONS.findIndex((c) => c.key === selectedCadence);
  const slideAnim = useRef(new Animated.Value(cadenceIndex >= 0 ? cadenceIndex : 0)).current;
  const [toggleWidth, setToggleWidth] = useState(0);

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: cadenceIndex >= 0 ? cadenceIndex : 0,
      tension: 70,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [cadenceIndex, slideAnim]);

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

  const currentCadenceBudget = useMemo(() => {
    if (budgetCadence === 'daily') return todayRecord.budget || dailyBudgetAmount;
    if (budgetCadence === 'weekly') return weeklyBudgetAmount;
    return monthlyBudgetAmount;
  }, [budgetCadence, todayRecord.budget, dailyBudgetAmount, weeklyBudgetAmount, monthlyBudgetAmount]);

  const currentCadenceSpent = useMemo(() => {
    if (budgetCadence === 'daily') return todayRecord.spent || 0;
    const bounds = getPeriodBounds(budgetCadence, todayStr);
    return expenses
      .filter(
        (e) =>
          e.type !== 'income' &&
          e.expense_date &&
          e.expense_date >= bounds.start &&
          e.expense_date <= todayStr
      )
      .reduce((s, e) => s + (Number(e.amount) || 0), 0);
  }, [budgetCadence, todayRecord.spent, expenses, todayStr]);

  // Compute effective date
  const effectiveFromStr = useMemo(() => {
    if (!isBudgetModeEnabled) {
      return todayStr;
    }
    if (selectedCadence !== budgetCadence) {
      return computeEffectiveFrom('cadence_switch', todayStr, { currentOwner: budgetCadence });
    }
    if (selectedCadence === 'daily') {
      return format(addDays(parseISO(todayStr), 1), 'yyyy-MM-dd');
    }
    if (selectedCadence === 'weekly') {
      return computeEffectiveFrom('weekly_amount', todayStr);
    }
    return computeEffectiveFrom('monthly_amount', todayStr);
  }, [isBudgetModeEnabled, selectedCadence, budgetCadence, todayStr]);

  const effectiveFromLabel = useMemo(() => {
    return formatEffectiveFrom(effectiveFromStr, todayStr, selectedCadence, !isBudgetModeEnabled);
  }, [effectiveFromStr, todayStr, selectedCadence, isBudgetModeEnabled]);

  const evaluatedAmount = useMemo(() => {
    const clean = cleanAmountString(amountStr);
    const parsed = parseFloat(clean);
    return isNaN(parsed) ? 0 : parsed;
  }, [amountStr]);

  // One-line proration preview (D4)
  const prorationPreview = useMemo(() => {
    if (evaluatedAmount <= 0) return null;
    return getProrationPreview(selectedCadence, evaluatedAmount, effectiveFromStr, todayStr);
  }, [selectedCadence, evaluatedAmount, effectiveFromStr, todayStr]);

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
      // First enable: applies today
      if (selectedCadence === 'daily') {
        setDailyBudget(evaluatedAmount);
      } else if (selectedCadence === 'weekly') {
        setWeeklyBudget(evaluatedAmount);
      } else {
        setMonthlyBudget(evaluatedAmount);
      }
      setBudgetCadence(selectedCadence);
      setBudgetModeEnabled(true);
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
        Alert.alert(
          'Change Daily Budget?',
          `Your new daily budget (${formatCurrency(evaluatedAmount)}) will take effect tomorrow at 12:00 AM. Today's budget (${formatCurrency(dailyBudgetAmount)}) remains active.\n\nDo you want to confirm?`,
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
      setDailyBudget(evaluatedAmount);
    } else if (selectedCadence === 'weekly') {
      setWeeklyBudget(evaluatedAmount);
    } else {
      setMonthlyBudget(evaluatedAmount);
    }
    onClose();
  }, [
    evaluatedAmount,
    isBudgetModeEnabled,
    selectedCadence,
    budgetCadence,
    dailyBudgetAmount,
    effectiveFromLabel,
    setDailyBudget,
    setWeeklyBudget,
    setMonthlyBudget,
    setBudgetCadence,
    setBudgetModeEnabled,
    scheduleNextDailyBudget,
    onClose,
  ]);

  const segmentWidth = toggleWidth > 0 ? (toggleWidth - 8) / 3 : 0;
  const translateX = slideAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: [0, segmentWidth, segmentWidth * 2],
  });

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
                  highlight={Boolean(prorationPreview)}
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

            {/* 3-Segment Cadence Toggle (Bouncy pill) */}
            <View
              style={[
                styles.cadenceToggleContainer,
                {
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                },
              ]}
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w > 0 && Math.abs(w - toggleWidth) > 1) {
                  setToggleWidth(w);
                }
              }}
            >
              {segmentWidth > 0 && (
                <Animated.View
                  style={[
                    styles.cadenceSlidingPill,
                    {
                      width: segmentWidth,
                      backgroundColor: '#FFFFFF',
                      transform: [{ translateX }],
                    },
                  ]}
                />
              )}

              {CADENCE_OPTIONS.map((opt) => {
                const isSelected = selectedCadence === opt.key;
                return (
                  <TouchableOpacity
                    key={opt.key}
                    style={styles.cadenceSegment}
                    activeOpacity={0.8}
                    onPress={() => handleSelectCadence(opt.key)}
                  >
                    <Text
                      style={[
                        styles.cadenceSegmentText,
                        {
                          color: isSelected ? '#581C87' : 'rgba(255, 255, 255, 0.8)',
                          fontFamily: isSelected ? FontFamily.bold : FontFamily.medium,
                        },
                      ]}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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

            {/* Proration Preview (Prorated allowance + crystal clear explanation) */}
            {prorationPreview && (
              <View
                style={[
                  styles.prorationCard,
                  {
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    borderColor: 'rgba(255, 255, 255, 0.35)',
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.prorationHeaderRow}
                  activeOpacity={0.75}
                  onPress={() => setShowMoneyExplainer(true)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <Sparkles
                      size={14}
                      color="#FFFFFF"
                      style={{ marginRight: 6 }}
                    />
                    <Text
                      style={[
                        styles.prorationTitle,
                        { color: '#FFFFFF' },
                      ]}
                    >
                      {prorationPreview.previewText}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text
                  style={[
                    styles.prorationExplanation,
                    { color: 'rgba(255, 255, 255, 0.85)' },
                  ]}
                >
                  {prorationPreview.explanationText}
                </Text>
              </View>
            )}

            {/* Tactile Keypad */}
            <View style={styles.keypadContainer}>
              {KEYPAD_ROWS.map((row, rIdx) => (
                <View key={rIdx} style={styles.keypadRow}>
                  {row.map((k) => (
                    <View key={k} style={styles.keypadKeyWrapper}>
                      <KeyButton
                        item={k}
                        onPress={handleKeyPress}
                        height={46}
                        fontSize={20}
                      />
                    </View>
                  ))}
                </View>
              ))}
            </View>

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
        topic="cadence_switch"
        onClose={() => setShowMoneyExplainer(false)}
      />

      <CadenceSwitchModal
        visible={showCadenceSwitchModal}
        currentCadence={budgetCadence}
        targetCadence={selectedCadence}
        initialTargetAmount={evaluatedAmount}
        currentBudget={currentCadenceBudget}
        currentSpent={currentCadenceSpent}
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
  prorationCard: {
    paddingHorizontal: Spacing.group,
    paddingVertical: 10,
    borderRadius: BorderRadius.input,
    borderWidth: 1,
    marginBottom: Spacing.group,
    gap: 4,
  },
  prorationHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  prorationTitle: {
    fontSize: 14,
    fontFamily: FontFamily.bold,
    flex: 1,
  },
  prorationExplanation: {
    fontSize: 13,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
    paddingLeft: 20,
  },
  keypadContainer: {
    marginBottom: Spacing.surface,
    gap: 6,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 6,
  },
  keypadKeyWrapper: {
    flex: 1,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: Spacing.group,
  },
  modalCancelBtn: {
    flex: 1,
    paddingVertical: Spacing.group,
    borderRadius: BorderRadius.input,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.group,
    borderRadius: BorderRadius.input,
  },
  modalSaveText: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
});
