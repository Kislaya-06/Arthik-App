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

import { useDailyBudgetStore } from '../store/dailyBudgetStore';
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
import { computeEffectiveFrom } from '../lib/budgetPeriods';
import { BudgetCadence } from '../types';
import { KeyButton } from './KeyButton';
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
      const prorationNote = prorationPreview
        ? `\n\nFor the remaining ${prorationPreview.remainingDays} ${prorationPreview.remainingDays === 1 ? 'day' : 'days'}, you will have a prorated spending allowance of ${formatCurrency(prorationPreview.proratedAmount)}. Any unspent amount rolls into your Gullak.`
        : '';

      Alert.alert(
        'Switch Cadence?',
        `Switching to ${selectedCadence.toUpperCase()} budget (${formatCurrency(evaluatedAmount)}) will ${effectiveFromLabel.toLowerCase()}.${prorationNote}\n\nDo you want to confirm?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Yes, Switch',
            onPress: () => {
              if (selectedCadence === 'daily') setDailyBudget(evaluatedAmount);
              else if (selectedCadence === 'weekly') setWeeklyBudget(evaluatedAmount);
              else setMonthlyBudget(evaluatedAmount);
              setBudgetCadence(selectedCadence);
              onClose();
            },
          },
        ]
      );
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
              backgroundColor: colors.card,
              borderColor: colors.border,
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
        >
          <ScrollView bounces={false} showsVerticalScrollIndicator={false}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
                {isBudgetModeEnabled ? 'Change Budget Plan' : 'Set Smart Budget'}
              </Text>
              <TouchableOpacity onPress={onClose} hitSlop={10}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Subtitle / Effective From Notice */}
            <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
              {effectiveFromLabel}
            </Text>

            {/* Pending Plan Change Banner (if exists) */}
            {pendingChange && (
              <View
                style={[
                  styles.pendingBanner,
                  {
                    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.12)' : '#FEF3C7',
                    borderColor: isDark ? 'rgba(245, 158, 11, 0.3)' : '#F59E0B',
                  },
                ]}
              >
                <Clock size={16} color="#D97706" style={{ marginRight: 8 }} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pendingBannerTitle, { color: isDark ? '#FCD34D' : '#92400E' }]}>
                    Scheduled Change Pending
                  </Text>
                  <Text style={[styles.pendingBannerSubtitle, { color: isDark ? '#FDE68A' : '#78350F' }]}>
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
                  backgroundColor: isDark ? colors.cardSubtle : 'rgba(0, 0, 0, 0.04)',
                  borderColor: colors.borderSubtle,
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
                      backgroundColor: colors.mintGreen,
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
                          color: isSelected ? colors.forestGreen : colors.textSecondary,
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
                { backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.modalCurrencySign, { color: colors.mintGreenDark }]}>₹</Text>
              <Text
                style={[
                  styles.modalAmountDisplay,
                  {
                    color: amountStr ? colors.textPrimary : colors.textSecondary,
                  },
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {amountStr ? formatAmountWithCommas(amountStr) : '0'}
              </Text>
            </View>

            {/* Proration Preview (One-liner if partial period created) */}
            {/* Proration Preview (Prorated allowance + crystal clear explanation) */}
            {prorationPreview && (
              <View
                style={[
                  styles.prorationCard,
                  {
                    backgroundColor: isDark ? 'rgba(184, 224, 200, 0.12)' : '#E8F5E9',
                    borderColor: isDark ? 'rgba(184, 224, 200, 0.35)' : '#A5D6A7',
                  },
                ]}
              >
                <View style={styles.prorationHeaderRow}>
                  <Sparkles
                    size={14}
                    color={isDark ? '#6EE7B7' : '#15803D'}
                    style={{ marginRight: 6 }}
                  />
                  <Text
                    style={[
                      styles.prorationTitle,
                      { color: isDark ? '#6EE7B7' : '#15803D' },
                    ]}
                  >
                    {prorationPreview.previewText}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.prorationExplanation,
                    { color: isDark ? colors.textSecondary : '#4B5563' },
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
                style={[styles.modalCancelBtn, { borderColor: colors.border }]}
                onPress={onClose}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                  Cancel
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.modalSaveBtn,
                  {
                    backgroundColor: evaluatedAmount > 0 ? colors.mintGreen : colors.cardSubtle,
                    opacity: evaluatedAmount > 0 ? 1 : 0.6,
                  },
                ]}
                onPress={handleSave}
                disabled={evaluatedAmount <= 0}
              >
                <Check size={18} color={colors.forestGreen} style={{ marginRight: 6 }} />
                <Text style={[styles.modalSaveText, { color: colors.forestGreen }]}>
                  Save Budget
                </Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </Animated.View>
      </View>
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
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.nano,
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
    fontSize: 12,
    fontFamily: FontFamily.bold,
    flex: 1,
  },
  prorationExplanation: {
    fontSize: 11,
    fontFamily: FontFamily.medium,
    lineHeight: 15,
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
