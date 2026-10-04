import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Pressable,
  ScrollView,
} from 'react-native';
import { Check, X, AlertTriangle, ArrowRight, Sparkles } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns';

import { useTheme } from '../store/themeStore';
import { BudgetCadence } from '../types';
import {
  buildCadenceSwitchPlan,
  CadenceCarryMode,
} from '../lib/cadenceSwitch';
import { getPeriodBounds } from '../lib/budgetPeriods';
import { formatCurrency } from '../lib/formatters';
import { Spacing, BorderRadius, FontSize, FontFamily, ControlHeight, LineHeight } from '../config/theme';

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
    carryMode: CadenceCarryMode;
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
  const insets = useSafeAreaInsets();

  const activeAccent = isDark ? colors.mintGreen : colors.forestGreen;
  const activeBg = isDark ? 'rgba(184, 224, 200, 0.12)' : 'rgba(27, 77, 62, 0.07)';

  const [carryMode, setCarryMode] = useState<CadenceCarryMode>('allocation');
  const [targetAmount, setTargetAmount] = useState<number>(initialTargetAmount);

  useEffect(() => {
    if (visible) {
      setTargetAmount(initialTargetAmount);
      setCarryMode('allocation');
    }
  }, [visible, initialTargetAmount]);

  const [isMounted, setIsMounted] = useState(visible);
  const slideAnim = useRef(new Animated.Value(500)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      if (!visible) return;
    }

    if (visible) {
      setIsMounted(true);
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          tension: 70,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 500,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setIsMounted(false);
      });
    }
  }, [visible, slideAnim, fadeAnim]);

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
      carryMode,
      todayStr,
    });
  }, [currentCadence, targetCadence, currentBudget, currentSpent, targetAmount, carryMode, todayStr]);

  const handleApplySafeAmount = useCallback((amount: number) => {
    setTargetAmount(amount);
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirmSwitch({
      targetCadence,
      amount: targetAmount,
      carryMode,
      carriedOverAmount: plan.carriedAmount,
    });
  }, [onConfirmSwitch, targetCadence, targetAmount, carryMode, plan.carriedAmount]);

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
        <Animated.View style={[styles.scrim, { opacity: fadeAnim }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.sheetContainer,
            {
              backgroundColor: isDark ? '#141416' : '#FFFFFF',
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
                {formatCurrency(plan.unspentAmount)} is left from your {currentLabel} budget.
              </Text>
            </View>

            <TouchableOpacity
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
            </TouchableOpacity>
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
                <Text style={{ fontSize: 16, marginRight: 6 }}>🪙</Text>
                <Text style={[styles.gullakTitle, { color: colors.textPrimary }]}>Gullak</Text>
              </View>
              <Text style={[styles.gullakRowText, { color: colors.textPrimary }]}>
                ₹0 added on this switch
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
                  <TouchableOpacity
                    style={styles.safeActionPill}
                    activeOpacity={0.8}
                    onPress={() => handleApplySafeAmount(plan.validation.maxSafeWeeklyAmount!)}
                  >
                    <Sparkles size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.safeActionText}>
                      Set Safe Budget: {formatCurrency(plan.validation.maxSafeWeeklyAmount)}/week
                    </Text>
                  </TouchableOpacity>
                )}

                {plan.validation.maxSafeDailyAmount !== undefined && (
                  <TouchableOpacity
                    style={styles.safeActionPill}
                    activeOpacity={0.8}
                    onPress={() => handleApplySafeAmount(plan.validation.maxSafeDailyAmount!)}
                  >
                    <Sparkles size={13} color="#FFFFFF" style={{ marginRight: 6 }} />
                    <Text style={styles.safeActionText}>
                      Set Safe Budget: {formatCurrency(plan.validation.maxSafeDailyAmount)}/day
                    </Text>
                  </TouchableOpacity>
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
                    <Text style={[styles.datePillText, { color: colors.textSecondary }]}>
                      📅 {targetPeriodInfo.dateRange} ({targetPeriodInfo.remainingDays} days)
                    </Text>
                  </View>
                </View>

                {/* Option 1: Add to Target Budget */}
                <TouchableOpacity
                  style={[
                    styles.modeOptionCard,
                    carryMode === 'additive' && styles.modeOptionCardActive,
                    {
                      backgroundColor:
                        carryMode === 'additive'
                          ? activeBg
                          : isDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : '#FAFAFA',
                      borderColor:
                        carryMode === 'additive'
                          ? activeAccent
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setCarryMode('additive')}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: carryMode === 'additive' }}
                >
                  <View style={styles.modeCardHeader}>
                    <Text
                      style={[
                        styles.modeCardTitle,
                        { color: carryMode === 'additive' ? colors.textPrimary : colors.textSecondary },
                      ]}
                    >
                      Add to {targetLabel} budget
                    </Text>
                    <View
                      style={[
                        styles.radioCircle,
                        carryMode === 'additive' && styles.radioCircleActive,
                        { borderColor: carryMode === 'additive' ? activeAccent : colors.textSecondary },
                      ]}
                    >
                      {carryMode === 'additive' && (
                        <View style={[styles.radioInner, { backgroundColor: activeAccent }]} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.modeCardDesc, { color: colors.textSecondary }]}>
                    {targetLabel} budget →{' '}
                    <Text style={{ fontFamily: FontFamily.bold, color: colors.textPrimary }}>
                      {formatCurrency(plan.targetBudgetAmount + plan.unspentAmount)}
                    </Text>
                    {' '}(for {targetPeriodInfo.remainingDays} days)
                  </Text>
                </TouchableOpacity>

                {/* Option 2: Keep target budget */}
                <TouchableOpacity
                  style={[
                    styles.modeOptionCard,
                    carryMode === 'allocation' && styles.modeOptionCardActive,
                    {
                      backgroundColor:
                        carryMode === 'allocation'
                          ? activeBg
                          : isDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : '#FAFAFA',
                      borderColor:
                        carryMode === 'allocation'
                          ? activeAccent
                          : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                    },
                  ]}
                  activeOpacity={0.8}
                  onPress={() => setCarryMode('allocation')}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: carryMode === 'allocation' }}
                >
                  <View style={styles.modeCardHeader}>
                    <Text
                      style={[
                        styles.modeCardTitle,
                        { color: carryMode === 'allocation' ? colors.textPrimary : colors.textSecondary },
                      ]}
                    >
                      Keep it at {formatCurrency(plan.targetBudgetAmount)}
                    </Text>
                    <View
                      style={[
                        styles.radioCircle,
                        carryMode === 'allocation' && styles.radioCircleActive,
                        { borderColor: carryMode === 'allocation' ? activeAccent : colors.textSecondary },
                      ]}
                    >
                      {carryMode === 'allocation' && (
                        <View style={[styles.radioInner, { backgroundColor: activeAccent }]} />
                      )}
                    </View>
                  </View>
                  <Text style={[styles.modeCardDesc, { color: colors.textSecondary }]}>
                    {targetLabel} budget stays{' '}
                    <Text style={{ fontFamily: FontFamily.bold, color: colors.textPrimary }}>
                      {formatCurrency(plan.targetBudgetAmount)}
                    </Text>
                    {' '}(for {targetPeriodInfo.remainingDays} days)
                  </Text>
                </TouchableOpacity>
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
            </View>
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity
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
            </TouchableOpacity>

            <TouchableOpacity
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
                    : '#FFFFFF'
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
                      : '#FFFFFF',
                  },
                ]}
              >
                Switch to {targetLabel}
              </Text>
            </TouchableOpacity>
          </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },
  sheetContainer: {
    borderTopLeftRadius: BorderRadius.cardLarge,
    borderTopRightRadius: BorderRadius.cardLarge,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    maxHeight: '88%',
    paddingTop: Spacing.surface,
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
    width: 32,
    height: 32,
    borderRadius: 16,
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
    height: ControlHeight.row,
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
    height: ControlHeight.row,
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
