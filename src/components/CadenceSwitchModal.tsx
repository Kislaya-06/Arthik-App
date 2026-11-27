import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, Animated, Pressable, ScrollView, useAnimatedValue } from 'react-native';
import { useReduceMotion } from '../hooks/useReduceMotion';
import { PressableOpacity } from './ui/PressableOpacity';
import Check from 'lucide-react-native/icons/check';
import X from 'lucide-react-native/icons/x';
import AlertTriangle from 'lucide-react-native/icons/triangle-alert';
import ArrowRight from 'lucide-react-native/icons/arrow-right';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Calendar from 'lucide-react-native/icons/calendar';
import { PiggyBankCoinIcon } from './PiggyBankCoinIcon';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns/format';
import { parseISO } from 'date-fns/parseISO';
import { addDays } from 'date-fns/addDays';
import { differenceInCalendarDays } from 'date-fns/differenceInCalendarDays';

import { useTheme } from '../store/themeStore';
import { BudgetCadence } from '../types';
import {
  buildCadenceSwitchPlan,
  CadenceCarryMode,
} from '../lib/cadenceSwitch';
import { getPeriodBounds } from '../lib/budgetPeriods';
import { formatCurrency } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight, LineHeight } from '../config/theme';
import { useScrimColor } from '../hooks/useScrimColor';
import { PRESS_DIM_OPACITY } from '../lib/pressFeedback';
import { runSheetTransition } from '../lib/sheetTransition';

export interface CadenceSwitchModalProps {
  visible: boolean;
  currentCadence: BudgetCadence;
  targetCadence: BudgetCadence;
  initialTargetAmount: number;
  currentBudget: number;
  currentSpent: number;
  onConfirmSwitch: (params: {
    targetCadence: BudgetCadence;
    amount: number;
    carryMode?: CadenceCarryMode;
    carriedOverAmount: number;
  }) => void;
  onClose: () => void;
}

export const CadenceSwitchModal: React.FC<CadenceSwitchModalProps> = ({
  visible,
  currentCadence,
  targetCadence,
  initialTargetAmount,
  currentBudget,
  currentSpent,
  onConfirmSwitch,
  onClose,
}) => {
  const { colors, isDark } = useTheme();
  const scrim = useScrimColor();
  const insets = useSafeAreaInsets();

  const activeAccent = isDark ? colors.mintGreen : colors.forestGreen;
  const activeBg = isDark ? 'rgba(184, 224, 200, 0.12)' : 'rgba(27, 77, 62, 0.07)';

  const [carryForward, setCarryForward] = useState(false);
  const [targetAmount, setTargetAmount] = useState<number>(initialTargetAmount);

  useEffect(() => {
    if (visible) {
      setTargetAmount(initialTargetAmount);
      setCarryForward(false);
    }
  }, [visible, initialTargetAmount]);

  const [isMounted, setIsMounted] = useState(visible);
  const reduceMotion = useReduceMotion();
  const slideAnim = useAnimatedValue(500);
  const fadeAnim = useAnimatedValue(0);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) return;
    }

    if (visible) {
      setIsMounted(true);
    }
    runSheetTransition({ visible, reduceMotion, fadeAnim, slideAnim, offscreen: 500, enterFadeMs: 220, setIsMounted });
  }, [visible, slideAnim, fadeAnim, reduceMotion]);

  const todayStr = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [visible]);

  const targetPeriodInfo = useMemo(() => {
    const tomorrow = addDays(parseISO(todayStr), 1);
    const tomorrowStr = format(tomorrow, 'yyyy-MM-dd');

    if (targetCadence === 'weekly') {
      const bounds = getPeriodBounds('weekly', tomorrowStr);
      const remainingDays = differenceInCalendarDays(parseISO(bounds.end), tomorrow) + 1;
      const startFormatted = format(tomorrow, 'EEE, d MMM');
      const endFormatted = format(parseISO(bounds.end), 'EEE, d MMM');
      return {
        dateRange: `${startFormatted} – ${endFormatted}`,
        remainingDays,
        cycleLabel: `${remainingDays} days in this week`,
        endDateFormatted: endFormatted,
      };
    }

    if (targetCadence === 'monthly') {
      const bounds = getPeriodBounds('monthly', tomorrowStr);
      const remainingDays = differenceInCalendarDays(parseISO(bounds.end), tomorrow) + 1;
      const startFormatted = format(tomorrow, 'd MMM');
      const endFormatted = format(parseISO(bounds.end), 'd MMM');
      return {
        dateRange: `${startFormatted} – ${endFormatted}`,
        remainingDays,
        cycleLabel: `${remainingDays} days this month`,
        endDateFormatted: endFormatted,
      };
    }

    return {
      dateRange: format(tomorrow, 'EEE, d MMM'),
      remainingDays: 1,
      cycleLabel: 'daily',
      endDateFormatted: format(tomorrow, 'EEE, d MMM'),
    };
  }, [todayStr, targetCadence]);

  const plan = useMemo(() => {
    return buildCadenceSwitchPlan({
      currentCadence,
      targetCadence,
      currentBudget,
      currentSpent,
      targetAmount,
      carryMode: 'allocation',
      todayStr,
    });
  }, [currentCadence, targetCadence, currentBudget, currentSpent, targetAmount, todayStr]);

  const isToDaily = targetCadence === 'daily';
  const isFromDaily = currentCadence === 'daily';
  // "Pay my budget from it": how many budgets the carried money covers.
  const coverText = plan.allocationSummary?.coverText || '';

  const handleApplySafeAmount = useCallback((amount: number) => {
    setTargetAmount(amount);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirmSwitch({
      targetCadence,
      amount: targetAmount,
      // The amount here is today's figure; the store settles the real leftover at midnight (rule 22).
      carryMode: carryForward ? 'allocation' : undefined,
      carriedOverAmount: carryForward ? plan.carriedAmount : 0,
    });
  }, [onConfirmSwitch, targetCadence, targetAmount, carryForward, plan.carriedAmount]);

  if (!isMounted) return null;

  const currentLabel = currentCadence.charAt(0).toUpperCase() + currentCadence.slice(1);
  const targetLabel = targetCadence.charAt(0).toUpperCase() + targetCadence.slice(1);

  return (
    <Modal
      visible={isMounted}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.backdrop}>
        <Animated.View style={[styles.scrim, { backgroundColor: scrim, opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} importantForAccessibility="no" />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#141416' : colors.white,
              borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
              paddingBottom: Math.max(insets.bottom, Spacing.surface),
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Header */}
          <View style={styles.headerRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.badgeRow}>
                <View
                  style={[
                    styles.transitionBadge,
                    {
                      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                    },
                  ]}
                >
                  <Text style={[styles.badgeText, { color: colors.textSecondary }]}>
                    {currentLabel}
                  </Text>
                  <ArrowRight size={12} color={colors.textSecondary} style={{ marginHorizontal: 4 }} />
                  <Text style={[styles.badgeText, { color: colors.textPrimary, fontFamily: FontFamily.bold }]}>
                    {targetLabel}
                  </Text>
                </View>
              </View>
              <Text style={[styles.sheetTitle, { color: colors.textPrimary }]}>
                Switch to {targetLabel}
              </Text>
              <Text style={[styles.sheetSubtitle, { color: colors.textSecondary }]}>
                {plan.unspentAmount > 0
                  ? `${formatCurrency(plan.unspentAmount)} is left from your ${currentLabel} budget.`
                  : isFromDaily
                  ? "Today's unused daily money goes to your Gullak tonight."
                  : 'Nothing is left to carry.'}
              </Text>
            </View>

            <PressableOpacity activeOpacity={PRESS_DIM_OPACITY}
              style={[
                styles.closeButton,
                { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)' },
              ]}
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <X size={18} color={colors.textPrimary} />
            </PressableOpacity>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Compact Gullak Card */}
            <View
              style={[
                styles.gullakCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#F8F9FA',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                },
              ]}
            >
              <View style={styles.gullakHeaderRow}>
                <PiggyBankCoinIcon size={16} color={colors.mintText} style={{ marginRight: 6 }} />
                <Text style={[styles.gullakTitle, { color: colors.textPrimary }]}>Gullak</Text>
              </View>
              <Text style={[styles.gullakRowText, { color: colors.textPrimary }]}>
                {isFromDaily
                  ? "Today's unspent money is saved at midnight"
                  : carryForward || !(plan.unspentAmount > 0)
                  ? '₹0 added on this switch'
                  : `${formatCurrency(plan.unspentAmount)} will be saved at midnight`}
              </Text>
              <Text style={[styles.gullakRowSubtext, { color: colors.textSecondary }]}>
                Next deposit: at the end of the {targetLabel} cycle ({targetPeriodInfo.endDateFormatted})
              </Text>
            </View>

            {/* Over-Capacity Warning Banner (Audio Clip 2 Edge Case) */}
            {plan.validation.isExceeding && (
              <View
                style={[
                  styles.warningCard,
                  {
                    backgroundColor: isDark ? 'rgba(255, 122, 110, 0.12)' : 'rgba(255, 122, 110, 0.08)',
                    borderColor: 'rgba(255, 122, 110, 0.35)',
                  },
                ]}
              >
                <View style={styles.warningHeader}>
                  <AlertTriangle size={16} color="#FF7A6E" style={{ marginRight: 6 }} />
                  <Text style={[styles.warningTitle, { color: '#FF7A6E' }]}>
                    Exceeds Remaining {currentLabel} Budget
                  </Text>
                </View>
                <Text style={[styles.warningBody, { color: colors.textPrimary }]}>
                  {plan.validation.warningMessage}
                </Text>

                {plan.validation.maxSafeWeeklyAmount !== undefined && (
                  <PressableOpacity
                    style={styles.safeActionPill}
                    activeOpacity={0.8}
                    onPress={() => handleApplySafeAmount(plan.validation.maxSafeWeeklyAmount!)}
                  >
                    <Sparkles size={13} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.safeActionText}>
                      Set Safe Budget: {formatCurrency(plan.validation.maxSafeWeeklyAmount)}/week
                    </Text>
                  </PressableOpacity>
                )}

                {plan.validation.maxSafeDailyAmount !== undefined && (
                  <PressableOpacity
                    style={styles.safeActionPill}
                    activeOpacity={0.8}
                    onPress={() => handleApplySafeAmount(plan.validation.maxSafeDailyAmount!)}
                  >
                    <Sparkles size={13} color={colors.white} style={{ marginRight: 6 }} />
                    <Text style={styles.safeActionText}>
                      Set Safe Budget: {formatCurrency(plan.validation.maxSafeDailyAmount)}/day
                    </Text>
                  </PressableOpacity>
                )}
              </View>
            )}

            {/* Carry-Forward Mode Options */}
            {plan.unspentAmount > 0 && (
              <View style={styles.modeSection}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>
                    What should happen to {formatCurrency(plan.unspentAmount)}?
                  </Text>
                  <View
                    style={[
                      styles.datePill,
                      {
                        backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <Calendar size={12} color={colors.textSecondary} />
                    <Text style={[styles.datePillText, { color: colors.textSecondary }]}>
                      {targetPeriodInfo.dateRange}{isToDaily ? '' : ` (${targetPeriodInfo.remainingDays} days)`}
                    </Text>
                  </View>
                </View>

                <PressableOpacity
                  style={[
                    styles.modeOptionCard,
                    carryForward === false && styles.modeOptionCardActive,
                    {
                      backgroundColor:
                        carryForward === false ? activeBg : isDark ? 'rgba(255, 255, 255, 0.03)' : '#FAFAFA',
                      borderColor:
                        carryForward === false
                          ? activeAccent
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setCarryForward(false)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: carryForward === false }}
                >
                  <View style={styles.modeCardHeader}>
                    <Text
                      style={[
                        styles.modeCardTitle,
                        { color: carryForward === false ? colors.textPrimary : colors.textSecondary },
                      ]}
                    >
                      Save to Gullak
                    </Text>
                    <View
                      style={[
                        styles.radioCircle,
                        carryForward === false && styles.radioCircleActive,
                        { borderColor: carryForward === false ? activeAccent : colors.textSecondary },
                      ]}
                    >
                      {carryForward === false && (
                        <View style={[styles.radioInner, { backgroundColor: activeAccent }]} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.modeCardDesc, { color: colors.textSecondary }]}>
                    This money moves to your Gullak at midnight. Your new budget starts fresh.
                  </Text>
                </PressableOpacity>

                <PressableOpacity
                  style={[
                    styles.modeOptionCard,
                    carryForward === true && styles.modeOptionCardActive,
                    {
                      backgroundColor:
                        carryForward === true ? activeBg : isDark ? 'rgba(255, 255, 255, 0.03)' : '#FAFAFA',
                      borderColor:
                        carryForward === true
                          ? activeAccent
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setCarryForward(true)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: carryForward === true }}
                >
                  <View style={styles.modeCardHeader}>
                    <Text
                      style={[
                        styles.modeCardTitle,
                        { color: carryForward === true ? colors.textPrimary : colors.textSecondary },
                      ]}
                    >
                      Carry forward
                    </Text>
                    <View
                      style={[
                        styles.radioCircle,
                        carryForward === true && styles.radioCircleActive,
                        { borderColor: carryForward === true ? activeAccent : colors.textSecondary },
                      ]}
                    >
                      {carryForward === true && (
                        <View style={[styles.radioInner, { backgroundColor: activeAccent }]} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.modeCardDesc, { color: colors.textSecondary }]}>
                    Your new {formatCurrency(plan.targetBudgetAmount)} budget is paid from it for {coverText}. You add only the rest. Final amount is set at midnight.
                  </Text>
                </PressableOpacity>
              </View>
            )}

            {/* Compact Activation Note */}
            <View
              style={[
                styles.activationCard,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                },
              ]}
            >
              <Text style={[styles.activationText, { color: colors.textSecondary }]}>
                ⓘ Starts tomorrow • Unspent money at cycle end goes to Gullak
              </Text>
              {!isFromDaily && (
                <Text style={[styles.activationText, { color: colors.textSecondary, marginTop: 4 }]}>
                  If you come back to {currentLabel} in the same {currentCadence === 'weekly' ? 'week' : 'month'}, there is no new {currentLabel} budget until the next one starts.
                </Text>
              )}
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <PressableOpacity
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                },
              ]}
              onPress={onClose}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={[styles.cancelText, { color: colors.textPrimary }]}>Cancel</Text>
            </PressableOpacity>

            <PressableOpacity
              style={[
                styles.confirmBtn,
                {
                  backgroundColor: plan.validation.isExceeding
                    ? isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.08)'
                    : activeAccent,
                },
              ]}
              onPress={handleConfirm}
              disabled={plan.validation.isExceeding}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityState={{ disabled: plan.validation.isExceeding }}
              accessibilityLabel={`Switch to ${targetLabel}`}
            >
              <Check
                size={18}
                color={
                  plan.validation.isExceeding
                    ? colors.textSecondary
                    : isDark
                    ? colors.forestGreen
                    : colors.white
                }
                style={{ marginRight: 6 }}
              />
              <Text
                style={[
                  styles.confirmText,
                  {
                    color: plan.validation.isExceeding
                      ? colors.textSecondary
                      : isDark
                      ? colors.forestGreen
                      : colors.white,
                  },
                ]}
              >
                Switch to {targetLabel}
              </Text>
            </PressableOpacity>
          </View>

          {/* Bleed skirt: anchors the bottom of the sheet so spring overshoot never exposes the background underneath */}
          <View
            style={[
              styles.overshootSkirt,
              {
                backgroundColor: isDark ? '#141416' : colors.white,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
                borderLeftWidth: 1,
                borderRightWidth: 1,
                left: -1,
                right: -1,
              },
            ]}
            pointerEvents="none"
          />
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrim: {
    ...StyleSheet.absoluteFill,
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.cardLarge,
    borderTopRightRadius: BorderRadius.cardLarge,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '88%',
    paddingTop: Spacing.surface,
    overflow: 'visible',
  },
  overshootSkirt: {
    position: 'absolute',
    bottom: -300,
    height: 300,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.surface,
    marginBottom: Spacing.block,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.micro,
  },
  transitionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
  },
  badgeText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
  },
  sheetTitle: {
    fontSize: FontSize.titleMedium,
    lineHeight: LineHeight.titleMedium,
    fontFamily: FontFamily.bold,
  },
  sheetSubtitle: {
    fontSize: FontSize.bodySmall,
    lineHeight: LineHeight.bodySmall,
    fontFamily: FontFamily.medium,
    marginTop: 2,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollArea: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.surface,
    paddingBottom: Spacing.surface,
  },
  gullakCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.block,
  },
  gullakHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  gullakTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  gullakRowText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.semibold,
    marginBottom: 2,
  },
  gullakRowSubtext: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
  },
  warningCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.block,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.micro,
  },
  warningTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  warningBody: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 18,
    marginBottom: Spacing.group,
  },
  safeActionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF7A6E',
    paddingVertical: 10,
    paddingHorizontal: Spacing.block,
    borderRadius: BorderRadius.pill,
  },
  safeActionText: {
    color: '#FFFFFF',
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  modeSection: {
    marginBottom: Spacing.block,
  },
  sectionHeaderRow: {
    marginBottom: Spacing.group,
    gap: 4,
  },
  datePill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.micro,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    marginTop: 2,
  },
  datePillText: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
  },
  sectionTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  modeOptionCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    padding: Spacing.block,
    marginBottom: Spacing.group,
  },
  modeOptionCardActive: {
    borderWidth: 1.5,
  },
  modeCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  modeCardTitle: {
    fontSize: FontSize.bodySmall,
    fontFamily: FontFamily.bold,
  },
  modeCardDesc: {
    fontSize: FontSize.caption,
    fontFamily: FontFamily.medium,
    lineHeight: 16,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioCircleActive: {},
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  activationCard: {
    borderRadius: BorderRadius.card,
    borderWidth: 1,
    padding: Spacing.block,
    marginBottom: Spacing.block,
  },
  activationText: {
    fontSize: FontSize.caption,
    lineHeight: LineHeight.caption,
    fontFamily: FontFamily.medium,
  },
  actionRow: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.surface,
    gap: Spacing.group,
  },
  cancelBtn: {
    flex: 1,
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
  confirmBtn: {
    flex: 1,
    height: ControlHeight.cta,
    borderRadius: BorderRadius.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: FontSize.body,
    fontFamily: FontFamily.bold,
  },
});
